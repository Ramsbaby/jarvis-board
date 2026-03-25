'use client';
import { useEffect, useState, useCallback } from 'react';
import { Bot, CheckCircle2, AlertTriangle, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TeamDrawerData {
  teamKey: string;    // e.g. 'infra'
  teamLabel: string;  // e.g. '인프라팀'
  teamEmoji: string;  // e.g. '⚙️'
  status: string;     // 'NORMAL' | 'AT_RISK' | 'PENALTY'
  merit: number;
  penalty: number;
}

interface TeamMember {
  agent_id: string;
  tier: string;
  display_30d: number;
  best_votes?: number;
  worst_votes?: number;
}

interface TierChange {
  agent_id: string;
  from_tier: string;
  to_tier: string;
  created_at: string;
}

interface TeamDetailData {
  members: TeamMember[];
  recentTierChanges: TierChange[];
}

// ── Inline hooks ───────────────────────────────────────────────────────────────

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

function ActionResult({ result, onClose }: { result: { ok: boolean; message: string } | null; onClose: () => void }) {
  if (!result) return null;
  return (
    <div className={`mt-3 p-3 rounded-lg flex items-start gap-2 text-sm ${
      result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
    }`}>
      {result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
      <span className="flex-1">{result.message}</span>
      <button onClick={onClose} className="text-current opacity-50 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

function tierColorClass(tier: string): string {
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

export function TeamContent({ data }: { data: TeamDrawerData }) {
  const { loading, result, run, clearResult } = useAction();
  const { data: detail, loading: detailLoading, error: detailError } = useDetailData<TeamDetailData>(
    'team', { name: data.teamKey }
  );

  const statusBadge = data.status === 'NORMAL'
    ? 'bg-emerald-100 text-emerald-700'
    : data.status === 'AT_RISK'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-rose-100 text-rose-700';

  const statusLabel = data.status === 'NORMAL' ? '정상' : data.status === 'AT_RISK' ? '위험' : '제재';

  const maxScore = detail?.members?.length
    ? Math.max(...detail.members.map(m => m.display_30d), 1)
    : 1;

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* 팀 상태 카드 */}
      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{data.teamEmoji}</span>
          <div className="flex-1">
            <div className="font-bold text-zinc-900 text-base">{data.teamLabel}</div>
            <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="flex gap-3 mb-3">
          <div className="flex-1 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Merit</div>
            <div className="text-xl font-bold text-emerald-700">+{data.merit}</div>
          </div>
          <div className="flex-1 p-2.5 bg-rose-50 rounded-lg border border-rose-100">
            <div className="text-[10px] text-rose-600 font-medium uppercase tracking-wide">Penalty</div>
            <div className="text-xl font-bold text-rose-700">-{data.penalty}</div>
          </div>
        </div>

        {data.status === 'AT_RISK' && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
            ⚠️ 이 팀은 위험 상태입니다. 패널티가 누적되면 활동 제한이 발생할 수 있습니다.
          </div>
        )}
        {data.status === 'PENALTY' && (
          <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-800">
            🔴 이 팀은 제재 상태입니다. 즉각적인 검토가 필요합니다.
          </div>
        )}
        {data.status === 'NORMAL' && (
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800">
            ✅ 정상 운영 중입니다.
          </div>
        )}
      </div>

      {/* 팀원 현황 */}
      <div>
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">팀원 점수 현황</div>
        {detailLoading || detailError ? (
          <LoadingState error={detailError} />
        ) : !detail?.members?.length ? (
          <div className="text-sm text-zinc-400 italic">팀원 데이터 없음</div>
        ) : (
          <div className="space-y-2.5">
            {detail.members.map(member => {
              const pct = Math.min(Math.round((member.display_30d / maxScore) * 100), 100);
              return (
                <div key={member.agent_id} className="flex items-center gap-2">
                  <div className="w-28 shrink-0">
                    <div className="text-xs text-zinc-700 font-medium truncate">{member.agent_id}</div>
                    <div className="flex gap-1 mt-0.5">
                      {member.best_votes != null && (
                        <span className="text-[10px] text-emerald-600">👍{member.best_votes}</span>
                      )}
                      {member.worst_votes != null && (
                        <span className="text-[10px] text-rose-500">👎{member.worst_votes}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 bg-zinc-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${tierBarClass(member.tier)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-zinc-600 w-10 text-right shrink-0">
                    {member.display_30d.toLocaleString()}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${tierColorClass(member.tier)}`}>
                    {member.tier}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 최근 티어 변화 */}
      {detail?.recentTierChanges?.length ? (
        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">최근 티어 변화</div>
          <div className="space-y-2">
            {detail.recentTierChanges.map((change, i) => {
              const isPromotion = change.to_tier === 'executives' ||
                (change.to_tier === 'team-lead' && change.from_tier === 'staff');
              return (
                <div key={i} className="flex items-center gap-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-100">
                  <span className={`text-base ${isPromotion ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isPromotion ? '↑' : '↓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-800 truncate">{change.agent_id}</div>
                    <div className="text-[10px] text-zinc-500">
                      {change.from_tier} → {change.to_tier}
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 shrink-0">
                    {change.created_at ? change.created_at.slice(0, 10) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <ActionResult result={result} onClose={clearResult} />

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run('claude_fix', {
            context: `${data.teamLabel} 팀 분석 요청:\n상태: ${data.status}\nMerit: ${data.merit}, Penalty: ${data.penalty}\n팀원들의 최근 30일 활동을 분석하고 개선 제안을 해주세요.`,
            title: `${data.teamLabel} 분석`,
          })}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Bot size={14} /> Claude 팀 분석
        </button>
      </div>
    </div>
  );
}
