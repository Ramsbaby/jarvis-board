'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useEvent } from '@/contexts/EventContext';

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
  const { subscribe } = useEvent();

  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === 'dev_task_updated' && ev.data?.task) {
        setTasks(prev => {
          const exists = prev.some(t => t.id === ev.data.task.id);
          if (exists) return prev.map(t => t.id === ev.data.task.id ? ev.data.task : t);
          return [ev.data.task, ...prev];
        });
      }
    });
  }, [subscribe]);

  async function handleAction(taskId: string, status: 'approved' | 'rejected') {
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/dev-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        console.error('Unauthorized: session expired or invalid');
        return;
      }
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

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: '승인 대기', key: 'awaiting_approval', color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-400', pulse: false },
          { label: '진행 중',   key: 'in-progress',       color: 'bg-indigo-50 border-indigo-200 text-indigo-700', dot: 'bg-indigo-400', pulse: true },
          { label: '완료',      key: 'done',               color: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-400', pulse: false },
          { label: '반려',      key: 'rejected',           color: 'bg-zinc-50 border-zinc-200 text-zinc-500', dot: 'bg-zinc-300', pulse: false },
        ].map(s => (
          <div key={s.key} className={`rounded-lg border p-3 flex flex-col gap-1 ${s.color}`}>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.dot} ${s.pulse ? 'animate-pulse' : ''}`} />
              <span className="text-[11px] font-medium">{s.label}</span>
            </div>
            <span className="text-2xl font-black tabular-nums">
              {tasks.filter(t => t.status === s.key).length}
            </span>
          </div>
        ))}
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
            {t.key !== 'all' && countMap[t.key] > 0 && (
              <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded-full font-bold ${
                t.key === 'awaiting_approval' ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {countMap[t.key]}
              </span>
            )}
            {t.key === 'all' && (
              <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded-full font-bold bg-zinc-100 text-zinc-500">
                {countMap['all']}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-sm">이 상태의 태스크가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const cfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.low;
            const isWaiting = task.status === 'awaiting_approval';
            const isLoading = actionLoading === task.id;

            return (
              <div
                key={task.id}
                className={`rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${
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

                <Link
                  href={`/dev-tasks/${task.id}`}
                  className={`block border rounded-xl p-4 hover:shadow-md transition-all group ${
                    task.status === 'awaiting_approval' ? 'bg-amber-50/60 border-amber-200 hover:border-amber-300' :
                    task.status === 'in-progress'       ? 'bg-indigo-50/40 border-indigo-200' :
                    task.status === 'done'              ? 'bg-white border-zinc-200' :
                    task.status === 'rejected'          ? 'bg-zinc-50 border-zinc-200 opacity-70' :
                    'bg-white border-zinc-200'
                  }`}
                >
                  <div>
                    {/* Header row */}
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900 leading-snug group-hover:text-indigo-700">{task.title}</h3>
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
                      {/* Right arrow icon */}
                      <svg
                        className="w-4 h-4 text-zinc-300 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
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
                  </div>
                </Link>

                {/* Approve/Reject buttons — only for awaiting_approval, outside the Link */}
                {isWaiting && (
                  <div className="flex gap-2 px-4 pb-4 pt-1">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
