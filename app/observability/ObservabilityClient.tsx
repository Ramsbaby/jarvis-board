'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import MobileBottomNav from '@/components/MobileBottomNav';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CronStats {
  todayOk: number; todayFail: number; todayTotal: number; todayRate: number;
  recentFails: Array<{ task: string; time: string; detail: string }>;
  trend: Array<{ date: string; ok: number; fail: number; rate: number }>;
}
interface FsmStats {
  total: number;
  by: Record<string, number>;
  failed: string[];
  skipped: string[];
}
interface DiscordErrors {
  total24h: number; totalAll: number;
  top: Array<{ msg: string; count: number }>;
}
interface HealthStats {
  botStatus: string; memoryMb: number; crashCount: number; lastCheck: string;
}
interface LfPeriod {
  total: number; errors: number; errorRate: number;
  inputTokens: number; outputTokens: number; cost: number;
  avgDurMs: number; p95DurMs: number;
  topModels: Array<{ model: string; count: number }>;
  daily: Array<{ date: string; calls: number; errors: number }>;
}
interface LangfuseData { configured: boolean; healthy?: boolean; week?: LfPeriod; today?: LfPeriod; }

interface PageData {
  langfuse: LangfuseData;
  cron: CronStats;
  fsm: FsmStats;
  discordErrors: DiscordErrors;
  health: HealthStats;
  ts: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('ko-KR');
const dur = (ms: number) => !ms ? '-' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
const usd = (v: number) => !v ? '$0.00' : `$${v.toFixed(v < 0.01 ? 4 : 2)}`;

function timeAgo(iso: string) {
  if (!iso) return '-';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color ?? 'text-zinc-900'}`}>{value}</div>
    </div>
  );
}

function RateBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total ? Math.round(value / total * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-zinc-500 w-20 shrink-0">{label}</div>
      <div className="flex-1 bg-zinc-100 rounded-full h-2">
        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-zinc-500 w-8 text-right tabular-nums">{value}</div>
    </div>
  );
}

interface TrendEntry { date: string; ok?: number; fail?: number; calls?: number; errors?: number; }
function TrendBars({ data }: { data: TrendEntry[] }) {
  if (!data.length) return <div className="text-xs text-zinc-400 py-4 text-center">데이터 없음</div>;
  const getTotal = (d: TrendEntry) => (d.ok ?? d.calls ?? 0) + (d.fail ?? d.errors ?? 0);
  const getFail  = (d: TrendEntry) => d.fail ?? d.errors ?? 0;
  const max = Math.max(...data.map(getTotal), 1);
  return (
    <div className="flex items-end gap-1 h-12 mt-2">
      {data.map(d => {
        const total = getTotal(d);
        const failPct = total ? Math.round(getFail(d) / total * 100) : 0;
        const h = Math.max(4, Math.round((total / max) * 44));
        return (
          <div key={d.date} title={`${d.date}\n성공 ${d.ok} / 실패 ${d.fail}`}
            className="flex-1 flex flex-col items-center gap-0.5 group cursor-default">
            <div className="w-full rounded-t-sm"
              style={{
                height: `${h}px`,
                background: failPct > 0
                  ? `linear-gradient(to top, #f87171 ${failPct}%, #818cf8 0%)`
                  : '#818cf8',
              }} />
            <div className="text-[9px] text-zinc-400">{d.date.slice(8)}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ObservabilityClient({ initialData }: { initialData: PageData | null }) {
  const [data, setData] = useState<PageData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [lastUpdate, setLastUpdate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/langfuse');
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(new Date().toLocaleTimeString('ko-KR'));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!initialData) load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [initialData, load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-zinc-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  const { cron, fsm, discordErrors, health, langfuse, ts } = data ?? {
    cron: { todayOk: 0, todayFail: 0, todayTotal: 0, todayRate: 0, recentFails: [], trend: [] },
    fsm: { total: 0, by: {}, failed: [], skipped: [] },
    discordErrors: { total24h: 0, totalAll: 0, top: [] },
    health: { botStatus: 'unknown', memoryMb: 0, crashCount: 0, lastCheck: '' },
    langfuse: { configured: false },
    ts: '',
  };

  const fsmDone = fsm.by['done'] ?? 0;
  const fsmFailed = fsm.by['failed'] ?? 0;
  const fsmSkipped = fsm.by['skipped'] ?? 0;
  const fsmQueued = (fsm.by['queued'] ?? 0) + (fsm.by['pending'] ?? 0);

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 pb-28 pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-600">← 홈</Link>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">옵저버빌리티</h1>
            <p className="text-xs text-zinc-400 mt-0.5">크론 · 태스크 · Discord · LLM 트레이싱</p>
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-40"
            title="새로고침">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* ── 시스템 상태 스트립 ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {[
            {
              label: 'Discord 봇',
              value: health.botStatus === 'healthy' ? '정상' : health.botStatus,
              ok: health.botStatus === 'healthy',
            },
            {
              label: '크론 성공률',
              value: `${cron.todayRate}%`,
              ok: cron.todayRate >= 80,
            },
            {
              label: 'Discord 에러',
              value: `${discordErrors.total24h}건`,
              ok: discordErrors.total24h === 0,
            },
            {
              label: 'FSM 실패',
              value: `${fsmFailed}개`,
              ok: fsmFailed === 0,
            },
          ].map(({ label, value, ok }) => (
            <div key={label}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm
                ${ok ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <StatusDot ok={ok} />
              <div>
                <div className="text-[10px] text-zinc-400 leading-none mb-0.5">{label}</div>
                <div className={`font-semibold text-sm ${ok ? 'text-emerald-700' : 'text-red-700'}`}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

          {/* ── 크론 오늘 ───────────────────────────────────────────────── */}
          <Card title="크론 태스크 — 오늘"
            badge={<span className="text-xs text-zinc-400">{cron.todayTotal}건 실행</span>}>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="성공" value={String(cron.todayOk)} color="text-emerald-600" />
              <Stat label="실패" value={String(cron.todayFail)} color={cron.todayFail > 0 ? 'text-red-600' : 'text-zinc-400'} />
              <Stat label="성공률" value={`${cron.todayRate}%`}
                color={cron.todayRate >= 90 ? 'text-emerald-600' : cron.todayRate >= 70 ? 'text-amber-600' : 'text-red-600'} />
            </div>
            {cron.recentFails.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">최근 실패</div>
                {cron.recentFails.slice(0, 5).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-red-500 font-medium shrink-0">{f.task}</span>
                    <span className="text-zinc-400 truncate">{f.time.slice(11)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── 크론 7일 트렌드 ─────────────────────────────────────────── */}
          <Card title="크론 7일 트렌드"
            badge={
              <div className="flex gap-2 text-[10px] text-zinc-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-400 inline-block" />성공</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />실패</span>
              </div>
            }>
            <TrendBars data={cron.trend} />
            {cron.trend.length > 0 && (
              <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                <span>7일 평균 성공률 {Math.round(cron.trend.reduce((s, d) => s + d.rate, 0) / cron.trend.length)}%</span>
                <span>총 {cron.trend.reduce((s, d) => s + d.ok + d.fail, 0)}건</span>
              </div>
            )}
          </Card>

          {/* ── FSM 태스크 상태 ──────────────────────────────────────────── */}
          <Card title="FSM 태스크 상태" badge={<span className="text-xs text-zinc-400">전체 {fsm.total}개</span>}>
            <div className="space-y-1.5 mb-3">
              <RateBar value={fsmDone} total={fsm.total} label="완료 done" />
              <RateBar value={fsmQueued} total={fsm.total} label="대기 queued" />
              <RateBar value={fsmFailed} total={fsm.total} label="실패 failed" />
              <RateBar value={fsmSkipped} total={fsm.total} label="차단 skipped" />
            </div>
            {fsm.failed.length > 0 && (
              <div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-1">실패 태스크</div>
                <div className="flex flex-wrap gap-1">
                  {fsm.failed.slice(0, 6).map(id => (
                    <span key={id} className="text-[10px] bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5 font-mono truncate max-w-[140px]">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ── Discord 에러 ─────────────────────────────────────────────── */}
          <Card title="Discord 에러"
            badge={
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                ${discordErrors.total24h === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                24h: {discordErrors.total24h}건
              </span>
            }>
            {discordErrors.top.length === 0 ? (
              <div className="text-sm text-emerald-600 py-2">✅ 최근 24시간 에러 없음</div>
            ) : (
              <div className="space-y-1.5">
                {discordErrors.top.map(({ msg, count }) => (
                  <div key={msg} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-600 truncate font-mono">{msg}</span>
                    <span className="text-xs font-semibold text-red-500 shrink-0">{count}회</span>
                  </div>
                ))}
              </div>
            )}
            {discordErrors.totalAll > 0 && (
              <div className="text-[10px] text-zinc-400 mt-2">전체 누적: {discordErrors.totalAll}건 · 봇 상태: {health.botStatus}</div>
            )}
          </Card>
        </div>

        {/* ── LLM 트레이싱 (Langfuse) ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-700">LLM 트레이싱</h3>
              {langfuse.healthy && (
                <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
                  <StatusDot ok={true} /> Langfuse 연결됨
                </span>
              )}
            </div>
            {langfuse.healthy && (
              <span className="text-[10px] text-zinc-400">
                Mac Mini에서: <code className="bg-zinc-100 px-1 rounded">localhost:3200</code>
              </span>
            )}
          </div>

          {!langfuse.configured && (
            <div className="text-sm text-zinc-400 py-3">
              Langfuse 미설정 —{' '}
              <code className="text-xs bg-zinc-100 rounded px-1">langfuse-ctl.sh setup && start</code>
            </div>
          )}

          {langfuse.configured && !langfuse.healthy && (
            <div className="text-sm text-amber-600 py-3">
              ⚠️ Langfuse 오프라인 — Docker 컨테이너를 확인하세요
            </div>
          )}

          {langfuse.healthy && !langfuse.week?.total && (
            <div className="text-sm text-zinc-400 py-3">
              📭 수집 대기 중 — 다음 번 Jarvis가 LLM을 호출하면 자동으로 기록됩니다.
            </div>
          )}

          {langfuse.week && langfuse.week.total > 0 && (
            <>
              {/* Today vs Week */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-2">오늘</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="호출" value={fmt(langfuse.today?.total ?? 0)} />
                    <Stat label="비용" value={usd(langfuse.today?.cost ?? 0)} />
                    <Stat label="에러율" value={`${langfuse.today?.errorRate ?? 0}%`}
                      color={(langfuse.today?.errorRate ?? 0) > 10 ? 'text-red-600' : 'text-zinc-900'} />
                    <Stat label="평균응답" value={dur(langfuse.today?.avgDurMs ?? 0)} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-2">지난 7일</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="호출" value={fmt(langfuse.week.total)} />
                    <Stat label="비용" value={usd(langfuse.week.cost)} />
                    <Stat label="에러율" value={`${langfuse.week.errorRate}%`}
                      color={langfuse.week.errorRate > 10 ? 'text-red-600' : 'text-zinc-900'} />
                    <Stat label="P95응답" value={dur(langfuse.week.p95DurMs)} />
                  </div>
                </div>
              </div>

              {/* LLM call daily bars */}
              {langfuse.week.daily.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-1">일별 LLM 호출</div>
                  <TrendBars data={langfuse.week.daily} />
                </div>
              )}

              {/* Model distribution */}
              {langfuse.week.topModels.length > 0 && (
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-2">모델 분포</div>
                  <div className="space-y-1">
                    {langfuse.week.topModels.map(m => {
                      const pct = langfuse.week!.total ? Math.round(m.count / langfuse.week!.total * 100) : 0;
                      return (
                        <div key={m.model} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-24 truncate">{m.model}</span>
                          <div className="flex-1 bg-zinc-100 rounded-full h-1.5">
                            <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400 w-10 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-zinc-400 mt-4">
          {lastUpdate ? `업데이트: ${lastUpdate}` : ts ? `업데이트: ${new Date(ts).toLocaleTimeString('ko-KR')}` : ''}
          {' · '}1분마다 자동 갱신
        </div>
      </div>

      <MobileBottomNav isOwner={true} />
    </>
  );
}
