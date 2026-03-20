'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEvent } from '@/contexts/EventContext';
import MarkdownContent from '@/components/MarkdownContent';

interface SourcePost {
  id: string;
  title: string;
  type: string;
  status: string;
  author_display: string;
  comment_count: number;
}

interface LogEntry { time: string; message: string; }

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
  started_at?: string;
  completed_at?: string;
  result_summary?: string;
  changed_files?: string;
  execution_log?: string;
  rejection_note?: string;
}

const PRIORITY_CONFIG: Record<string, { dot: string; badge: string; label: string; ring: string }> = {
  urgent: { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',         label: '긴급', ring: 'ring-red-200' },
  high:   { dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: '높음', ring: 'ring-orange-200' },
  medium: { dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200',       label: '중간', ring: 'ring-blue-100' },
  low:    { dot: 'bg-zinc-300',   badge: 'bg-zinc-50 text-zinc-500 border-zinc-200',       label: '낮음', ring: 'ring-zinc-100' },
};

function fmt(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}

/** Duration between two ISO timestamps as a friendly string */
function elapsed(from?: string, to?: string): string | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return null;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}초`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

/** Seconds until next 5-minute cron boundary */
function secsToNextCron(): number {
  const now = new Date();
  const totalSec = now.getMinutes() * 60 + now.getSeconds();
  const period = 5 * 60;
  return period - (totalSec % period);
}

function TimelineStep({
  icon, label, sublabel, time, elapsedLabel, done, active, pulse, rejected,
}: {
  icon: string; label: string; sublabel?: string; time?: string; elapsedLabel?: string | null;
  done: boolean; active: boolean; pulse?: boolean; rejected?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
          rejected ? 'bg-zinc-100 border-zinc-200 text-zinc-300' :
          done     ? 'bg-emerald-500 border-emerald-500 text-white' :
          active   ? 'bg-indigo-500 border-indigo-500 text-white' :
                     'bg-white border-zinc-200 text-zinc-300'
        } ${pulse && active ? 'animate-pulse' : ''}`}>
          {done ? '✓' : active ? icon : '·'}
        </div>
      </div>
      <div className="pb-6 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold leading-snug ${
            rejected ? 'text-zinc-400' : done || active ? 'text-zinc-900' : 'text-zinc-400'
          }`}>{label}</p>
          {elapsedLabel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">{elapsedLabel}</span>
          )}
        </div>
        {sublabel && (
          <p className={`text-[11px] mt-0.5 ${done || active ? 'text-zinc-500' : 'text-zinc-300'}`}>{sublabel}</p>
        )}
        {time && (
          <p className="text-[11px] text-zinc-400 mt-1 tabular-nums">{fmt(time)} · {timeAgo(time)}</p>
        )}
        {active && !time && (
          <p className="text-[11px] text-indigo-500 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
            진행 중...
          </p>
        )}
      </div>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  decision: '결정', discussion: '논의', issue: '이슈', inquiry: '문의',
};
const STATUS_LABEL: Record<string, string> = {
  open: '토론중', 'in-progress': '진행중', resolved: '마감',
};

export default function TaskDetailClient({
  initialTask, isOwner, isGuest, sourcePost,
}: {
  initialTask: DevTask;
  isOwner: boolean;
  isGuest: boolean;
  sourcePost?: SourcePost | null;
}) {
  const router = useRouter();
  const [task, setTask] = useState<DevTask>(initialTask);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [cronSecs, setCronSecs] = useState(secsToNextCron);
  const [logExpanded, setLogExpanded] = useState(false);
  const [showRetryForm, setShowRetryForm] = useState(false);
  const [retryNote, setRetryNote] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useEvent();

  const isLive     = task.status === 'in-progress';
  const isDone     = task.status === 'done';
  const isRejected = task.status === 'rejected';
  const isAwaiting = task.status === 'awaiting_approval';
  const isApproved = task.status === 'approved';

  // SSE real-time updates
  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === 'dev_task_updated' && ev.data?.task?.id === task.id) {
        setTask(ev.data.task);
      }
    });
  }, [subscribe, task.id]);

  // Fallback polling when in-progress (in case SSE misses)
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/dev-tasks/${task.id}`).catch(() => {
        console.warn('Task polling failed');
        return null;
      });
      if (res?.ok) {
        const updated = await res.json();
        setTask(updated);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [task.id, isLive]);

  // Cron countdown (5-min boundary)
  useEffect(() => {
    if (!isApproved) return;
    const t = setInterval(() => setCronSecs(secsToNextCron()), 1000);
    return () => clearInterval(t);
  }, [isApproved]);

  // Scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task.execution_log]);

  async function handleApprove() {
    setActionLoading('approved');
    setActionError(null);
    try {
      const res = await fetch(`/api/dev-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'approved' }),
      });
      if (res.ok) {
        setTask(prev => ({ ...prev, status: 'approved', approved_at: new Date().toISOString() }));
      } else if (res.status === 401) {
        setActionError('세션이 만료되었습니다. 다시 로그인해주세요.');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setActionError(`오류가 발생했습니다 (${res.status}). 페이지를 새로고침해주세요.`);
      }
    } catch {
      setActionError('네트워크 오류. 연결을 확인해주세요.');
    } finally { setActionLoading(null); }
  }

  async function handleReject() {
    setActionLoading('rejected');
    setActionError(null);
    try {
      const res = await fetch(`/api/dev-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'rejected', rejection_note: rejectNote || undefined }),
      });
      if (res.ok) {
        setTask(prev => ({
          ...prev, status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_note: rejectNote || undefined,
        }));
        setShowRejectForm(false);
      } else if (res.status === 401) {
        setActionError('세션이 만료되었습니다. 다시 로그인해주세요.');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setActionError(`오류가 발생했습니다 (${res.status}).`);
      }
    } catch {
      setActionError('네트워크 오류. 연결을 확인해주세요.');
    } finally { setActionLoading(null); }
  }

  async function handleRetry() {
    setActionLoading('retry');
    setActionError(null);
    try {
      const res = await fetch(`/api/dev-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'pending' }),
      });
      if (res.ok) {
        setTask(prev => ({
          ...prev, status: 'pending',
          rejected_at: undefined, rejection_note: undefined,
          approved_at: undefined, started_at: undefined,
          completed_at: undefined, result_summary: undefined,
          changed_files: undefined, execution_log: undefined,
        }));
      } else if (res.status === 401) {
        setActionError('세션이 만료되었습니다. 다시 로그인해주세요.');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setActionError(`재시도 요청 실패 (${res.status})`);
      }
    } catch {
      setActionError('네트워크 오류.');
    } finally { setActionLoading(null); }
  }

  async function handleRetryWithNote() {
    if (!retryNote.trim()) { setShowRetryForm(false); return; }
    setActionLoading('retry-note');
    setActionError(null);
    try {
      const res = await fetch(`/api/dev-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'pending' }),
      });
      if (res.ok) {
        setTask(prev => ({
          ...prev, status: 'pending',
          rejected_at: undefined, rejection_note: undefined,
          approved_at: undefined, started_at: undefined,
          completed_at: undefined, result_summary: undefined,
          changed_files: undefined, execution_log: undefined,
        }));
        setShowRetryForm(false);
        setRetryNote('');
      } else if (res.status === 401) {
        setActionError('세션이 만료되었습니다.');
        setTimeout(() => router.push('/login'), 1500);
      }
    } catch {
      setActionError('네트워크 오류.');
    } finally { setActionLoading(null); }
  }

  const cfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const logs: LogEntry[] = (() => { try { return JSON.parse(task.execution_log || '[]'); } catch { return []; } })();
  const changedFiles: string[] = (() => { try { return JSON.parse(task.changed_files || '[]'); } catch { return []; } })();

  // Derived timestamps
  const waitTime    = elapsed(task.created_at, task.approved_at ?? task.rejected_at);
  const workTime    = elapsed(task.started_at, task.completed_at);
  const totalTime   = elapsed(task.created_at, task.completed_at ?? task.rejected_at);
  const sourcePostId = task.source?.startsWith('board:') ? task.source.replace('board:', '') : null;

  // Cron countdown display
  const cronMin = Math.floor(cronSecs / 60);
  const cronSecDisplay = cronSecs % 60;

  // Status stripe
  const stripeClass = isDone     ? 'bg-emerald-400' :
                      isLive     ? 'bg-gradient-to-r from-indigo-400 to-violet-400' :
                      isRejected ? 'bg-zinc-200' :
                      isAwaiting ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                      isApproved ? 'bg-gradient-to-r from-teal-400 to-emerald-400' :
                                   'bg-zinc-100';

  return (
    <div className="bg-zinc-50 min-h-screen">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-zinc-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            뒤로
          </button>
          <div className="ml-auto flex items-center gap-2.5">
            {isLive && (
              <span className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                실행 중 · SSE 실시간
              </span>
            )}
            {isGuest && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 font-medium">
                열람 전용
              </span>
            )}
            <div className="w-6 h-6 bg-zinc-900 rounded-md flex items-center justify-center font-bold text-xs text-white">J</div>
          </div>
        </div>
      </header>

      {isGuest && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-center">
          <p className="text-xs text-amber-700">게스트 모드 — 태스크 내용을 열람할 수 있지만 승인·반려 등 관리 기능은 사용할 수 없습니다.</p>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* ── Task header card ── */}
        <div className={`bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm ${cfg.ring ? `ring-1 ${cfg.ring}` : ''}`}>
          <div className={`h-1.5 w-full ${stripeClass}`} />
          <div className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className={`mt-1.5 w-3 h-3 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-zinc-900 leading-snug">{task.title}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold ${cfg.badge}`}>{cfg.label}</span>
                  {task.assignee && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 text-zinc-500 font-medium">
                      👤 {task.assignee}
                    </span>
                  )}
                  {isAwaiting  && <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 font-semibold">⏳ 승인 대기</span>}
                  {isApproved  && <span className="text-[11px] px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-700 font-semibold">✓ 승인됨</span>}
                  {isLive      && <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold animate-pulse">⚙ 실행 중</span>}
                  {isDone      && <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">✓ 완료</span>}
                  {isRejected  && <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-500 font-medium">✕ 반려됨</span>}
                  {task.status === 'pending' && <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 text-zinc-400 font-medium">대기중</span>}
                </div>
              </div>
            </div>

            {task.detail && (
              <div className={`text-sm text-zinc-700 leading-relaxed rounded-lg p-4 mb-3 whitespace-pre-wrap ${
                isAwaiting ? 'bg-amber-50/60 border border-amber-100' : 'bg-zinc-50 border border-zinc-100'
              }`}>
                {task.detail}
              </div>
            )}

            {/* Source card */}
            {sourcePostId ? (
              <Link
                href={`/posts/${sourcePostId}`}
                className="flex items-start gap-3 px-4 py-3 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 transition-colors group mt-2"
              >
                <span className="text-base mt-0.5 shrink-0">🔗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">출처 게시물</p>
                  {sourcePost ? (
                    <>
                      <p className="text-sm font-semibold text-zinc-800 group-hover:text-indigo-700 leading-snug line-clamp-2 transition-colors">
                        {sourcePost.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">
                          {TYPE_LABEL[sourcePost.type] ?? sourcePost.type}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          sourcePost.status === 'open' ? 'bg-emerald-50 text-emerald-600' :
                          sourcePost.status === 'in-progress' ? 'bg-amber-50 text-amber-600' :
                          'bg-zinc-100 text-zinc-400'
                        }`}>
                          {STATUS_LABEL[sourcePost.status] ?? sourcePost.status}
                        </span>
                        <span className="text-[10px] text-zinc-400">{sourcePost.author_display}</span>
                        <span className="text-[10px] text-zinc-400">💬 {sourcePost.comment_count}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-indigo-600 font-mono group-hover:underline truncate">{task.source}</p>
                  )}
                </div>
                <svg className="w-4 h-4 text-indigo-300 shrink-0 mt-1 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ) : task.source ? (
              <p className="text-[11px] text-zinc-400 mt-2 px-1">출처: <span className="text-zinc-600">{task.source}</span></p>
            ) : null}

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400 mt-3 pt-3 border-t border-zinc-100">
              <span>생성 {fmt(task.created_at)}</span>
              {task.approved_at  && <span className="text-teal-600">✓ 승인 {fmt(task.approved_at)}</span>}
              {task.started_at   && <span className="text-indigo-500">⚙ 시작 {fmt(task.started_at)}</span>}
              {task.completed_at && <span className="text-emerald-600">🎉 완료 {fmt(task.completed_at)}</span>}
              {task.rejected_at  && <span className="text-zinc-500">✕ 반려 {fmt(task.rejected_at)}</span>}
              {totalTime && <span className="ml-auto font-medium text-zinc-500">총 {totalTime} 소요</span>}
            </div>
          </div>
        </div>

        {/* ── Approval action card ── */}
        {isAwaiting && (
          isOwner ? (
            <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 border-b border-amber-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-lg shrink-0">⚠️</div>
                <div>
                  <h2 className="text-sm font-bold text-amber-800">대표 검토 필요</h2>
                  <p className="text-[11px] text-amber-600 mt-0.5">승인하면 Jarvis가 즉시 작업을 시작합니다</p>
                </div>
                <span className="ml-auto text-[11px] text-amber-500 font-medium">{timeAgo(task.created_at)} 요청됨</span>
              </div>
              <div className="p-5">
                <p className="text-sm text-zinc-600 leading-relaxed mb-5">
                  이 작업을 승인하면 <span className="font-semibold text-zinc-800">Jarvis 자동화 시스템이 실제 코드를 수정</span>합니다.
                  작업 내용을 꼼꼼히 검토한 후 결정해 주세요.
                </p>

                {actionError && (
                  <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                    ⚠️ {actionError}
                  </div>
                )}
                {!showRejectForm ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRejectForm(true)}
                      disabled={!!actionLoading}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40 transition-colors"
                    >
                      ✕ 반려
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
                    >
                      {actionLoading === 'approved' ? (
                        <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> 처리 중...</>
                      ) : '✓ 승인 — 작업 시작'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-600 mb-1.5 block">반려 사유 <span className="text-zinc-400 font-normal">(선택)</span></label>
                      <textarea
                        value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)}
                        placeholder="어떤 부분이 문제인지 작성하면 Jarvis가 참고합니다..."
                        className="w-full text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg p-3 resize-none outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100 transition-colors"
                        rows={3}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowRejectForm(false); setRejectNote(''); }}
                        className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
                      >
                        {actionLoading === 'rejected' ? (
                          <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> 처리 중...</>
                        ) : '✕ 반려 확정'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-amber-100 rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shrink-0">🔒</div>
              <div>
                <p className="text-sm font-semibold text-zinc-700">승인 대기 중</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isGuest ? '게스트 모드에서는 승인/반려를 수행할 수 없습니다.' : '대표님의 검토를 기다리고 있습니다.'}
                </p>
              </div>
            </div>
          )
        )}

        {/* ── Approved — cron countdown ── */}
        {isApproved && (
          <div className="bg-white border border-teal-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center text-lg shrink-0">✅</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-teal-800">승인 완료 — Jarvis 큐 대기 중</p>
                <p className="text-xs text-teal-600 mt-0.5">다음 크론 실행 시 자동으로 작업을 시작합니다</p>
              </div>
              {/* Cron countdown */}
              <div className="text-right shrink-0">
                <p className="text-[10px] text-zinc-400 font-medium">다음 Jarvis 폴링</p>
                <p className="text-lg font-black tabular-nums text-teal-700 leading-none">
                  {cronMin}:{String(cronSecDisplay).padStart(2, '0')}
                </p>
              </div>
            </div>
            {/* Cron progress bar */}
            <div className="h-1 bg-zinc-100">
              <div
                className="h-full bg-teal-400 transition-none"
                style={{ width: `${((5 * 60 - cronSecs) / (5 * 60)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-5">진행 타임라인</h2>
          <div className="relative pl-4">
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-zinc-100" />

            <TimelineStep
              icon="📋" label="태스크 생성됨" sublabel="Jarvis 시스템에 등록"
              time={task.created_at} done={true} active={false}
            />
            <TimelineStep
              icon="⏳" label="승인 대기" sublabel="대표 검토 필요"
              time={isAwaiting ? task.created_at : undefined}
              done={!isAwaiting && !isRejected && task.status !== 'pending'}
              active={isAwaiting} pulse={isAwaiting} rejected={isRejected}
            />
            <TimelineStep
              icon="✓"
              label={isRejected ? '반려됨' : '대표 승인 완료'}
              sublabel={isRejected ? '작업 취소됨' : '작업 실행 승인'}
              time={task.approved_at ?? task.rejected_at}
              elapsedLabel={waitTime ? `대기 ${waitTime}` : null}
              done={!isRejected && !!task.approved_at}
              active={isApproved} rejected={isRejected}
            />
            <TimelineStep
              icon="⚙" label="Jarvis 실행 시작" sublabel="자동화 코드 작업"
              time={task.started_at}
              done={isDone} active={isLive} pulse={isLive} rejected={isRejected}
            />
            <TimelineStep
              icon="🎉"
              label={isDone ? '작업 완료' : isRejected ? '–' : '완료 대기'}
              sublabel={isDone ? '결과물 저장됨' : isRejected ? '' : '실행 완료 후 자동 기록'}
              time={task.completed_at}
              elapsedLabel={workTime ? `작업 ${workTime}` : null}
              done={isDone} active={false} rejected={isRejected}
            />
          </div>
        </div>

        {/* ── Execution log ── */}
        {(logs.length > 0 || isLive) && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700/80">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">실행 로그</span>
              {isLive && (
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              )}
              <span className="ml-auto text-[10px] text-zinc-600 tabular-nums">{logs.length}개 항목</span>
              {logs.length > 5 && (
                <button
                  onClick={() => setLogExpanded(v => !v)}
                  className="ml-2 text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                >
                  {logExpanded ? '접기' : `전체 보기 (${logs.length}개)`}
                </button>
              )}
            </div>
            <div className="p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-1.5">
              {logs.length === 0 ? (
                <p className="text-zinc-600 italic">로그 대기 중...</p>
              ) : (
                (logExpanded ? logs : logs.slice(-5)).map((entry, i) => {
                  const msg = entry.message;
                  const isErr  = /error|fail|failed/i.test(msg);
                  const isWarn = /warn|warning/i.test(msg);
                  const isDoneLog = /done|complete|success|완료/i.test(msg);
                  const color = isErr ? 'text-red-400' : isWarn ? 'text-amber-400' : isDoneLog ? 'text-emerald-400' : 'text-zinc-200';
                  return (
                    <div key={i} className="flex gap-3 leading-relaxed">
                      <span className="text-zinc-600 shrink-0 tabular-nums">
                        {new Date(entry.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={color}>{msg}</span>
                    </div>
                  );
                })
              )}
              {isLive && (
                <div className="flex gap-3 mt-1">
                  <span className="text-zinc-700">···</span>
                  <span className="text-indigo-400 animate-pulse">실행 중</span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* ── Completion summary ── */}
        {isDone && (
          <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 border-b border-emerald-100 flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <h2 className="text-sm font-bold text-emerald-800">작업 완료 요약</h2>
                {task.completed_at && (
                  <p className="text-[11px] text-emerald-600 mt-0.5">{fmt(task.completed_at)} 완료 {workTime ? `· ${workTime} 소요` : ''}</p>
                )}
              </div>
            </div>
            <div className="p-5 space-y-5">
              {task.result_summary ? (
                <div>
                  <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">작업 내용</h3>
                  <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-4">
                    <MarkdownContent content={task.result_summary} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">작업 요약이 제출되지 않았습니다.</p>
              )}

              {changedFiles.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">변경된 파일 ({changedFiles.length}개)</h3>
                  <ul className="space-y-1.5">
                    {changedFiles.map((f, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-xs">
                        <span className="text-indigo-400 shrink-0 font-bold">+</span>
                        <code className="font-mono text-zinc-700 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100 truncate">{f}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Rejected ── */}
        {isRejected && (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-lg shrink-0">✕</div>
              <div>
                <p className="text-sm font-bold text-zinc-700">반려된 태스크</p>
                {task.rejected_at && <p className="text-[11px] text-zinc-400 mt-0.5">{fmt(task.rejected_at)} 반려됨 {waitTime ? `· 대기 ${waitTime}` : ''}</p>}
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              {task.rejection_note ? (
                <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">반려 사유</p>
                  <p className="text-sm text-zinc-600 leading-relaxed">{task.rejection_note}</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">반려 사유가 기재되지 않았습니다.</p>
              )}
              <p className="text-xs text-zinc-400">이 태스크는 반려되어 Jarvis 작업 큐에서 제외되었습니다.</p>
              {actionError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                  ⚠️ {actionError}
                </div>
              )}
              {isOwner && !showRetryForm && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                  >
                    ← 뒤로 가기
                  </button>
                  <button
                    onClick={handleRetry}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 disabled:opacity-40 transition-colors"
                  >
                    {actionLoading === 'retry' ? (
                      <><span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /> 처리 중...</>
                    ) : '↺ 재시도'}
                  </button>
                  <button
                    onClick={() => setShowRetryForm(true)}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 border border-violet-100 hover:bg-violet-100 disabled:opacity-40 transition-colors"
                  >
                    ✏ 수정 후 재요청
                  </button>
                </div>
              )}
              {!isOwner && (
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                >
                  ← 뒤로 가기
                </button>
              )}
              {isOwner && showRetryForm && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1.5 block">추가 지시사항 <span className="text-zinc-400 font-normal">(선택)</span></label>
                    <textarea
                      value={retryNote}
                      onChange={e => setRetryNote(e.target.value)}
                      placeholder="어떤 부분을 수정해서 다시 시도할지 작성해주세요..."
                      className="w-full text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg p-3 resize-none outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 transition-colors"
                      rows={3}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowRetryForm(false); setRetryNote(''); }}
                      className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleRetryWithNote}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                    >
                      {actionLoading === 'retry-note' ? (
                        <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> 처리 중...</>
                      ) : '↺ 재요청 확정'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
