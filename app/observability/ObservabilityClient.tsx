'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import MobileBottomNav from '@/components/MobileBottomNav';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LfPeriod {
  total: number; errors: number; errorRate: number;
  inputTokens: number; outputTokens: number; cost: number;
  avgDurMs: number; p95DurMs: number;
  topModels: Array<{ model: string; count: number }>;
  topTasks: Array<{ name: string; calls: number; cost: number }>;
  daily: Array<{ date: string; calls: number; errors: number }>;
}
interface LangfuseData {
  configured: boolean; healthy?: boolean;
  week?: LfPeriod; today?: LfPeriod;
}
interface PageData { langfuse: LangfuseData; ts: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('ko-KR');
const dur = (ms: number) => !ms ? '-' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
const usd = (v: number) => !v ? '$0.00' : `$${v.toFixed(v < 0.01 ? 4 : 2)}`;

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

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color ?? 'text-zinc-900'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-400">{sub}</div>}
    </div>
  );
}

function CallBars({ data }: { data: Array<{ date: string; calls: number; errors: number }> }) {
  if (!data.length) return <div className="text-xs text-zinc-400 py-4 text-center">데이터 없음</div>;
  const max = Math.max(...data.map(d => d.calls), 1);
  return (
    <div className="flex items-end gap-1 h-14 mt-2">
      {data.map(d => {
        const errPct = d.calls ? Math.round(d.errors / d.calls * 100) : 0;
        const h = Math.max(3, Math.round((d.calls / max) * 52));
        return (
          <div key={d.date} title={`${d.date}\n호출 ${d.calls} / 에러 ${d.errors}`}
            className="flex-1 flex flex-col items-center gap-0.5 cursor-default">
            <div className="w-full rounded-t-sm"
              style={{
                height: `${h}px`,
                background: errPct > 0
                  ? `linear-gradient(to top, #f87171 ${errPct}%, #818cf8 0%)`
                  : '#818cf8',
              }} />
            <div className="text-[9px] text-zinc-400">{d.date.slice(8)}</div>
          </div>
        );
      })}
    </div>
  );
}

