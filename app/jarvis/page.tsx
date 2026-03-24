import { cookies } from 'next/headers';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import Link from 'next/link';
import RefreshButton from './RefreshButton';
import MobileBottomNav from '@/components/MobileBottomNav';

export const dynamic = 'force-dynamic';

const JARVIS_HOME = process.env.BOT_HOME || join(homedir(), '.jarvis');

// ── 파일 유틸 ─────────────────────────────────────────────────────────────
function safeJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, 'utf-8')) as T; }
  catch { return null; }
}
function safeText(path: string): string {
  try { return readFileSync(path, 'utf-8'); }
  catch { return ''; }
}
function safeLines(path: string): string[] {
  return safeText(path).split('\n').filter(Boolean);
}
function safeJsonLines<T>(path: string): T[] {
  return safeLines(path).flatMap(l => { try { return [JSON.parse(l) as T]; } catch { return []; } });
}

// ── 크론 로그 파싱 ────────────────────────────────────────────────────────
interface CronDaily { date: string; ok: number; fail: number }

function parseCronLog() {
  const text = safeText(join(JARVIS_HOME, 'logs', 'cron.log'));
  const dailyMap: Record<string, { ok: number; fail: number }> = {};
  const errMap: Record<string, { count: number; lastAt: string }> = {};
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);

  for (const line of text.split('\n')) {
    const dm = line.match(/^\[(\d{4}-\d{2}-\d{2})\s/);
    if (!dm || new Date(dm[1]) < cutoff) continue;
    const date = dm[1];
    if (!dailyMap[date]) dailyMap[date] = { ok: 0, fail: 0 };
    const task = line.match(/\]\s*\[([^\]]+)\]/)?.[1] ?? 'unknown';

    if (/ SUCCESS | OK /.test(line)) dailyMap[date].ok++;
    if (/FAILED|ERROR/.test(line)) {
      dailyMap[date].fail++;
      const ts = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/)?.[1] ?? date;
      if (!errMap[task]) errMap[task] = { count: 0, lastAt: ts };
      errMap[task].count++;
      if (ts > errMap[task].lastAt) errMap[task].lastAt = ts;
    }
  }

  const daily: CronDaily[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    daily.push({ date, ok: dailyMap[date]?.ok ?? 0, fail: dailyMap[date]?.fail ?? 0 });
  }
  const topErrors = Object.entries(errMap)
    .map(([task, v]) => ({ task, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return { daily, topErrors };
}

// ── RAG stuck 감지 ────────────────────────────────────────────────────────
function detectRagStuck(): { stuck: boolean; pidCycling: number; lastLine: string } {
  const lines = safeLines(join(JARVIS_HOME, 'logs', 'rag-index.log')).slice(-20);
  const stuckLines = lines.filter(l => l.includes('Already running'));
  const pids = [...new Set(stuckLines.map(l => l.match(/PID (\d+)/)?.[1]).filter(Boolean))];
  return { stuck: stuckLines.length >= 3, pidCycling: pids.length, lastLine: lines.at(-1) ?? '' };
}

// ── 서킷브레이커 ──────────────────────────────────────────────────────────
interface CircuitEntry { task_id: string; consecutive_fails: number; last_fail_ts: number }

function readCircuitBreakers(): CircuitEntry[] {
  const dir = join(JARVIS_HOME, 'state', 'circuit-breaker');
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .flatMap(f => { const d = safeJson<CircuitEntry>(join(dir, f)); return d ? [d] : []; })
      .sort((a, b) => b.last_fail_ts - a.last_fail_ts);
  } catch { return []; }
}

// ── 오늘의 팀 의사결정 ────────────────────────────────────────────────────
interface Decision {
  ts: string; decision: string; team: string;
  okr?: string | null; status?: string; rationale?: string;
  action?: string; result?: string;
}

function readTodayDecisions(): Decision[] {
  const today = new Date().toISOString().slice(0, 10);
  const path = join(JARVIS_HOME, 'state', 'decisions', `${today}.jsonl`);
  return safeJsonLines<Decision>(path).slice(-20);
}

// ── 리스크 연쇄 (connections.jsonl) ──────────────────────────────────────
interface Connection { from: string; to: string; relationship: string; strength: number }
interface ConnectionEntry { date: string; session: string; connections: Connection[] }

function readLatestConnections(): ConnectionEntry | null {
  const lines = safeLines(join(JARVIS_HOME, 'state', 'connections.jsonl'));
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]) as ConnectionEntry; } catch { continue; }
  }
  return null;
}

