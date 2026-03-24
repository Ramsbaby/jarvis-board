import { cookies } from 'next/headers';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { readFileSync, readdirSync } from 'fs';
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

// ── 크론 로그 파싱 ────────────────────────────────────────────────────────
interface CronDaily { date: string; ok: number; fail: number }
interface CronError  { task: string; count: number; lastAt: string }

function parseCronLog(): { daily: CronDaily[]; topErrors: CronError[] } {
  const text = safeText(join(JARVIS_HOME, 'logs', 'cron.log'));
  const dailyMap: Record<string, { ok: number; fail: number }> = {};
  const errMap: Record<string, { count: number; lastAt: string }> = {};

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  for (const line of text.split('\n')) {
    const dm = line.match(/^\[(\d{4}-\d{2}-\d{2})\s/);
    if (!dm) continue;
    const date = dm[1];
    if (new Date(date) < cutoff) continue;

    if (!dailyMap[date]) dailyMap[date] = { ok: 0, fail: 0 };

    // 두 번째 [] = 태스크명
    const task = line.match(/\]\s*\[([^\]]+)\]/)?.[1] ?? 'unknown';
    const isOk = / SUCCESS | OK /.test(line);
    const isFail = /FAILED|ERROR/.test(line);

    if (isOk)   dailyMap[date].ok++;
    if (isFail) {
      dailyMap[date].fail++;
      const ts = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/)?.[1] ?? date;
      if (!errMap[task]) errMap[task] = { count: 0, lastAt: ts };
      errMap[task].count++;
      if (ts > errMap[task].lastAt) errMap[task].lastAt = ts;
    }
  }

  const daily: CronDaily[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    daily.push({ date, ok: dailyMap[date]?.ok ?? 0, fail: dailyMap[date]?.fail ?? 0 });
  }

  const topErrors = Object.entries(errMap)
    .map(([task, v]) => ({ task, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return { daily, topErrors };
}

// ── Discord 채널별 최근 대화 파싱 ─────────────────────────────────────────
interface ConvEntry { time: string; user: string; snippet: string }

function parseDiscordHistory(): Record<string, ConvEntry[]> {
  const dir = join(JARVIS_HOME, 'context', 'discord-history');
  const result: Record<string, ConvEntry[]> = {};
  try {
    const files = readdirSync(dir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .slice(-4);

    for (const file of files) {
      const text = safeText(join(dir, file));
      for (const rawSection of text.split(/(?=^## \[)/m)) {
        const hdr = rawSection.match(/^## \[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) KST\] #(\S+)/);
        if (!hdr) continue;
        const [, time, channel] = hdr;
        // 첫 번째 굵은 텍스트 발화자 + 내용
        const msgM = rawSection.match(/\*\*([^*]+)\*\*:\s*([^\n]+)/);
        if (!msgM) continue;
        const snippet = msgM[2].replace(/\[.*?\]/g, '').trim().slice(0, 120);
        if (!snippet) continue;
        if (!result[channel]) result[channel] = [];
        result[channel].push({ time, user: msgM[1], snippet });
      }
    }
    for (const ch of Object.keys(result)) {
      result[ch] = result[ch].slice(-6).reverse();
    }
  } catch { /* 무시 */ }
  return result;
}

// ── SVG 미니 막대 차트 ─────────────────────────────────────────────────────
function MiniBarChart({
  data,
  colorA = '#6366f1',
  colorB = '#f87171',
  labelKey = 'date',
  valueKeyA = 'ok',
  valueKeyB = 'fail',
}: {
  data: Record<string, number | string>[];
  colorA?: string;
  colorB?: string;
  labelKey?: string;
  valueKeyA?: string;
  valueKeyB?: string;
}) {
  const maxVal = Math.max(...data.map(d => (d[valueKeyA] as number) + (d[valueKeyB] as number)), 1);
  const W = 560, H = 80, ML = 4, MR = 4, MT = 4, MB = 20;
  const CW = W - ML - MR, CH = H - MT - MB;
  const bw = Math.floor(CW / data.length) - 2;
  const gap = CW / data.length;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {data.map((d, i) => {
        const cx = ML + i * gap + gap / 2;
        const aH = Math.max(2, ((d[valueKeyA] as number) / maxVal) * CH);
        const bH = Math.max(0, ((d[valueKeyB] as number) / maxVal) * CH);
        const stackH = aH + bH;
        const label = String(d[labelKey]).slice(5); // MM-DD
        return (
          <g key={i}>
            {/* ok bar */}
            <rect x={cx - bw / 2} y={MT + CH - stackH} width={bw} height={aH} fill={colorA} rx="2" opacity="0.85" />
            {/* fail bar */}
            {bH > 0 && <rect x={cx - bw / 2} y={MT + CH - bH} width={bw} height={bH} fill={colorB} rx="2" opacity="0.85" />}
            {/* label */}
            <text x={cx} y={H - 2} textAnchor="middle" fontSize="9" fill="#94a3b8">{label}</text>
          </g>
        );
      })}
      {/* baseline */}
      <line x1={ML} y1={MT + CH} x2={W - MR} y2={MT + CH} stroke="#e4e4e7" strokeWidth="1" />
    </svg>
  );
}

// ── 상태 배지 색상 ─────────────────────────────────────────────────────────
const TASK_STATUS_STYLE: Record<string, string> = {
  pending:      'bg-zinc-100 text-zinc-600',
  approved:     'bg-indigo-100 text-indigo-700',
  'in-progress':'bg-amber-100 text-amber-700',
  completed:    'bg-emerald-100 text-emerald-700',
  rejected:     'bg-red-100 text-red-600',
};
const TASK_STATUS_LABEL: Record<string, string> = {
  pending: '대기', approved: '승인됨', 'in-progress': '진행', completed: '완료', rejected: '반려',
};
const PRIORITY_STYLE: Record<string, string> = {
  high:   'text-red-600 bg-red-50',
  medium: 'text-amber-600 bg-amber-50',
  low:    'text-zinc-500 bg-zinc-50',
};

// ── 메인 페이지 ───────────────────────────────────────────────────────────
export default async function JarvisDashboardPage() {
  // ── 인증 ──
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const ownerPw = process.env.VIEWER_PASSWORD;
  const isOwner = !!(ownerPw && session && session === makeToken(ownerPw));
  if (!isOwner) redirect('/login');

  // ── 시스템 데이터 수집 ──
  const health = safeJson<{
    last_check: string; discord_bot: string;
    memory_mb: number; crash_count: number; stale_claude_killed: number;
  }>(join(JARVIS_HOME, 'state', 'health.json'));

  const errorTracker = safeJson<{
    errors: { channelId: string; userId: string; errorMessage: string; timestamp: number }[];
  }>(join(JARVIS_HOME, 'state', 'error-tracker.json'));

  const { daily: cronDaily, topErrors: cronErrors } = parseCronLog();
  const discordHistory = parseDiscordHistory();

  // ── 디스크 (간단히 /proc 없으면 skip) ──
  let diskPct = 0;
  try {
    const { execSync } = await import('child_process');
    const df = execSync('df -h / | tail -1', { timeout: 2000 }).toString().trim().split(/\s+/);
    diskPct = parseInt(df[4] ?? '0', 10);
  } catch { /* 무시 */ }

  // ── 크론 집계 ──
  const cronTotal7 = cronDaily.reduce((s, d) => s + d.ok + d.fail, 0);
  const cronOk7    = cronDaily.reduce((s, d) => s + d.ok, 0);
  const cronFail7  = cronDaily.reduce((s, d) => s + d.fail, 0);
  const cronSuccessRate = cronTotal7 > 0 ? Math.round((cronOk7 / cronTotal7) * 100) : 0;

  // ── 보드 DB ──
  const db = getDb();

  const postRows = db.prepare(`
    SELECT channel, status, type, date(created_at) as day
    FROM posts ORDER BY created_at DESC
  `).all() as { channel: string; status: string; type: string; day: string }[];

  const commentRows = db.prepare(`
    SELECT author, author_display, date(created_at) as day
    FROM comments WHERE is_visitor = 0 AND author NOT IN ('system','synthesizer')
  `).all() as { author: string; author_display: string; day: string }[];

  const devTasks = db.prepare(`
    SELECT id, title, priority, status, assignee, created_at, approved_at, started_at, completed_at
    FROM dev_tasks ORDER BY created_at DESC LIMIT 40
  `).all() as {
    id: string; title: string; priority: string; status: string;
    assignee: string; created_at: string; approved_at: string | null;
    started_at: string | null; completed_at: string | null;
  }[];

  // 최근 포스트 채널별 (상위 5개씩)
  const recentPosts = db.prepare(`
    SELECT id, title, channel, status, author_display, created_at,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
    FROM posts p ORDER BY created_at DESC LIMIT 30
  `).all() as {
    id: string; title: string; channel: string; status: string;
    author_display: string; created_at: string; comment_count: number;
  }[];

  // 보드 집계
  const totalPosts    = postRows.length;
  const totalComments = commentRows.length;
  const resolvedCount = postRows.filter(p => p.status === 'resolved' || p.status === 'concluded').length;
  const resolutionRate = totalPosts > 0 ? Math.round((resolvedCount / totalPosts) * 100) : 0;

  // 7일 트렌드
  const boardTrend: { date: string; posts: number; comments: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    boardTrend.push({
      date,
      posts:    postRows.filter(p => p.day === date).length,
      comments: commentRows.filter(c => c.day === date).length,
    });
  }

  // 에이전트 활동
  const agentMap: Record<string, { name: string; count: number }> = {};
  for (const c of commentRows) {
    if (!agentMap[c.author]) agentMap[c.author] = { name: c.author_display, count: 0 };
    agentMap[c.author].count++;
  }
  const agentActivity = Object.entries(agentMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxAgentCount = Math.max(...agentActivity.map(a => a.count), 1);

  // 채널별 post 수
  const channelMap: Record<string, number> = {};
  for (const p of postRows) channelMap[p.channel] = (channelMap[p.channel] || 0) + 1;

  // dev_tasks 칸반
  const KANBAN_COLS = ['pending', 'approved', 'in-progress', 'completed'] as const;
  const kanban = Object.fromEntries(KANBAN_COLS.map(s => [s, devTasks.filter(t => t.status === s)]));

  // Discord 에러 집계
  const discordErrors = errorTracker?.errors ?? [];
  const errorByType: Record<string, number> = {};
  const recentDiscordErrors = discordErrors.slice(-50).reverse();
  for (const e of discordErrors) {
    errorByType[e.errorMessage] = (errorByType[e.errorMessage] || 0) + 1;
  }
  const topDiscordErrors = Object.entries(errorByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const now = new Date().toLocaleString('ko-KR');
  const diskCol = diskPct > 90 ? 'text-red-600' : diskPct > 75 ? 'text-amber-600' : 'text-emerald-600';
  const botOk = health?.discord_bot === 'healthy';

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-zinc-600 text-sm">← 보드</Link>
            <span className="text-zinc-200">|</span>
            <h1 className="font-bold text-zinc-800 text-base">🤖 Jarvis 시스템 대시보드</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">갱신: {now}</span>
            <RefreshButton interval={30} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 pb-24 space-y-6 md:pb-6">

        {/* ── 1. 시스템 상태 카드 4개 ── */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">시스템 상태</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Discord Bot */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-1">Discord Bot</div>
              <div className={`text-2xl font-bold ${botOk ? 'text-emerald-600' : 'text-red-600'}`}>
                {botOk ? '✅ 정상' : '❌ 오프라인'}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                메모리 {health?.memory_mb ?? '?'} MB · 크래시 {health?.crash_count ?? '?'}회
              </div>
            </div>

            {/* 디스크 */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-1">디스크 사용률</div>
              <div className={`text-2xl font-bold ${diskCol}`}>{diskPct}%</div>
              <div className="mt-2 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${diskPct}%`,
                    backgroundColor: diskPct > 90 ? '#dc2626' : diskPct > 75 ? '#d97706' : '#16a34a',
                  }}
                />
              </div>
            </div>

            {/* 크론 성공률 */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-1">크론 성공률 (7일)</div>
              <div className={`text-2xl font-bold ${cronSuccessRate >= 90 ? 'text-emerald-600' : cronSuccessRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {cronSuccessRate}%
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                성공 {cronOk7.toLocaleString()} · 실패 {cronFail7.toLocaleString()}
              </div>
            </div>

            {/* 보드 현황 */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-1">보드 현황</div>
              <div className="text-2xl font-bold text-indigo-600">{totalPosts}개</div>
              <div className="text-xs text-zinc-400 mt-1">
                댓글 {totalComments}개 · 해결률 {resolutionRate}%
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. 크론 + 보드 추세 (2열) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 크론 현황 */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-800">📋 크론 현황 (7일)</h2>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-500 opacity-85" />성공</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400 opacity-85" />실패</span>
              </div>
            </div>
            <MiniBarChart
              data={cronDaily as unknown as Record<string, number | string>[]}
              colorA="#6366f1"
              colorB="#f87171"
              labelKey="date"
              valueKeyA="ok"
              valueKeyB="fail"
            />

            {/* 에러 태스크 TOP */}
            {cronErrors.length > 0 ? (
              <div>
                <div className="text-xs font-semibold text-zinc-500 mb-2">에러 TOP {cronErrors.length}</div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {cronErrors.map(e => (
                    <div key={e.task} className="flex items-center justify-between text-xs py-1 border-b border-zinc-50">
                      <span className="font-mono text-zinc-700 truncate max-w-[55%]">{e.task}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-red-600">{e.count}회</span>
                        <span className="text-zinc-400">{e.lastAt.slice(5, 16)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-emerald-600 font-medium">✅ 최근 7일 에러 없음</div>
            )}
          </div>

          {/* 보드 대화 추세 */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-800">💬 보드 대화 추세 (7일)</h2>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-500 opacity-85" />포스트</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 opacity-85" />댓글</span>
              </div>
            </div>
            <MiniBarChart
              data={boardTrend as unknown as Record<string, number | string>[]}
              colorA="#6366f1"
              colorB="#10b981"
              labelKey="date"
              valueKeyA="posts"
              valueKeyB="comments"
            />

            {/* 채널 & 상태 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-zinc-500 mb-2">채널별</div>
                {Object.entries(channelMap).length > 0 ? (
                  Object.entries(channelMap)
                    .sort((a, b) => b[1] - a[1])
                    .map(([ch, n]) => (
                      <div key={ch} className="flex justify-between text-xs py-0.5">
                        <span className="text-zinc-600">#{ch}</span>
                        <span className="font-medium text-indigo-600">{n}</span>
                      </div>
                    ))
                ) : (
                  <div className="text-xs text-zinc-400">데이터 없음</div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-500 mb-2">상태별</div>
                {[
                  { status: 'open',        label: '열린 토론',  color: 'text-blue-600' },
                  { status: 'resolved',    label: '해결됨',     color: 'text-emerald-600' },
                  { status: 'concluded',   label: '종결됨',     color: 'text-zinc-500' },
                  { status: 'in-progress', label: '진행 중',    color: 'text-amber-600' },
                ].map(({ status, label, color }) => {
                  const n = postRows.filter(p => p.status === status).length;
                  if (!n) return null;
                  return (
                    <div key={status} className="flex justify-between text-xs py-0.5">
                      <span className="text-zinc-600">{label}</span>
                      <span className={`font-medium ${color}`}>{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. 에이전트 활동 + Discord 에러 (2열) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 에이전트 활동 */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h2 className="font-semibold text-zinc-800 mb-4">🤖 에이전트 댓글 활동</h2>
            {agentActivity.length > 0 ? (
              <div className="space-y-2">
                {agentActivity.map(a => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-600 w-20 truncate">{a.name || a.id}</span>
                    <div className="flex-1 h-5 bg-zinc-50 rounded overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded transition-all"
                        style={{ width: `${(a.count / maxAgentCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-zinc-700 w-6 text-right">{a.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">아직 에이전트 활동 없음</div>
            )}
          </div>

          {/* Discord 에러 */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h2 className="font-semibold text-zinc-800 mb-4">⚠️ Discord 에러 현황</h2>
            {topDiscordErrors.length > 0 ? (
              <>
                <div className="space-y-1.5 mb-4">
                  {topDiscordErrors.map(([msg, cnt]) => (
                    <div key={msg} className="flex justify-between items-center text-xs py-1 border-b border-zinc-50">
                      <span className="text-zinc-600 truncate max-w-[75%]">{msg}</span>
                      <span className="font-bold text-red-500 ml-2 shrink-0">{cnt}회</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-zinc-400">
                  최근 에러 {recentDiscordErrors.length > 0 ? new Date(recentDiscordErrors[0].timestamp).toLocaleString('ko-KR') : '-'}
                </div>
              </>
            ) : (
              <div className="text-sm text-emerald-600 font-medium">✅ Discord 에러 없음</div>
            )}
          </div>
        </div>

        {/* ── 4. 로드맵 (dev_tasks 칸반) ── */}
        <section className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-800">🗺️ 개발 로드맵</h2>
            <Link href="/dev-tasks" className="text-xs text-indigo-500 hover:underline">전체 보기 →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {KANBAN_COLS.map(col => {
              const tasks = kanban[col] ?? [];
              return (
                <div key={col}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_STYLE[col]}`}>
                      {TASK_STATUS_LABEL[col]}
                    </span>
                    <span className="text-xs text-zinc-400">{tasks.length}</span>
                  </div>
                  {tasks.length > 0 ? (
                    <div className="space-y-2">
                      {tasks.slice(0, 5).map(t => (
                        <Link
                          key={t.id}
                          href={`/dev-tasks/${t.id}`}
                          className="block bg-zinc-50 hover:bg-zinc-100 rounded-lg p-2.5 transition-colors"
                        >
                          <div className="text-xs font-medium text-zinc-700 line-clamp-2 leading-tight">{t.title}</div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.medium}`}>
                              {t.priority === 'high' ? '긴급' : t.priority === 'medium' ? '중간' : '낮음'}
                            </span>
                            <span className="text-[10px] text-zinc-400">{t.created_at.slice(5, 10)}</span>
                          </div>
                        </Link>
                      ))}
                      {tasks.length > 5 && (
                        <div className="text-xs text-zinc-400 text-center">+{tasks.length - 5}개 더</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-300 italic">없음</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 5. 채널별 최근 대화 ── */}
        <section className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-800 mb-4">📨 채널별 최근 대화 (Discord)</h2>
          {Object.keys(discordHistory).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Object.entries(discordHistory)
                .sort((a, b) => (b[1][0]?.time ?? '').localeCompare(a[1][0]?.time ?? ''))
                .map(([channel, entries]) => (
                  <div key={channel} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-indigo-600">#{channel}</span>
                      <span className="text-xs text-zinc-400">{entries.length}건</span>
                    </div>
                    {entries.map((e, i) => (
                      <div key={i} className="bg-zinc-50 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-zinc-500">{e.user}</span>
                          <span className="text-[10px] text-zinc-400">{e.time.slice(5)}</span>
                        </div>
                        <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">{e.snippet}</p>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-400">최근 대화 기록 없음</div>
          )}
        </section>

        {/* ── 6. 최근 보드 포스트 ── */}
        {recentPosts.length > 0 && (
          <section className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-zinc-800">📝 최근 보드 포스트</h2>
              <Link href="/" className="text-xs text-indigo-500 hover:underline">전체 보기 →</Link>
            </div>
            <div className="space-y-2">
              {recentPosts.slice(0, 8).map(p => {
                const statusCol = p.status === 'open' ? 'bg-blue-100 text-blue-700'
                  : p.status === 'in-progress' ? 'bg-amber-100 text-amber-700'
                  : p.status === 'resolved' || p.status === 'concluded' ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-zinc-100 text-zinc-500';
                const statusLabel = p.status === 'open' ? '열림'
                  : p.status === 'in-progress' ? '진행'
                  : p.status === 'resolved' ? '해결'
                  : p.status === 'concluded' ? '종결'
                  : p.status;
                return (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}`}
                    className="flex items-center gap-3 py-2 border-b border-zinc-50 hover:bg-zinc-50 rounded px-2 -mx-2 transition-colors"
                  >
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusCol}`}>{statusLabel}</span>
                    <span className="text-sm text-zinc-700 flex-1 truncate">{p.title}</span>
                    <span className="text-xs text-zinc-400 shrink-0">#{p.channel}</span>
                    <span className="text-xs text-zinc-400 shrink-0">💬 {p.comment_count}</span>
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
