'use client';
import { useState } from 'react';

interface DevTask {
  id: string;
  title: string;
  detail: string;
  priority: string;
  source: string;
  assignee: string;
  status: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
}

const PRIORITY_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  urgent: { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',         label: '긴급' },
  high:   { dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: '높음' },
  medium: { dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200',       label: '중간' },
  low:    { dot: 'bg-zinc-300',   badge: 'bg-zinc-50 text-zinc-500 border-zinc-200',       label: '낮음' },
};

const STATUS_TABS = [
  { key: 'all',               label: '전체' },
  { key: 'awaiting_approval', label: '승인 대기' },
  { key: 'approved',          label: '승인됨' },
  { key: 'in-progress',       label: '진행중' },
  { key: 'pending',           label: '대기' },
  { key: 'done',              label: '완료' },
  { key: 'rejected',          label: '반려' },
] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}분 전`;
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function DevTasksClient({ initialTasks }: { initialTasks: DevTask[] }) {
  const [tasks, setTasks] = useState<DevTask[]>(initialTasks);
  const [tab, setTab] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleAction(taskId: string, status: 'approved' | 'rejected') {
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/dev-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setTasks(prev => prev.map(t => t.id === taskId ? {
          ...t,
          status,
          approved_at: status === 'approved' ? now : t.approved_at,
          rejected_at: status === 'rejected' ? now : t.rejected_at,
        } : t));
      }
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  }

  const awaiting   = tasks.filter(t => t.status === 'awaiting_approval');
  const inProgress = tasks.filter(t => t.status === 'in-progress');
  const approved   = tasks.filter(t => t.status === 'approved');
  const pending    = tasks.filter(t => t.status === 'pending');
  const done       = tasks.filter(t => t.status === 'done');
  const rejected   = tasks.filter(t => t.status === 'rejected');

  const countMap: Record<string, number> = {
    all: tasks.length,
    awaiting_approval: awaiting.length,
    approved: approved.length,
    'in-progress': inProgress.length,
    pending: pending.length,
    done: done.length,
    rejected: rejected.length,
  };

  const filtered = tab === 'all' ? tasks :
    tab === 'awaiting_approval' ? awaiting :
    tab === 'approved'          ? approved :
    tab === 'in-progress'       ? inProgress :
    tab === 'pending'           ? pending :
    tab === 'done'              ? done :
    rejected;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`bg-white border rounded-xl p-4 ${awaiting.length > 0 ? 'border-amber-300 shadow-sm shadow-amber-100' : 'border-zinc-200'}`}>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">승인 대기</p>
          <p className={`text-3xl font-bold ${awaiting.length > 0 ? 'text-amber-600' : 'text-zinc-300'}`}>{awaiting.length}</p>
          {awaiting.length > 0 && <p className="text-[10px] text-amber-500 mt-1">즉시 검토 필요</p>}
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">진행중</p>
          <p className="text-3xl font-bold text-indigo-600">{inProgress.length}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">완료</p>
          <p className="text-3xl font-bold text-emerald-600">{done.length}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">반려</p>
          <p className="text-3xl font-bold text-zinc-400">{rejected.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-zinc-200 pb-0 -mb-1">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors relative -mb-px ${
              tab === t.key
                ? 'text-indigo-600 border border-zinc-200 border-b-white bg-white'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
            {countMap[t.key] > 0 && (
              <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded-full font-bold ${
                t.key === 'awaiting_approval' ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {countMap[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm">해당 상태의 태스크가 없습니다</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const cfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.low;
            const isWaiting = task.status === 'awaiting_approval';
            const isLoading = actionLoading === task.id;

            return (
              <div
                key={task.id}
                className={`bg-white rounded-xl border overflow-hidden transition-shadow ${
                  isWaiting ? 'border-amber-200 shadow-sm shadow-amber-50' : 'border-zinc-200'
                }`}
              >
                {/* Status stripe */}
                {isWaiting && (
                  <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-400" />
                )}
                {task.status === 'in-progress' && (
                  <div className="h-1 w-full bg-gradient-to-r from-indigo-400 to-violet-400" />
                )}
                {task.status === 'done' && (
                  <div className="h-1 w-full bg-emerald-400" />
                )}
                {task.status === 'rejected' && (
                  <div className="h-1 w-full bg-zinc-300" />
                )}

                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-900 leading-snug">{task.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${cfg.badge}`}>{cfg.label}</span>
                        {task.assignee && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 text-zinc-500">
                            {task.assignee}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-400">{timeAgo(task.created_at)}</span>
                        {task.status === 'awaiting_approval' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-600 font-medium">⏳ 승인 대기</span>
                        )}
                        {task.status === 'in-progress' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-600 font-medium">⚙ 진행중</span>
                        )}
                        {task.status === 'done' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 font-medium">✓ 완료</span>
                        )}
                        {task.status === 'rejected' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-400 font-medium">✕ 반려됨</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detail */}
                  {task.detail && (
                    <div className={`text-xs text-zinc-600 leading-relaxed rounded-lg p-3 mb-3 ${
                      isWaiting ? 'bg-amber-50/60 border border-amber-100' : 'bg-zinc-50 border border-zinc-100'
                    }`}>
                      {task.detail}
                    </div>
                  )}

                  {/* Source */}
                  {task.source && (
                    <p className="text-[10px] text-zinc-400 mb-3">출처: {task.source}</p>
                  )}

                  {/* Timestamps */}
                  {task.approved_at && (
                    <p className="text-[10px] text-emerald-500 mb-2">✓ {new Date(task.approved_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 승인됨</p>
                  )}
                  {task.rejected_at && (
                    <p className="text-[10px] text-zinc-400 mb-2">✕ {new Date(task.rejected_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 반려됨</p>
                  )}

                  {/* Approve/Reject buttons — only for awaiting_approval */}
                  {isWaiting && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleAction(task.id, 'rejected')}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
                      >
                        ✕ 반려
                      </button>
                      <button
                        onClick={() => handleAction(task.id, 'approved')}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {isLoading ? (
                          <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> 처리 중...</>
                        ) : '✓ 승인'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
