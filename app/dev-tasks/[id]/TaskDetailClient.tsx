'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

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
}

const PRIORITY_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  urgent: { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',         label: '긴급' },
  high:   { dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: '높음' },
  medium: { dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200',       label: '중간' },
  low:    { dot: 'bg-zinc-300',   badge: 'bg-zinc-50 text-zinc-500 border-zinc-200',       label: '낮음' },
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

const STATUS_ORDER = ['pending', 'awaiting_approval', 'approved', 'in-progress', 'done'];

function TimelineStep({ label, time, done, active, pulse }: { label: string; time?: string; done: boolean; active: boolean; pulse?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
          done ? 'bg-emerald-500 border-emerald-500 text-white' :
          active ? 'bg-indigo-500 border-indigo-500 text-white' :
          'bg-white border-zinc-200 text-zinc-300'
        } ${pulse ? 'animate-pulse' : ''}`}>
          {done ? '✓' : active ? '⚙' : '·'}
        </div>
      </div>
      <div className="pb-5 min-w-0">
        <p className={`text-sm font-medium ${done || active ? 'text-zinc-800' : 'text-zinc-400'}`}>{label}</p>
        {time && <p className="text-[11px] text-zinc-400 mt-0.5">{fmt(time)} · {timeAgo(time)}</p>}
        {active && !time && (
          <p className="text-[11px] text-indigo-500 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
            진행 중...
          </p>
        )}
      </div>
    </div>
  );
}

export default function TaskDetailClient({ initialTask }: { initialTask: DevTask }) {
  const [task, setTask] = useState<DevTask>(initialTask);
  const logEndRef = useRef<HTMLDivElement>(null);

  const isLive = task.status === 'in-progress';

  // Poll for updates while in-progress
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/dev-tasks/${task.id}`).catch(() => null);
      if (res?.ok) {
        const updated = await res.json();
        setTask(updated);
        if (updated.status !== 'in-progress') clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [task.id, isLive]);

  // Scroll log to bottom on update
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task.execution_log]);

  const cfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const logs: LogEntry[] = (() => { try { return JSON.parse(task.execution_log || '[]'); } catch { return []; } })();
  const changedFiles: string[] = (() => { try { return JSON.parse(task.changed_files || '[]'); } catch { return []; } })();

  const statusIdx = STATUS_ORDER.indexOf(task.status);
  const isDone = task.status === 'done';
  const isRejected = task.status === 'rejected';

  return (
    <div className="bg-zinc-50 min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-zinc-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dev-tasks" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">← DEV 태스크</Link>
          <div className="ml-auto flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                실행 중 (3초 자동 갱신)
              </span>
            )}
            <div className="w-6 h-6 bg-zinc-900 rounded-md flex items-center justify-center font-bold text-xs text-white">J</div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Task header card */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {/* Status stripe */}
          <div className={`h-1.5 w-full ${
            isDone ? 'bg-emerald-400' :
            isLive ? 'bg-gradient-to-r from-indigo-400 to-violet-400' :
            isRejected ? 'bg-zinc-300' :
            task.status === 'awaiting_approval' ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
            'bg-zinc-200'
          }`} />
          <div className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className={`mt-1 w-3 h-3 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="flex-1">
                <h1 className="text-lg font-bold text-zinc-900 leading-snug">{task.title}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${cfg.badge}`}>{cfg.label}</span>
                  {task.assignee && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 text-zinc-500">
                      {task.assignee}
                    </span>
                  )}
                  {isDone && <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold">✓ 완료</span>}
                  {isLive && <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-600 font-semibold animate-pulse">⚙ 실행 중</span>}
                  {isRejected && <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-400 font-medium">✕ 반려됨</span>}
                  {task.status === 'awaiting_approval' && <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-600 font-medium">⏳ 승인 대기</span>}
                  <span className="text-[11px] text-zinc-400">{timeAgo(task.created_at)}</span>
                </div>
              </div>
            </div>

            {task.detail && (
              <div className="text-sm text-zinc-600 leading-relaxed bg-zinc-50 border border-zinc-100 rounded-lg p-4">
                {task.detail}
              </div>
            )}

            {task.source && (
              <p className="text-[11px] text-zinc-400 mt-2">
                출처:&nbsp;
                {task.source.startsWith('board:') ? (
                  <Link href={`/posts/${task.source.replace('board:', '')}`} className="text-indigo-500 hover:underline">
                    {task.source}
                  </Link>
                ) : task.source}
              </p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-4">진행 타임라인</h2>
          <div className="relative pl-3.5">
            {/* Vertical line */}
            <div className="absolute left-[13px] top-3.5 bottom-3.5 w-0.5 bg-zinc-100" />

            <TimelineStep
              label="태스크 생성됨"
              time={task.created_at}
              done={statusIdx >= 0}
              active={false}
            />
            <TimelineStep
              label="승인 대기 중"
              time={task.status === 'awaiting_approval' ? task.created_at : undefined}
              done={statusIdx >= 2}
              active={task.status === 'awaiting_approval'}
              pulse={task.status === 'awaiting_approval'}
            />
            <TimelineStep
              label="대표 승인 완료"
              time={task.approved_at}
              done={statusIdx >= 3}
              active={task.status === 'approved'}
            />
            <TimelineStep
              label="Jarvis 실행 시작"
              time={task.started_at}
              done={isDone}
              active={isLive}
              pulse={isLive}
            />
            <TimelineStep
              label={isDone ? '작업 완료' : isRejected ? '반려됨' : '완료 대기'}
              time={task.completed_at ?? task.rejected_at}
              done={isDone}
              active={false}
            />
          </div>
        </div>

        {/* Execution log */}
        {(logs.length > 0 || isLive) && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-700">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">실행 로그</span>
              {isLive && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              )}
              <span className="ml-auto text-[10px] text-zinc-600">{logs.length}개 항목</span>
            </div>
            <div className="p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <p className="text-zinc-600">로그 대기 중...</p>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-zinc-600 shrink-0">
                      {new Date(entry.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-zinc-200">{entry.message}</span>
                  </div>
                ))
              )}
              {isLive && (
                <div className="flex gap-3">
                  <span className="text-zinc-600">...</span>
                  <span className="text-zinc-500 animate-pulse">실행 중</span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* Completion summary */}
        {isDone && (
          <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-3.5 border-b border-emerald-100 flex items-center gap-2">
              <span className="text-lg">✅</span>
              <h2 className="text-sm font-bold text-emerald-800">작업 완료 요약</h2>
              {task.completed_at && (
                <span className="ml-auto text-[11px] text-emerald-600">{fmt(task.completed_at)}</span>
              )}
            </div>
            <div className="p-5 space-y-4">
              {task.result_summary ? (
                <div>
                  <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">작업 내용</h3>
                  <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{task.result_summary}</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">작업 요약이 제출되지 않았습니다.</p>
              )}

              {changedFiles.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">변경된 파일 ({changedFiles.length}개)</h3>
                  <ul className="space-y-1">
                    {changedFiles.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-zinc-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        <code className="font-mono bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100">{f}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rejected */}
        {isRejected && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 text-center">
            <p className="text-2xl mb-2">✕</p>
            <p className="text-sm font-medium text-zinc-600">반려된 태스크입니다</p>
            {task.rejected_at && <p className="text-xs text-zinc-400 mt-1">{fmt(task.rejected_at)}</p>}
          </div>
        )}

      </div>
    </div>
  );
}