// ── 자율 작업 큐 (dev-queue.json) ────────────────────────────────────────
interface DevQueueItem {
  id: string; name: string; priority: number; status: string;
  source?: string; assignee?: string; createdAt: string;
  retries?: number; maxRetries?: number;
}

function readDevQueue(): DevQueueItem[] {
  const raw = safeJson<Record<string, DevQueueItem> | DevQueueItem[]>(
    join(JARVIS_HOME, 'state', 'dev-queue.json')
  );
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : Object.values(raw);
  return items
    .filter(i => i.status === 'pending')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 8);
}

// ── 팀 스코어카드 ─────────────────────────────────────────────────────────
interface TeamInfo {
  lead: string; merit: number; penalty: number; status: string;
  history?: { ts: string; decision: string; outcome: string }[];
}
interface TeamScorecard { teams: Record<string, TeamInfo>; lastDecay?: string; thresholds?: Record<string, number> }

function readTeamScorecard(): TeamScorecard | null {
  return safeJson<TeamScorecard>(join(JARVIS_HOME, 'state', 'team-scorecard.json'));
}

// ── SVG 미니 막대 차트 ─────────────────────────────────────────────────────
function MiniBarChart({ data, colorA = '#6366f1', colorB = '#f87171', labelKey = 'date', valueKeyA = 'ok', valueKeyB = 'fail' }: {
  data: Record<string, number | string>[];
  colorA?: string; colorB?: string;
  labelKey?: string; valueKeyA?: string; valueKeyB?: string;
}) {
  const maxVal = Math.max(...data.map(d => (d[valueKeyA] as number) + (d[valueKeyB] as number)), 1);
  const W = 560, H = 80, ML = 4, MR = 4, MT = 4, MB = 20;
  const CW = W - ML - MR, CH = H - MT - MB;
  const gap = CW / data.length, bw = Math.max(4, gap * 0.7);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {data.map((d, i) => {
        const cx = ML + i * gap + gap / 2;
        const aH = Math.max(2, ((d[valueKeyA] as number) / maxVal) * CH);
        const bH = Math.max(0, ((d[valueKeyB] as number) / maxVal) * CH);
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={MT + CH - aH - bH} width={bw} height={aH} fill={colorA} rx="2" opacity="0.85" />
            {bH > 0 && <rect x={cx - bw / 2} y={MT + CH - bH} width={bw} height={bH} fill={colorB} rx="2" opacity="0.9" />}
            <text x={cx} y={H - 2} textAnchor="middle" fontSize="9" fill="#94a3b8">{String(d[labelKey]).slice(5)}</text>
          </g>
        );
      })}
      <line x1={ML} y1={MT + CH} x2={W - MR} y2={MT + CH} stroke="#e4e4e7" strokeWidth="1" />
    </svg>
  );
}

// ── 팀 뱃지 색상 ──────────────────────────────────────────────────────────
const TEAM_LABEL: Record<string, string> = {
  infra: '인프라', council: '이사회', record: '기록', career: '커리어',
  brand: '브랜드', academy: '아카데미', strategy: '전략',
};
const TEAM_COLOR: Record<string, string> = {
  infra: 'bg-blue-100 text-blue-700', council: 'bg-purple-100 text-purple-700',
  record: 'bg-zinc-100 text-zinc-600', career: 'bg-amber-100 text-amber-700',
  brand: 'bg-pink-100 text-pink-700', academy: 'bg-emerald-100 text-emerald-700',
  strategy: 'bg-indigo-100 text-indigo-700',
};

