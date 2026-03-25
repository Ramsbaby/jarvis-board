'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TaskDrawerData {
  id: string;
  title: string;
  priority: string;  // 'urgent' | 'high' | 'medium' | 'low'
  status: string;    // 'awaiting_approval' | 'approved' | 'in-progress' | 'done' | 'failed' | 'rejected'
  detail?: string;
  expected_impact?: string | null;
  created_at?: string;
}

interface TaskDetail {
  task: {
    id: string; title: string; detail: string; priority: string; status: string;
    assignee: string; source: string; post_title: string; group_id: string | null;
    depends_on: string; execution_log: string; attempt_history: string;
    expected_impact: string | null; actual_impact: string | null;
    estimated_minutes: number | null; difficulty: string | null;
    changed_files: string; created_at: string; approved_at: string | null;
    started_at: string | null; completed_at: string | null;
    rejection_note: string | null; result_summary: string | null;
  } | null;
  siblings: Array<{ id: string; title: string; status: string; priority: string }>;
  logEntries: Array<{ time: string; message: string }>;
  attemptHistory: Array<{ attempt: number; timestamp: string; previous_status: string; rejection_note: string | null }>;
  dependsOnIds: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatLogTime(timeStr: string): string {
  // Handles ISO or HH:mm:ss-like strings
  try {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  } catch { /* fallback */ }
  return timeStr.slice(0, 8);
}

function priorityBadge(priority: string): { bg: string; text: string; label: string } {
  switch (priority) {
    case 'urgent': return { bg: 'bg-red-100',    text: 'text-red-700',    label: '긴급' };
    case 'high':   return { bg: 'bg-orange-100', text: 'text-orange-700', label: '높음' };
    case 'medium': return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '보통' };
    case 'low':    return { bg: 'bg-zinc-100',   text: 'text-zinc-500',   label: '낮음' };
    default:       return { bg: 'bg-zinc-100',   text: 'text-zinc-500',   label: priority };
  }
}

function statusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'awaiting_approval': return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '검토대기' };
    case 'approved':          return { bg: 'bg-blue-100',   text: 'text-blue-700',   label: '승인됨' };
    case 'in-progress':       return { bg: 'bg-blue-100',   text: 'text-blue-700',   label: '진행중' };
    case 'done':              return { bg: 'bg-emerald-100',text: 'text-emerald-700', label: '완료' };
    case 'failed':            return { bg: 'bg-red-100',    text: 'text-red-700',    label: '실패' };
    case 'rejected':          return { bg: 'bg-zinc-100',   text: 'text-zinc-500',   label: '반려' };
    default:                  return { bg: 'bg-zinc-100',   text: 'text-zinc-500',   label: status };
  }
}

function siblingDot(status: string): string {
  switch (status) {
    case 'done':              return 'bg-emerald-500';
    case 'failed':            return 'bg-red-500';
    case 'in-progress':       return 'bg-blue-500';
    case 'awaiting_approval': return 'bg-yellow-400';
    default:                  return 'bg-zinc-400';
  }
}

// ── TaskContent ──────────────────────────────────────────────────────────────

