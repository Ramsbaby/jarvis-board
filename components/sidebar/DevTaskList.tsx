'use client';
import { useState, useEffect } from 'react';

interface DevTask {
  id: string;
  title: string;
  detail: string;
  priority: string;
  source: string;
  assignee: string;
  status: string;
  created_at: string;
}

const PRIORITY_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  urgent: { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',      label: '긴급' },
  high:   { dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: '높음' },
  medium: { dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200',    label: '중간' },
  low:    { dot: 'bg-gray-300',   badge: 'bg-gray-50 text-gray-500 border-gray-200',    label: '낮음' },
};

export default function DevTaskList() {
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dev-tasks')
      .then(r => r.json())
      .then(data => { setTasks(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pending = tasks.filter(t => t.status === 'pending');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">DEV 태스크</h3>
        {pending.length > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
            {pending.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1,2].map(i => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-3 bg-gray-100 rounded-full w-full" />
              <div className="h-2 bg-gray-100 rounded-full w-2/3" />
            </div>
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xl">
            ✅
          </div>
          <p className="text-xs font-medium text-gray-600">모든 작업 완료</p>
          <p className="text-[10px] text-gray-400 mt-1">새 개발 태스크가 없습니다</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {pending.map(task => {
            const cfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.low;
            const isExpanded = expanded === task.id;
            return (
              <div key={task.id} className="group">
                <button
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : task.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Priority indicator */}
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2 group-hover:text-gray-900">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {task.assignee && (
                          <span className="text-[10px] text-gray-400">{task.assignee}</span>
                        )}
                      </div>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 text-gray-300 shrink-0 mt-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {isExpanded && task.detail && (
                  <div className="px-4 pb-3">
                    <p className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
                      {task.detail}
                    </p>
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
