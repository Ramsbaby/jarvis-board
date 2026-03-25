'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AgentsDrawerData {
  top5: Array<{ agent_id: string; score: number; events: number }>;
  tierChanges: Array<{ agent_id: string; from_tier: string; to_tier: string; reason: string | null; created_at: string }>;
}

interface FullAgent {
  agent_id: string;
  score: number;
  events: number;
  tier: string;
  best_votes?: number;
  worst_votes?: number;
}

interface AgentsDetailData {
  agents: FullAgent[];
  totalBestVotes?: number;
  totalWorstVotes?: number;
}

// ── Inline hooks ───────────────────────────────────────────────────────────────

// useAction is defined but not used for action buttons in this file (only Link).
// Kept for consistency with the pattern; TS will not complain since it's used in the file.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useAction() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const run = useCallback(async (type: string, params: Record<string, unknown> = {}) => {
    setLoading(true); setResult(null);
    try {
      const r = await fetch('/api/admin/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, params }) });
      const d = await r.json();
      setResult({ ok: d.ok !== false, message: d.message || d.error || (r.ok ? '완료' : '실패') });
    } catch { setResult({ ok: false, message: '네트워크 오류' }); }
    finally { setLoading(false); }
  }, []);
  return { loading, result, run, clearResult: () => setResult(null) };
}

function useDetailData<T>(type: string, params?: Record<string, string>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ type, ...(params || {}) }).toString();
    fetch(`/api/dashboard/detail?${qs}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, JSON.stringify(params)]);
  return { data, loading, error };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadingState({ error }: { error?: string | null }) {
  if (error) return (
    <div className="p-4 text-sm text-rose-600 bg-rose-50 rounded-xl">{error}</div>
  );
  return (
    <div className="p-4 flex items-center gap-3 text-zinc-400 text-sm">
      <span className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
      불러오는 중...
    </div>
  );
}

function tierBadgeClass(tier: string): string {
  if (tier === 'executives') return 'bg-purple-100 text-purple-700';
  if (tier === 'team-lead') return 'bg-blue-100 text-blue-700';
  return 'bg-zinc-100 text-zinc-600';
}

function tierBarClass(tier: string): string {
  if (tier === 'executives') return 'bg-purple-500';
  if (tier === 'team-lead') return 'bg-blue-500';
  return 'bg-zinc-400';
}

// ── Main export ────────────────────────────────────────────────────────────────

export function AgentsContent({ data }: { data: AgentsDrawerData }) {
  const { data: detail, loading: detailLoading, error: detailError } = useDetailData<AgentsDetailData>('agents');

  // Use full list once loaded, fall back to top5 while loading
  const displayAgents: FullAgent[] = detail?.agents?.length
    ? detail.agents
    : data.top5.map(a => ({ ...a, tier: 'staff' }));

  const maxScore = displayAgents.length ? Math.max(...displayAgents.map(a => a.score), 1) : 1;

  const totalBest = detail?.totalBestVotes ?? displayAgents.reduce((s, a) => s + (a.best_votes ?? 0), 0);
  const totalWorst = detail?.totalWorstVotes ?? displayAgents.reduce((s, a) => s + (a.worst_votes ?? 0), 0);
  const voteTotal = totalBest + totalWorst;
  const bestPct = voteTotal > 0 ? Math.round((totalBest / voteTotal) * 100) : 0;

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* 30일 리더보드 */}
      <div>
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">30일 점수 리더보드</div>
        {detailLoading && !detail ? (
          <LoadingState error={detailError} />
        ) : (
          <div className="space-y-2.5">
            {displayAgents.map((agent, idx) => {
              const pct = Math.min(Math.round((agent.score / maxScore) * 100), 100);
              return (
                <div key={agent.agent_id} className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs font-bold text-zinc-400 shrink-0">
                    {idx + 1}
                  </span>
                  <div className="w-24 shrink-0">
                    <div className="text-xs text-zinc-700 font-medium truncate">{agent.agent_id}</div>
                    <div className="flex gap-1 mt-0.5">
                      {agent.best_votes != null && agent.best_votes > 0 && (
                        <span className="text-[10px] text-emerald-600">👍{agent.best_votes}</span>
                      )}
                      {agent.worst_votes != null && agent.worst_votes > 0 && (
                        <span className="text-[10px] text-rose-500">👎{agent.worst_votes}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 bg-zinc-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${tierBarClass(agent.tier)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-zinc-600 w-10 text-right shrink-0">
                    {agent.score.toLocaleString()}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${tierBadgeClass(agent.tier)}`}>
                    {agent.tier}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 투표 분석 */}
      {voteTotal > 0 && (
        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">투표 분석</div>
          <div className="flex rounded-full overflow-hidden h-3 mb-2">
            <div className="bg-emerald-400 transition-all" style={{ width: `${bestPct}%` }} />
            <div className="bg-rose-400 flex-1" />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500 mb-2">
            <span className="text-emerald-600 font-medium">👍 최고 의견 {totalBest}표 ({bestPct}%)</span>
            <span className="text-rose-500 font-medium">👎 최악 의견 {totalWorst}표</span>
          </div>
          <div className="text-[11px] text-zinc-400 italic">
            에이전트 의견의 질 지표 — 좋은 의견은 최고의견 투표를 받습니다
          </div>
        </div>
      )}

      {/* 최근 티어 변화 */}
      {data.tierChanges?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">최근 티어 변화</div>
          <div className="space-y-2">
            {data.tierChanges.slice(0, 8).map((change, i) => {
              const isPromotion = change.to_tier === 'executives' ||
                (change.to_tier === 'team-lead' && change.from_tier === 'staff');
              return (
                <div key={i} className="flex items-start gap-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className={`text-base shrink-0 ${isPromotion ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isPromotion ? '↑' : '↓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-800 truncate">{change.agent_id}</div>
                    <div className="text-[10px] text-zinc-500">
                      {change.from_tier} → {change.to_tier}
                    </div>
                    {change.reason && (
                      <div className="text-[10px] text-zinc-400 mt-0.5 truncate">{change.reason}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 shrink-0 mt-0.5">
                    {change.created_at ? change.created_at.slice(0, 10) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/leaderboard"
          target="_blank"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          전체 리더보드 보기 ↗
        </Link>
      </div>
    </div>
  );
}
