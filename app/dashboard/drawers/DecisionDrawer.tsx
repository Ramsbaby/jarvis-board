'use client';
import { useState, useCallback } from 'react';
import { Bot, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';

// ── Inline useAction (will be replaced by ./hooks import on integration) ────────

function useAction() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const run = useCallback(async (type: string, params: Record<string, unknown> = {}) => {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, params }),
      });
      const d = await r.json();
      setResult({ ok: d.ok !== false, message: d.message || d.error || (r.ok ? '완료' : '실패') });
    } catch {
      setResult({ ok: false, message: '네트워크 오류' });
    } finally {
      setLoading(false);
    }
  }, []);
  return { loading, result, run, clearResult: () => setResult(null) };
}

// ── Types ───────────────────────────────────────────────────────────────────────

export interface DecisionEntry {
  ts?: string;
  decision?: string;
  team?: string;
  action?: string;
  status?: string;
  result?: string;
}

export interface DecisionDrawerData {
  decision: DecisionEntry;
  allDecisions?: DecisionEntry[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

type ActionBadgeStyle = { bg: string; text: string };

function actionBadge(action?: string): ActionBadgeStyle {
  switch (action?.toUpperCase()) {
    case 'APPROVED':   return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
    case 'REJECTED':   return { bg: 'bg-rose-100',    text: 'text-rose-700' };
    case 'ESCALATED':  return { bg: 'bg-blue-100',    text: 'text-blue-700' };
    case 'UNMATCHED':  return { bg: 'bg-orange-100',  text: 'text-orange-700' };
    default:           return { bg: 'bg-zinc-100',    text: 'text-zinc-500' };
  }
}

// Cycle through a few distinct colors for team badges based on team name hash
const TEAM_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
  'bg-pink-100 text-pink-700',
  'bg-lime-100 text-lime-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
];

function teamColor(name?: string): string {
  if (!name) return 'bg-zinc-100 text-zinc-500';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TEAM_COLORS[hash % TEAM_COLORS.length];
}

function isAbnormal(entry: DecisionEntry): boolean {
  return entry.action === 'UNMATCHED' || entry.result === 'NEEDS_MANUAL_REVIEW';
}

// ── DecisionContent ─────────────────────────────────────────────────────────────

export function DecisionContent({ data }: { data: DecisionDrawerData }) {
  const { loading, result, run, clearResult } = useAction();
  const [listOpen, setListOpen] = useState(false);
  const { decision, allDecisions } = data;
  const { bg: actionBg, text: actionText } = actionBadge(decision.action);
  const showList = (allDecisions?.length ?? 0) > 1;

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* 1. 의사결정 요약 카드 */}
      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {decision.team && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${teamColor(decision.team)}`}>
              {decision.team}
            </span>
          )}
          <span className="text-[11px] text-zinc-400">{formatTime(decision.ts)}</span>
        </div>
        <p className="text-sm font-medium text-zinc-900 leading-relaxed">
          {decision.decision ?? '(내용 없음)'}
        </p>
      </div>

      {/* 2. 상태 + 액션 타입 */}
      <div className="flex flex-wrap gap-2 items-start">
        {decision.action && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${actionBg} ${actionText}`}>
            {decision.action}
          </span>
        )}
        {decision.status && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600">
            {decision.status}
          </span>
        )}
        {decision.result && (
          <span className="text-xs text-zinc-500 self-center">{decision.result}</span>
        )}
      </div>

      {/* 3. 비정상 감지 */}
      {isAbnormal(decision) && (
        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-orange-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <div className="text-sm font-semibold text-orange-800">
                처리되지 않은 의사결정
              </div>
              <p className="text-xs text-orange-700">
                이 결정이 자동 처리되지 않았습니다. 수동으로 확인이 필요할 수 있습니다.
              </p>
              <p className="text-xs text-orange-600">
                에이전트가 해당 의사결정의 실행 방법을 판단하지 못했습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. 오늘 전체 의사결정 목록 */}
      {showList && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden">
          <button
            onClick={() => setListOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 hover:bg-zinc-100 transition-colors text-sm font-semibold text-zinc-700"
          >
            오늘 전체 의사결정 ({allDecisions!.length}건)
            {listOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {listOpen && (
            <div className="divide-y divide-zinc-100 max-h-64 overflow-y-auto">
              {allDecisions!.map((entry, i) => {
                const { bg, text } = actionBadge(entry.action);
                return (
                  <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                    <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold shrink-0 ${bg} ${text}`}>
                      {entry.action ?? '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      {entry.team && (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium mr-1.5 ${teamColor(entry.team)}`}>
                          {entry.team}
                        </span>
                      )}
                      <span className="text-xs text-zinc-700 leading-relaxed">
                        {entry.decision ?? '—'}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 shrink-0">
                      {formatTime(entry.ts)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action result */}
      {result && (
        <div
          className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
            result.ok
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{result.message}</span>
          <button onClick={clearResult} className="text-current opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 5. 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            run('claude_fix', {
              context: `오늘의 의사결정 분석:\n팀: ${decision.team ?? '—'}\n결정: ${decision.decision ?? '—'}\n결과: ${decision.result ?? '—'}`,
              title: '의사결정 분석',
            })
          }
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Bot size={14} /> Claude에게 분석 요청
        </button>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-400 self-center animate-pulse">
            분석 중...
          </span>
        )}
      </div>
    </div>
  );
}
