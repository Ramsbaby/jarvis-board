'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useEvent } from '@/contexts/EventContext';
import type { DevTask, TaskReview } from '@/lib/types';

function parseReview(raw: string | null): TaskReview | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function ScoreBadge({ score }: { score: number }) {
  const bg = score >= 4 ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : score >= 3 ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-red-100 text-red-800 border-red-300';
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full border ${bg}`}>
      {score}
    </span>
  );
}

function RiskDot({ risk }: { risk: string }) {
  const bg = risk === 'high' ? 'bg-red-500' : risk === 'medium' ? 'bg-amber-500' : risk === 'low' ? 'bg-blue-400' : 'bg-zinc-300';
  return <span className={`w-2.5 h-2.5 rounded-full ${bg}`} title={risk} />;
}

export default function ReportsClient({ tasks: initialTasks }: { tasks: DevTask[] }) {
  const [filter, setFilter] = useState<'all' | 'reviewed' | 'issues'>('all');
  const [tasks, setTasks] = useState<DevTask[]>(initialTasks);
  const { subscribe } = useEvent();

  // SSE: 리뷰가 업데이트되면 해당 태스크만 갱신
  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === 'dev_task_updated' && ev.data?.task) {
        const updated = ev.data.task as unknown as DevTask;
        setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      }
    });
  }, [subscribe]);

  const enriched = useMemo(() => tasks.map(t => ({
    ...t,
    review: parseReview(t.review as string | null),
  })), [tasks]);

  const filtered = useMemo(() => {
    if (filter === 'reviewed') return enriched.filter(t => t.review);
    if (filter === 'issues') return enriched.filter(t => t.review && (t.review.score <= 2 || t.review.risk === 'high'));
    return enriched;
  }, [enriched, filter]);

  const stats = useMemo(() => {
    const reviewed = enriched.filter(t => t.review);
    const scores = reviewed.map(t => t.review!.score);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const risky = reviewed.filter(t => t.review!.score <= 2 || t.review!.risk === 'high').length;
    return {
      total: enriched.length,
      reviewed: reviewed.length,
      avg: avg.toFixed(1),
      risky,
      done: enriched.filter(t => t.status === 'done').length,
      failed: enriched.filter(t => t.status === 'failed').length,
    };
  }, [enriched]);

  return (
    <div className="bg-zinc-50 min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dev-tasks" className="text-zinc-400 hover:text-zinc-600 text-sm">&larr; 개발 태스크</Link>
            <h1 className="text-lg font-bold text-zinc-900">품질 리포트</h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-zinc-200 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-900">{stats.total}</p>
            <p className="text-[11px] text-zinc-500 mt-1">전체</p>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{stats.done}</p>
            <p className="text-[11px] text-emerald-600 mt-1">완료</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{stats.failed}</p>
            <p className="text-[11px] text-red-600 mt-1">실패</p>
          </div>
          <div className="bg-white rounded-xl border border-indigo-200 p-4 text-center">
            <p className="text-2xl font-bold text-indigo-700">{stats.reviewed}</p>
            <p className="text-[11px] text-indigo-600 mt-1">리뷰됨</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.avg}</p>
            <p className="text-[11px] text-amber-600 mt-1">평균 점수</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{stats.risky}</p>
            <p className="text-[11px] text-red-600 mt-1">이슈</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'reviewed', 'issues'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {f === 'all' ? `전체 (${enriched.length})` : f === 'reviewed' ? `리뷰됨 (${enriched.filter(t => t.review).length})` : `이슈 (${enriched.filter(t => t.review && (t.review.score <= 2 || t.review.risk === 'high')).length})`}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="space-y-2">
          {filtered.map(t => (
            <Link
              key={t.id}
              href={`/dev-tasks/${t.id}`}
              className="block bg-white rounded-xl border border-zinc-200 hover:border-indigo-300 hover:shadow-sm transition-all px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {/* Score */}
                <div className="shrink-0">
                  {t.review ? <ScoreBadge score={t.review.score} /> : (
                    <span className="inline-flex items-center justify-center w-8 h-8 text-[10px] font-medium rounded-full bg-zinc-100 text-zinc-400 border border-zinc-200">
                      {t.status === 'failed' ? '!' : '-'}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 truncate">{t.title}</p>
                    {t.review && <RiskDot risk={t.review.risk} />}
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      t.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>{t.status}</span>
                  </div>
                  {t.review?.summary && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{t.review.summary}</p>
                  )}
                  {!t.review && t.result_summary && (
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{t.result_summary.slice(0, 100)}</p>
                  )}
                </div>

                {/* Date */}
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-zinc-400">
                    {t.completed_at ? new Date(t.completed_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '-'}
                  </p>
                </div>
              </div>

              {/* Issues preview */}
              {t.review?.issues && t.review.issues.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.review.issues.slice(0, 3).map((issue, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                      {issue.length > 50 ? issue.slice(0, 50) + '...' : issue}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-zinc-400 text-sm">
              {filter === 'issues' ? '이슈 없음' : '태스크 없음'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