export function TaskContent({
  data,
  onStatusChange,
}: {
  data: TaskDrawerData;
  onStatusChange?: (id: string, status: string) => void;
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [logExpanded, setLogExpanded] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Current status tracks local updates after approve/reject
  const [currentStatus, setCurrentStatus] = useState(data.status);

  // Lazy load detail
  useEffect(() => {
    setDetailLoading(true);
    setDetailError(null);
    fetch(`/api/dashboard/detail?type=task&id=${encodeURIComponent(data.id)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setDetail(d); setDetailLoading(false); })
      .catch(e => { setDetailError(String(e)); setDetailLoading(false); });
  }, [data.id]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dev-tasks/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'approved' }),
      });
      if (res.ok) {
        setActionResult({ ok: true, message: '승인됐습니다. 에이전트가 곧 실행을 시작합니다.' });
        setCurrentStatus('approved');
        onStatusChange?.(data.id, 'approved');
      } else {
        const d = await res.json();
        setActionResult({ ok: false, message: d.error || '승인 실패' });
      }
    } catch { setActionResult({ ok: false, message: '네트워크 오류' }); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dev-tasks/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'rejected', rejection_note: rejectNote || undefined }),
      });
      if (res.ok) {
        setActionResult({ ok: true, message: '반려됐습니다.' });
        setCurrentStatus('rejected');
        onStatusChange?.(data.id, 'rejected');
      } else {
        const d = await res.json();
        setActionResult({ ok: false, message: d.error || '반려 실패' });
      }
    } catch { setActionResult({ ok: false, message: '네트워크 오류' }); }
    finally { setActionLoading(false); }
  };

  const task = detail?.task ?? null;
  const logEntries = detail?.logEntries ?? [];
  const siblings = detail?.siblings ?? [];
  const attemptHistory = detail?.attemptHistory ?? [];
  const visibleLogs = logExpanded ? logEntries : logEntries.slice(-5);

  const pBadge = priorityBadge(data.priority);
  const sBadge = statusBadge(currentStatus);

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* 1. 태스크 헤더 */}
      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
        <p className="text-base font-bold text-zinc-900 leading-snug mb-3">
          {data.title}
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pBadge.bg} ${pBadge.text}`}>
            {pBadge.label}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sBadge.bg} ${sBadge.text}`}>
            {sBadge.label}
          </span>
          {data.created_at && (
            <span className="text-[11px] text-zinc-400">{formatDateTime(data.created_at)}</span>
          )}
        </div>
      </div>

      {/* 2. 태스크 상세 (lazy-loaded) */}
      {detailLoading && (
        <div className="flex items-center gap-3 text-zinc-400 text-sm">
          <span className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          불러오는 중...
        </div>
      )}
      {detailError && (
        <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded-xl border border-rose-100">
          {detailError}
        </div>
      )}
      {task && (
        <div className="flex flex-col gap-3">
          {/* detail text */}
          {task.detail && (
            <div className="p-3 bg-zinc-100 rounded-lg text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
              {task.detail}
            </div>
          )}

          {/* expected_impact */}
          {task.expected_impact && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
              <span className="font-semibold">예상 영향: </span>{task.expected_impact}
            </div>
          )}

          {/* difficulty + estimated_minutes */}
          {(task.difficulty || task.estimated_minutes != null) && (
            <div className="text-xs text-zinc-500">
              {task.difficulty && <span>난이도: {task.difficulty}</span>}
              {task.difficulty && task.estimated_minutes != null && <span className="mx-1.5">·</span>}
              {task.estimated_minutes != null && <span>예상 소요: {task.estimated_minutes}분</span>}
            </div>
          )}

          {/* assignee */}
          {task.assignee && (
            <div className="text-xs text-zinc-500">
              담당자: <span className="font-medium text-zinc-700">{task.assignee}</span>
            </div>
          )}

          {/* post_title */}
          {task.post_title && (
            <div className="text-xs text-zinc-500">
              연결된 토론: <span className="font-medium text-zinc-700">{task.post_title}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. 실행 로그 */}
      {logEntries.length > 0 && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
              실행 로그 ({logEntries.length}건)
            </span>
            {logEntries.length > 5 && (
              <button
                onClick={() => setLogExpanded(v => !v)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {logExpanded ? <><ChevronUp size={13} /> 접기</> : <><ChevronDown size={13} /> 전체 보기</>}
              </button>
            )}
          </div>
          <div className="bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed space-y-0.5 max-h-52 overflow-y-auto">
            {visibleLogs.map((entry, i) => {
              const isError = /fail|error|exception/i.test(entry.message);
              return (
                <div key={i} className={`flex gap-2 ${isError ? 'text-rose-400' : 'text-zinc-400'}`}>
                  <span className="shrink-0 text-zinc-600">{formatLogTime(entry.time)}</span>
                  <span>{entry.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. 형제 태스크 */}
      {siblings.length > 0 && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50">
            <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
              같은 그룹의 태스크 ({siblings.length}건)
            </span>
          </div>
          <div className="divide-y divide-zinc-100">
            {siblings.map(sib => {
              const sp = priorityBadge(sib.priority);
              return (
                <div key={sib.id} className="px-4 py-2.5 flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${siblingDot(sib.status)}`} />
                  <span className="text-xs text-zinc-700 flex-1 truncate">{sib.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold shrink-0 ${sp.bg} ${sp.text}`}>
                    {sp.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. 재시도 이력 */}
      {attemptHistory.length > 0 && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50">
            <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
              재시도 이력 ({attemptHistory.length}회)
            </span>
          </div>
          <div className="divide-y divide-zinc-100">
            {attemptHistory.map((attempt, i) => (
              <div key={i} className="px-4 py-2.5 text-xs text-zinc-600">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-zinc-700">{attempt.attempt}회차</span>
                  <span className="text-zinc-400">{formatDateTime(attempt.timestamp)}</span>
                  <span className="text-zinc-500">이전 상태: {attempt.previous_status}</span>
                </div>
                {attempt.rejection_note && (
                  <div className="text-zinc-500 pl-1 border-l-2 border-zinc-200 ml-1 mt-1">
                    반려 사유: {attempt.rejection_note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. 승인/반려 섹션 (awaiting_approval만) */}
      {currentStatus === 'awaiting_approval' && (
        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <div className="text-sm font-bold text-yellow-800 mb-3">⚡ 지금 바로 처리</div>

          <textarea
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder="반려 사유 (선택 입력)"
            rows={2}
            className="w-full px-3 py-2 text-sm bg-white border border-yellow-200 rounded-lg resize-none placeholder-zinc-400 text-zinc-800 focus:outline-none focus:border-yellow-400 mb-3"
          />

          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              ✓ 승인
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              ✕ 반려
            </button>
            {actionLoading && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400 self-center animate-pulse">
                처리 중...
              </span>
            )}
          </div>
        </div>
      )}

      {/* 액션 결과 */}
      {actionResult && (
        <div
          className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
            actionResult.ok
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {actionResult.ok
            ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          }
          <span className="flex-1">{actionResult.message}</span>
          <button onClick={() => setActionResult(null)} className="text-current opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