function TokenBar({ input, output }: { input: number; output: number }) {
  const total = input + output;
  if (!total) return <div className="text-xs text-zinc-400">토큰 없음</div>;
  const inPct = Math.round(input / total * 100);
  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded-full overflow-hidden">
        <div className="bg-indigo-400 transition-all" style={{ width: `${inPct}%` }} />
        <div className="bg-emerald-400 flex-1" />
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-indigo-400" />
          입력 {fmt(input)} ({inPct}%)
        </span>
        <span className="flex items-center gap-1">
          출력 {fmt(output)} ({100 - inPct}%)
          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-400" />
        </span>
      </div>
    </div>
  );
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
      if (!res.ok) return;
      setData(await res.json());
      setLastUpdate(new Date().toLocaleTimeString('ko-KR'));
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

  const { langfuse, ts } = data ?? { langfuse: { configured: false }, ts: '' };
  const w = langfuse.week;
  const t = langfuse.today;
  const hasData = !!(w && w.total > 0);

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 pb-28 pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-600">← 홈</Link>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">LLM 옵저버빌리티</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              비용 · 토큰 · 레이턴시 · 에러율 · 모델 분포
              {' · '}
              <Link href="/dashboard" className="hover:text-zinc-600 underline underline-offset-2">시스템 상태는 대시보드 →</Link>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {langfuse.healthy && (
              <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full font-medium">
                Langfuse ●
              </span>
            )}
            <button onClick={load} disabled={loading}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-40"
              title="새로고침">
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Not configured ──────────────────────────────────────────── */}
        {!langfuse.configured && (
          <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-6 text-center space-y-3">
            <div className="text-4xl">🔭</div>
            <p className="text-sm font-semibold text-zinc-700">Langfuse 미설정</p>
            <p className="text-xs text-zinc-500">LLM 호출 트레이싱을 시작하려면 Langfuse를 설정하세요.</p>
            <code className="block text-xs bg-white border border-zinc-200 rounded-lg px-4 py-2 font-mono text-zinc-600 max-w-xs mx-auto">
              langfuse-ctl.sh setup &amp;&amp; start
            </code>
            <p className="text-[11px] text-zinc-400">
              설정 후 <code className="bg-zinc-100 px-1 rounded">.env.local</code>에 키를 추가하고 보드를 재시작하면 이 페이지가 활성화됩니다.
            </p>
          </div>
        )}

        {/* ── Offline ─────────────────────────────────────────────────── */}
        {langfuse.configured && !langfuse.healthy && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
            ⚠️ Langfuse 오프라인 — Mac Mini에서{' '}
            <code className="text-xs bg-amber-100 rounded px-1">langfuse-ctl.sh start</code> 를 실행해 Docker 컨테이너를 시작하세요.
          </div>
        )}

        {/* ── No traces yet ───────────────────────────────────────────── */}
        {langfuse.healthy && !hasData && (
          <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-6 text-center space-y-2">
            <div className="text-4xl">📭</div>
            <p className="text-sm font-semibold text-zinc-700">아직 LLM 데이터가 없습니다</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Jarvis가 다음 번 LLM(Claude / GPT)을 호출하면 비용, 토큰, 레이턴시가 자동으로 기록됩니다.
            </p>
            <p className="text-[11px] text-zinc-400 pt-1">
              수동 테스트: <code className="bg-zinc-100 px-1 rounded">{'llm-gateway.sh "테스트 메시지"'}</code>
            </p>
          </div>
        )}

        {/* ── Data available ──────────────────────────────────────────── */}
        {hasData && (
          <>
            {/* Today quick-stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {[
                { label: '오늘 호출', value: fmt(t?.total ?? 0) },
                { label: '오늘 비용', value: usd(t?.cost ?? 0) },
                { label: '오늘 에러율', value: `${t?.errorRate ?? 0}%`,
                  warn: (t?.errorRate ?? 0) > 10 },
                { label: '평균 응답', value: dur(t?.avgDurMs ?? 0) },
              ].map(({ label, value, warn }) => (
                <div key={label}
                  className={`rounded-xl border px-3 py-2.5
                    ${warn ? 'bg-red-50 border-red-100' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="text-[10px] text-zinc-400 leading-none mb-0.5">{label}</div>
                  <div className={`font-bold text-lg tabular-nums ${warn ? 'text-red-600' : 'text-zinc-900'}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

              {/* ── 주간 요약 ────────────────────────────────────────────── */}
              <Card title="7일 요약"
                badge={<span className="text-xs text-zinc-400">{w!.total}건</span>}>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="총 호출" value={fmt(w!.total)} />
                  <Stat label="총 비용" value={usd(w!.cost)} />
                  <Stat label="에러율" value={`${w!.errorRate}%`}
                    color={w!.errorRate > 10 ? 'text-red-600' : 'text-zinc-900'} />
                  <Stat label="P95 응답" value={dur(w!.p95DurMs)} />
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium mb-2">토큰 분포</div>
                  <TokenBar input={w!.inputTokens} output={w!.outputTokens} />
                  <div className="text-[10px] text-zinc-400 mt-1 text-right">
                    총 {fmt(w!.inputTokens + w!.outputTokens)} 토큰
                  </div>
                </div>
              </Card>

              {/* ── 모델 분포 ────────────────────────────────────────────── */}
              <Card title="모델 분포 (7일)"
                badge={<span className="text-xs text-zinc-400">{w!.topModels.length}종</span>}>
                {w!.topModels.length === 0 ? (
                  <div className="text-xs text-zinc-400 py-2">없음</div>
                ) : (
                  <div className="space-y-2">
                    {w!.topModels.map(m => {
                      const pct = w!.total ? Math.round(m.count / w!.total * 100) : 0;
                      return (
                        <div key={m.model} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600 w-20 truncate font-medium">{m.model}</span>
                          <div className="flex-1 bg-zinc-100 rounded-full h-2">
                            <div className="bg-indigo-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400 w-16 text-right tabular-nums">{m.count}건 ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* ── 일별 호출 트렌드 ───────────────────────────────────────── */}
            <Card title="일별 LLM 호출 (7일)"
              badge={
                <div className="flex gap-2 text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-400 inline-block" />정상</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />에러</span>
                </div>
              }>
              <CallBars data={w!.daily} />
              {w!.daily.length > 0 && (
                <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                  <span>일평균 {Math.round(w!.total / Math.max(w!.daily.length, 1))}건</span>
                  <span>7일 에러 총 {w!.errors}건</span>
                </div>
              )}
            </Card>

            {/* ── 태스크별 비용 ────────────────────────────────────────────── */}
            {w!.topTasks && w!.topTasks.length > 0 && (
              <div className="mt-4">
                <Card title="비용 상위 태스크 (7일)"
                  badge={<span className="text-xs text-zinc-400">Top {w!.topTasks.length}</span>}>
                  <div className="space-y-2">
                    {w!.topTasks.map(task => {
                      const maxCost = w!.topTasks[0]?.cost ?? 1;
                      const pct = maxCost ? Math.round(task.cost / maxCost * 100) : 0;
                      return (
                        <div key={task.name} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600 w-36 truncate font-mono">{task.name}</span>
                          <div className="flex-1 bg-zinc-100 rounded-full h-2">
                            <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400 w-20 text-right tabular-nums">
                            {usd(task.cost)} / {task.calls}건
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center text-[11px] text-zinc-400 mt-4 space-x-1">
          <span>{lastUpdate ? `업데이트: ${lastUpdate}` : ts ? `업데이트: ${new Date(ts).toLocaleTimeString('ko-KR')}` : ''}</span>
          <span>·</span>
          <span>1분마다 자동 갱신</span>
          {langfuse.healthy && (
            <>
              <span>·</span>
              <span>Mac Mini에서: <code className="bg-zinc-100 px-1 rounded">localhost:3200</code></span>
            </>
          )}
        </div>
      </div>

      <MobileBottomNav isOwner={true} />
    </>
  );
}