// ── 메인 페이지 ───────────────────────────────────────────────────────────
export default async function JarvisDashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const ownerPw = process.env.VIEWER_PASSWORD;
  const isOwner = !!(ownerPw && session && session === makeToken(ownerPw));
  if (!isOwner) redirect('/login');

  // ── 데이터 수집 ──
  const health = safeJson<{
    last_check: string; discord_bot: string;
    memory_mb: number; crash_count: number; stale_claude_killed: number;
  }>(join(JARVIS_HOME, 'state', 'health.json'));

  const errorTracker = safeJson<{
    errors: { channelId: string; errorMessage: string; timestamp: number }[];
  }>(join(JARVIS_HOME, 'state', 'error-tracker.json'));

  const { daily: cronDaily, topErrors: cronErrors } = parseCronLog();
  const ragStatus = detectRagStuck();
  const circuitBreakers = readCircuitBreakers();
  const todayDecisions = readTodayDecisions();
  const latestConnections = readLatestConnections();
  const devQueue = readDevQueue();
  const scorecard = readTeamScorecard();

  // 디스크 사용률
  let diskPct = 0, diskFree = '?';
  try {
    const { execSync } = await import('child_process');
    const df = execSync('df -h / | tail -1', { timeout: 2000 }).toString().trim().split(/\s+/);
    diskPct = parseInt(df[4] ?? '0', 10);
    diskFree = df[3] ?? '?';
  } catch { /* 무시 */ }

  // 크론 집계
  const cronOk7   = cronDaily.reduce((s, d) => s + d.ok, 0);
  const cronFail7 = cronDaily.reduce((s, d) => s + d.fail, 0);
  const cronTotal = cronOk7 + cronFail7;
  const cronRate  = cronTotal > 0 ? Math.round((cronOk7 / cronTotal) * 100) : 0;

  // 보드 DB (최소한의 데이터만)
  const db = getDb();
  const recentPosts = db.prepare(`
    SELECT id, title, channel, status, author_display, created_at,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
    FROM posts p ORDER BY created_at DESC LIMIT 10
  `).all() as {
    id: string; title: string; channel: string; status: string;
    author_display: string; created_at: string; comment_count: number;
  }[];
  const totalPosts = (db.prepare('SELECT COUNT(*) as n FROM posts').get() as { n: number })?.n ?? 0;

  // Discord 에러 집계
  const discordErrByType: Record<string, number> = {};
  for (const e of (errorTracker?.errors ?? [])) {
    discordErrByType[e.errorMessage] = (discordErrByType[e.errorMessage] || 0) + 1;
  }
  const topDiscordErrors = Object.entries(discordErrByType).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // 로컬 환경 여부 (Railway 배포 환경에서는 ~/.jarvis 파일 없음)
  const isLocalEnv = existsSync(join(JARVIS_HOME, 'state', 'health.json'));

  // 경보 여부
  const hasAlerts = circuitBreakers.length > 0 || ragStatus.stuck;
  const ragLastTs = ragStatus.lastLine.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)?.[1]?.replace('T', ' ');
  const now = new Date().toLocaleString('ko-KR');

  // UNMATCHED 의사결정 (수동 처리 필요)
  const unmatchedDecisions = todayDecisions.filter(d => d.action === 'UNMATCHED' || d.result === 'NEEDS_MANUAL_REVIEW');
  const confirmedDecisions = todayDecisions.filter(d => d.status === 'confirmed' || (!d.action && !d.result));

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-zinc-600 text-sm">← 보드</Link>
            <span className="text-zinc-200">|</span>
            <h1 className="font-bold text-zinc-800 text-base flex items-center gap-2">
              🛸 Jarvis 시스템 대시보드
              {hasAlerts && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  ⚠ 알림 {circuitBreakers.length + (ragStatus.stuck ? 1 : 0)}
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 hidden sm:block">갱신: {now}</span>
            <RefreshButton interval={30} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 pb-24 space-y-5 md:pb-5">

        {/* ── Railway 환경 안내 배너 ── */}
        {!isLocalEnv && (
          <div className="flex items-center gap-3 bg-zinc-100 border border-zinc-300 rounded-xl px-4 py-3 text-sm text-zinc-600">
            <span className="text-lg">🌐</span>
            <div>
              <span className="font-semibold">Railway 배포 환경</span>
              {' '}— Jarvis 로컬 데이터(크론 로그, 봇 상태, RAG 등)에 접근할 수 없습니다.
              보드 DB 데이터만 표시됩니다.
            </div>
          </div>
        )}

        {/* ── 1. 경보 배너 (문제 있을 때만) ── */}
        {hasAlerts && (
          <section className="space-y-2">
            {ragStatus.stuck && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-red-500 text-lg mt-0.5">🔴</span>
                <div>
                  <div className="text-sm font-semibold text-red-700">RAG 인덱싱 STUCK</div>
                  <div className="text-xs text-red-600 mt-0.5">
                    {ragStatus.pidCycling}개 PID 사이클링 중 · 마지막: {ragLastTs ?? '?'} ·
                    {' '}정상화하려면 <code className="bg-red-100 px-1 rounded">pkill -f rag-index</code> 후 재시작
                  </div>
                </div>
              </div>
            )}
            {circuitBreakers.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-500">⚡</span>
                  <span className="text-sm font-semibold text-amber-800">
                    서킷브레이커 OPEN — {circuitBreakers.length}개 태스크 연속 실패
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {circuitBreakers.map(cb => (
                    <div key={cb.task_id} className="bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-mono font-medium text-amber-800">{cb.task_id}</span>
                      <span className="text-amber-500 ml-2">
                        {cb.consecutive_fails}회 실패 · {new Date(cb.last_fail_ts * 1000).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {unmatchedDecisions.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-orange-500">🔁</span>
                  <span className="text-sm font-semibold text-orange-800">
                    수동 처리 필요 — {unmatchedDecisions.length}건 의사결정 UNMATCHED
                  </span>
                </div>
                <div className="space-y-1">
                  {unmatchedDecisions.map((d, i) => (
                    <div key={i} className="text-xs text-orange-700 bg-white border border-orange-100 rounded px-3 py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium mr-2 ${TEAM_COLOR[d.team] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {TEAM_LABEL[d.team] ?? d.team}
                      </span>
                      {d.decision}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 2. 시스템 상태 카드 4개 ── */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-1">Discord Bot</div>
              <div className={`text-xl font-bold ${
                !isLocalEnv ? 'text-zinc-400'
                : health?.discord_bot === 'healthy' ? 'text-emerald-600'
                : 'text-red-600'
              }`}>
                {!isLocalEnv ? '— 로컬 전용'
                  : health?.discord_bot === 'healthy' ? '✅ 정상'
                  : '❌ 오프라인'}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {isLocalEnv
                  ? `메모리 ${health?.memory_mb ?? '?'}MB · 크래시 ${health?.crash_count ?? 0}회`
                  : 'health.json 없음'}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-1">디스크 / 잔여</div>
              <div className={`text-xl font-bold ${diskPct > 90 ? 'text-red-600' : diskPct > 75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {diskPct}%
              </div>
              <div className="mt-1.5 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${diskPct}%`, backgroundColor: diskPct > 90 ? '#dc2626' : diskPct > 75 ? '#d97706' : '#16a34a' }} />
              </div>
              <div className="text-xs text-zinc-400 mt-1">여유 {diskFree}</div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-1">크론 성공률 (7일)</div>
              <div className={`text-xl font-bold ${cronRate >= 90 ? 'text-emerald-600' : cronRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {cronRate}%
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                ✅ {cronOk7.toLocaleString()} · ❌ {cronFail7.toLocaleString()}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-1">RAG 인덱싱</div>
              <div className={`text-xl font-bold ${
                !isLocalEnv ? 'text-zinc-400'
                : ragStatus.stuck ? 'text-red-600'
                : 'text-emerald-600'
              }`}>
                {!isLocalEnv ? '— 로컬 전용'
                  : ragStatus.stuck ? '🔴 STUCK'
                  : '✅ 정상'}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {!isLocalEnv ? 'rag-index.log 없음'
                  : ragStatus.stuck ? `PID ${ragStatus.pidCycling}개 사이클링`
                  : '정상 동작 중'}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. 오늘의 팀 의사결정 + 리스크 연쇄 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* 오늘의 의사결정 (60%) */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-zinc-800">📋 오늘의 팀 의사결정</h2>
              <span className="text-xs text-zinc-400">{new Date().toLocaleDateString('ko-KR')}</span>
            </div>
            {confirmedDecisions.length > 0 ? (
              <div className="space-y-2.5">
                {confirmedDecisions.map((d, i) => (
                  <div key={i} className="flex gap-3 py-2 border-b border-zinc-50 last:border-0">
                    <div className="shrink-0 mt-0.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TEAM_COLOR[d.team] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {TEAM_LABEL[d.team] ?? d.team}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-700 leading-snug">{d.decision}</p>
                      {d.rationale && (
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{d.rationale}</p>
                      )}
                    </div>
                    {d.okr && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-mono font-medium self-start mt-0.5">
                        {d.okr}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">오늘 의사결정 기록 없음</div>
            )}
          </div>

          {/* 리스크 연쇄 (40%) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-zinc-800">🔗 리스크 연쇄</h2>
              {latestConnections && (
                <span className="text-xs text-zinc-400">{latestConnections.date} {latestConnections.session}</span>
              )}
            </div>
            {latestConnections?.connections.length ? (
              <div className="space-y-3">
                {latestConnections.connections.slice(0, 5).map((c, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-zinc-700 truncate max-w-[35%]">{c.from.replace(/_/g, ' ')}</span>
                      <span className="text-zinc-400 shrink-0">→</span>
                      <span className="font-medium text-zinc-700 truncate max-w-[35%]">{c.to.replace(/_/g, ' ')}</span>
                      <span className={`shrink-0 font-bold text-[10px] ml-auto ${c.strength >= 0.8 ? 'text-red-500' : c.strength >= 0.6 ? 'text-amber-500' : 'text-zinc-400'}`}>
                        {Math.round(c.strength * 100)}%
                      </span>
                    </div>
                    <div className="h-1 bg-zinc-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${c.strength * 100}%`,
                          backgroundColor: c.strength >= 0.8 ? '#ef4444' : c.strength >= 0.6 ? '#f59e0b' : '#6366f1',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">연결 데이터 없음</div>
            )}
          </div>
        </div>

        {/* ── 4. 크론 현황 + 자율 작업 큐 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 크론 현황 */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-800">⚙️ 크론 현황 (7일)</h2>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-400" />성공</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400" />실패</span>
              </div>
            </div>
            <MiniBarChart
              data={cronDaily as unknown as Record<string, number | string>[]}
              colorA="#818cf8" colorB="#f87171"
              labelKey="date" valueKeyA="ok" valueKeyB="fail"
            />
            {cronErrors.length > 0 ? (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {cronErrors.map(e => (
                  <div key={e.task} className="flex items-center justify-between text-xs py-1 border-b border-zinc-50">
                    <span className="font-mono text-zinc-600 truncate max-w-[55%]">{e.task}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-red-500">{e.count}회</span>
                      <span className="text-zinc-400">{e.lastAt.slice(5, 16)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-emerald-600">✅ 최근 7일 에러 없음</div>
            )}
          </div>

          {/* 자율 작업 큐 */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-zinc-800">🤖 자율 작업 큐</h2>
              <span className="text-xs text-zinc-400">{devQueue.length}건 대기 중</span>
            </div>
            {devQueue.length > 0 ? (
              <div className="space-y-2.5">
                {devQueue.map(item => (
                  <div key={item.id} className="flex gap-3 py-2 border-b border-zinc-50 last:border-0">
                    <div className="shrink-0 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        (item.priority ?? 0) >= 10 ? 'bg-red-50 text-red-600' :
                        (item.priority ?? 0) >= 5  ? 'bg-amber-50 text-amber-600' :
                        'bg-zinc-50 text-zinc-500'
                      }`}>
                        P{item.priority ?? 0}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-700 line-clamp-2 leading-snug">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.assignee && (
                          <span className="text-[10px] text-zinc-400">{item.assignee}</span>
                        )}
                        {(item.retries ?? 0) > 0 && (
                          <span className="text-[10px] text-amber-500">재시도 {item.retries}/{item.maxRetries}</span>
                        )}
                        <span className="text-[10px] text-zinc-300 ml-auto">{item.createdAt.slice(0, 10)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">대기 중인 작업 없음</div>
            )}
          </div>
        </div>

        {/* ── 5. 팀 스코어카드 + Discord 에러 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 팀 스코어카드 */}
          {scorecard?.teams && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-zinc-800">🏆 팀 스코어카드</h2>
                {scorecard.lastDecay && (
                  <span className="text-xs text-zinc-400">마지막 감소: {scorecard.lastDecay.slice(0, 10)}</span>
                )}
              </div>
              <div className="space-y-2">
                {Object.entries(scorecard.teams).map(([teamId, info]) => {
                  const statusColor = info.status === 'NORMAL' ? 'text-emerald-600'
                    : info.status === 'WARNING' ? 'text-amber-600'
                    : 'text-red-600';
                  const recentOutcomes = (info.history ?? []).slice(-3);
                  return (
                    <div key={teamId} className="flex items-center gap-3 py-2 border-b border-zinc-50 last:border-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${TEAM_COLOR[teamId] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {TEAM_LABEL[teamId] ?? teamId}
                      </span>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-emerald-600 font-medium">+{info.merit}</span>
                        <span className="text-xs text-red-500 font-medium">-{info.penalty}</span>
                      </div>
                      {/* 최근 의사결정 결과 도트 */}
                      <div className="flex gap-1">
                        {recentOutcomes.map((h, i) => (
                          <span
                            key={i}
                            title={`${h.ts.slice(0, 10)}: ${h.decision.slice(0, 40)}`}
                            className={`inline-block w-2 h-2 rounded-full ${
                              h.outcome === 'success' ? 'bg-emerald-400' :
                              h.outcome === 'skipped' ? 'bg-zinc-300' : 'bg-red-400'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${statusColor}`}>{info.status}</span>
                    </div>
                  );
                })}
              </div>
              {scorecard.thresholds && (
                <div className="text-[10px] text-zinc-400 mt-3">
                  임계값 — 경고: {scorecard.thresholds.warning}, 보호관찰: {scorecard.thresholds.probation}
                </div>
              )}
            </div>
          )}

          {/* Discord 에러 현황 */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-zinc-800">⚠️ Discord 에러 현황</h2>
              <span className="text-xs text-zinc-400">총 {errorTracker?.errors?.length ?? 0}건 누적</span>
            </div>
            {topDiscordErrors.length > 0 ? (
              <>
                <div className="space-y-1.5 mb-3">
                  {topDiscordErrors.map(([msg, cnt]) => {
                    const maxCnt = topDiscordErrors[0]?.[1] ?? 1;
                    return (
                      <div key={msg} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-600 truncate max-w-[78%]">{msg}</span>
                          <span className="font-bold text-red-500 shrink-0 ml-1">{cnt}회</span>
                        </div>
                        <div className="h-1 bg-zinc-100 rounded overflow-hidden">
                          <div className="h-full bg-red-300 rounded" style={{ width: `${(cnt / maxCnt) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(errorTracker?.errors?.length ?? 0) > 0 && (
                  <div className="text-xs text-zinc-400">
                    최근: {new Date((errorTracker!.errors.at(-1)!.timestamp)).toLocaleString('ko-KR')}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-emerald-600">✅ Discord 에러 없음</div>
            )}
          </div>
        </div>

        {/* ── 6. 보드 최근 포스트 (실제 데이터 있을 때만) ── */}
        {totalPosts > 0 && (
          <section className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-zinc-800">📝 보드 최근 포스트</h2>
              <Link href="/" className="text-xs text-indigo-500 hover:underline">전체 {totalPosts}개 →</Link>
            </div>
            <div className="space-y-1">
              {recentPosts.slice(0, 6).map(p => {
                const sc = p.status === 'open' ? 'bg-blue-100 text-blue-700'
                  : p.status === 'in-progress' ? 'bg-amber-100 text-amber-700'
                  : p.status === 'resolved' || p.status === 'concluded' ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-zinc-100 text-zinc-500';
                const sl = { open: '열림', 'in-progress': '진행', resolved: '해결', concluded: '종결' }[p.status] ?? p.status;
                return (
                  <Link key={p.id} href={`/posts/${p.id}`}
                    className="flex items-center gap-3 py-2 border-b border-zinc-50 hover:bg-zinc-50 rounded px-2 -mx-2 transition-colors">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${sc}`}>{sl}</span>
                    <span className="text-sm text-zinc-700 flex-1 truncate">{p.title}</span>
                    <span className="text-xs text-zinc-400 shrink-0">#{p.channel}</span>
                    <span className="text-xs text-zinc-400 shrink-0">💬{p.comment_count}</span>
                    <span className="text-xs text-zinc-400 shrink-0">{p.created_at.slice(5, 10)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

      </main>
      <MobileBottomNav isOwner={isOwner} />
    </div>
  );
}
