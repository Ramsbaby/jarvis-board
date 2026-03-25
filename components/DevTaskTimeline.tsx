import Link from 'next/link';

export interface DevTaskTimelineItem {
  id: string;
  title: string;
  detail?: string;
  status: string;
  priority: string;
  created_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  result_summary?: string | null;
  execution_log?: string | null;
  changed_files?: string | null;
  actual_impact?: string | null;
  expected_impact?: string | null;
  rejection_note?: string | null;
}

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-700',
  high: 'bg-amber-100 text-amber-700',
  medium: 'bg-emerald-100 text-emerald-700',
  low: 'bg-zinc-100 text-zinc-500',
};

const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  awaiting_approval: { bg: 'bg-amber-100 text-amber-700', label: '검토중' },
  approved: { bg: 'bg-teal-100 text-teal-700', label: '승인됨' },
  'in-progress': { bg: 'bg-indigo-100 text-indigo-700', label: '작업중' },
  active: { bg: 'bg-indigo-100 text-indigo-700', label: '작업중' },
  done: { bg: 'bg-emerald-100 text-emerald-700', label: '완료' },
  rejected: { bg: 'bg-zinc-100 text-zinc-500', label: '반려' },
  failed: { bg: 'bg-rose-100 text-rose-700', label: '실패' },
};

function fmtTs(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('Z') || iso.includes('+') ? iso : iso + 'Z');
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function tryParseJsonArray(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && typeof item.message === 'string') return item.message;
      return String(item);
    });
  } catch { return []; }
}

interface Step {
  label: string;
  ts?: string | null;
  done: boolean;
  active?: boolean;
  type?: 'rejected' | 'failed';
}

function getSteps(task: DevTaskTimelineItem): Step[] {
  if (task.status === 'rejected') {
    return [
      { label: '생성', ts: task.created_at, done: true },
      { label: '반려', ts: task.rejected_at, done: true, type: 'rejected' },
    ];
  }
  return [
    { label: '생성', ts: task.created_at, done: true },
    { label: '승인', ts: task.approved_at, done: !!task.approved_at },
    { label: '실행', ts: task.started_at, done: !!task.started_at, active: task.status === 'in-progress' || task.status === 'active' },
    { label: '완료', ts: task.completed_at, done: task.status === 'done', type: task.status === 'failed' ? 'failed' : undefined },
  ];
}

function StepDot({ step }: { step: Step }) {
  if (step.type === 'rejected') {
    return <span className="w-3 h-3 rounded-full bg-zinc-400 shrink-0 inline-block" />;
  }
  if (step.type === 'failed') {
    return <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0 inline-block" />;
  }
  if (step.active) {
    return <span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0 inline-block animate-pulse" />;
  }
  if (step.done) {
    return <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 inline-block" />;
  }
  return <span className="w-3 h-3 rounded-full border-2 border-zinc-300 shrink-0 inline-block bg-white" />;
}

function TaskCard({ task }: { task: DevTaskTimelineItem }) {
  const steps = getSteps(task);
  const statusCfg = STATUS_STYLE[task.status] ?? { bg: 'bg-zinc-100 text-zinc-500', label: task.status };
  const priorityStyle = PRIORITY_STYLE[task.priority] ?? 'bg-zinc-100 text-zinc-500';
  const logs = tryParseJsonArray(task.execution_log);
  const changedFiles = tryParseJsonArray(task.changed_files);
  const changedCount = changedFiles.length;
  const isRejected = task.status === 'rejected';

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-300 transition-colors">
      {/* Title row */}
      <div className="flex items-start gap-2 mb-3">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${priorityStyle}`}>
          {task.priority.toUpperCase()}
        </span>
        <Link href={`/dev-tasks/${task.id}`} className="flex-1 text-sm font-medium text-zinc-800 hover:text-indigo-600 transition-colors leading-snug">
          <span className={isRejected ? 'line-through text-zinc-400' : ''}>{task.title}</span>
        </Link>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusCfg.bg}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Horizontal step timeline */}
      <div className="flex items-center gap-0 mb-3 overflow-x-auto">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
              <StepDot step={step} />
              <span className={`text-[9px] font-medium mt-0.5 ${
                step.type === 'rejected' ? 'text-zinc-400' :
                step.type === 'failed' ? 'text-rose-500' :
                step.active ? 'text-indigo-600' :
                step.done ? 'text-emerald-600' : 'text-zinc-300'
              }`}>
                {step.label}
              </span>
              {step.ts && (
                <span className="text-[9px] text-zinc-400 text-center leading-tight">{fmtTs(step.ts)}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-6 shrink-0 -mt-4 ${steps[i + 1].done || steps[i + 1].active ? 'bg-emerald-300' : 'bg-zinc-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Result summary */}
      {task.result_summary && (
        <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
          <p className="text-xs text-zinc-600 leading-relaxed">{task.result_summary}</p>
        </div>
      )}

      {/* Rejection note */}
      {task.rejection_note && (
        <div className="mt-2 p-2 bg-zinc-50 rounded-lg border border-zinc-200">
          <p className="text-xs text-zinc-500 leading-relaxed">반려 사유: {task.rejection_note}</p>
        </div>
      )}

      {/* Changed files + impact */}
      {(changedCount > 0 || task.actual_impact) && (
        <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-zinc-500">
          {changedCount > 0 && <span>📁 파일 {changedCount}개 변경</span>}
          {task.actual_impact && <span>🎯 영향: {task.actual_impact}</span>}
        </div>
      )}

      {/* Execution log — collapsible */}
      {logs.length > 0 && (
        <details className="mt-2">
          <summary className="text-[10px] text-zinc-400 cursor-pointer hover:text-zinc-600">
            실행 로그 {logs.length}줄
          </summary>
          <div className="mt-1 bg-zinc-950 rounded p-2 font-mono text-[10px] text-zinc-400 space-y-0.5 max-h-32 overflow-y-auto">
            {logs.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </details>
      )}
    </div>
  );
}

export default function DevTaskTimeline({ tasks }: { tasks: DevTaskTimelineItem[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const barColor =
    pct === 100 ? 'bg-emerald-500' :
    pct > 50 ? 'bg-indigo-500' :
    pct > 0 ? 'bg-amber-500' :
    'bg-zinc-300';

  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-zinc-700">⚙ 개발 태스크 ({total}건)</h3>
          <span className="text-[11px] text-zinc-500 shrink-0">{done}/{total} 완료 ({pct}%)</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Task cards */}
      <div className="p-3 space-y-2 bg-zinc-50/30">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
