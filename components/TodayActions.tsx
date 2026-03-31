'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';
import { AUTHOR_META } from '@/lib/constants';
import { useEvent } from '@/contexts/EventContext';

interface DevTask {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: string;
  created_at: string;
  approved_at?: string;
  completed_at?: string;
}

interface ActivePost {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  comment_count: number;
  board_closes_at?: string;
  agent_commenters?: string;
}

interface AIActivity {
  agent: string;
  action: string;
  timestamp: string;
  postId?: string;
  content?: string;
  type?: 'comment' | 'consensus' | 'thinking' | 'debate';
}

interface WeeklyStats {
  done: number;
  total: number;
  rate: number;
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-700 border border-rose-200',
  high: 'bg-amber-100 text-amber-700 border border-amber-200',
  medium: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  low: 'bg-zinc-100 text-zinc-500 border border-zinc-200',
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: '긴급',
  high: '높음',
  medium: '보통',
  low: '낮음',
};

function getClosingMinutes(closesAt?: string): number | null {
  if (!closesAt) return null;
  const remaining = new Date(closesAt).getTime() - Date.now();
  if (remaining <= 0) return null;
  return Math.floor(remaining / 60000);
}

export default function TodayActions() {
  const [awaitingTasks, setAwaitingTasks] = useState<DevTask[]>([]);
  const [closingPosts, setClosingPosts] = useState<ActivePost[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ done: 0, total: 0, rate: 0 });
  const [aiActivities, setAiActivities] = useState<AIActivity[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useEvent();

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, allTasksRes, postsRes] = await Promise.all([
        fetch('/api/dev-tasks?status=awaiting_approval', { credentials: 'include' }),
        fetch('/api/dev-tasks', { credentials: 'include' }),
        fetch('/api/posts'),
      ]);

      // Awaiting approval tasks
      const awaitingRaw: DevTask[] = tasksRes.ok ? await tasksRes.json() : [];
      setAwaitingTasks(awaitingRaw.filter((t) => t.status === 'awaiting_approval'));

      // Weekly stats
      const allTasks: DevTask[] = allTasksRes.ok ? await allTasksRes.json() : [];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      // 최근 7일 기준: 승인된 태스크 중 완료된 비율 (total = 승인된 것, done = 그 중 완료)
      const weeklyApproved = allTasks.filter(
        (t) => t.approved_at && t.approved_at >= sevenDaysAgo,
      );
      const weeklyDone = weeklyApproved.filter((t) => t.status === 'done').length;
      const weeklyTotal = weeklyApproved.length;
      const weeklyRate = weeklyTotal > 0 ? Math.round((weeklyDone / weeklyTotal) * 100) : 0;
      setWeeklyStats({ done: weeklyDone, total: weeklyTotal, rate: weeklyRate });

      // Closing posts (within 60 minutes)
      const posts: ActivePost[] = postsRes.ok ? await postsRes.json() : [];
      const active = posts.filter(
        (p) => (p.status === 'open' || p.status === 'in-progress') && p.type !== 'report',
      );
      const closing = active
        .filter((p) => {
          const mins = getClosingMinutes(p.board_closes_at);
          return mins !== null && mins <= 60;
        })
        .sort((a, b) => {
          const minsA = getClosingMinutes(a.board_closes_at) ?? 999;
          const minsB = getClosingMinutes(b.board_closes_at) ?? 999;
          return minsA - minsB;
        });
      setClosingPosts(closing);

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch today actions:', error);
      setLoading(false);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const postsRes = await fetch('/api/posts');
      const posts: ActivePost[] = postsRes.ok ? await postsRes.json() : [];
      const activePosts = posts
        .filter((p) => p.status === 'open' || p.status === 'in-progress')
        .slice(0, 5);

      const recentActivities: AIActivity[] = [];
      for (const post of activePosts) {
        if (!post.id) continue;
        try {
          const res = await fetch(`/api/posts/${post.id}`);
          if (!res.ok) continue;
          const detail = await res.json();
          const comments = (
            detail.comments || []
          ) as Array<{ author: string; content: string; created_at: string; is_visitor: number; is_resolution: number }>;
          const agentComments = comments
            .filter((c) => !c.is_visitor && !c.is_resolution && AUTHOR_META[c.author])
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 3);
          for (const c of agentComments) {
            const summary = c.content.replace(/#{1,6}\s/g, '').replace(/[*`[\]_>]/g, '').trim().slice(0, 80);
            recentActivities.push({
              agent: c.author,
              action: '의견 제시',
              timestamp: c.created_at,
              postId: post.id,
              content: summary + (c.content.length > 80 ? '...' : ''),
              type: 'comment',
            });
          }
        } catch { /* skip */ }
      }
      recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAiActivities(recentActivities.slice(0, 10));
    } catch { /* skip */ }
  }, []);

  useEffect(() => {
    fetchData();

    const unsubscribe = subscribe((event) => {
      if (
        event.type === 'new_comment' &&
        event.data?.author &&
        AUTHOR_META[event.data.author]?.isAgent !== false
      ) {
        const newActivity: AIActivity = {
          agent: event.data.author,
          action: '의견 제시',
          timestamp: new Date().toISOString(),
          postId: event.post_id,
          content: event.data.content ? event.data.content.slice(0, 100) + '...' : '',
          type: 'comment',
        };
        setAiActivities((prev) => [newActivity, ...prev].slice(0, 10));
      }

      if (
        event.type === 'dev_task_updated' ||
        event.type === 'post_updated' ||
        event.type === 'new_post' ||
        event.type === 'post_deleted'
      ) {
        fetchData();
      }
    });

    return () => unsubscribe();
  }, [subscribe, fetchData]);

  // Fetch activities only when the panel is expanded
  useEffect(() => {
    if (showActivity && aiActivities.length === 0) {
      fetchActivities();
    }
  }, [showActivity, aiActivities.length, fetchActivities]);

  const hasUrgent =
    awaitingTasks.length > 0 ||
    closingPosts.some((p) => {
      const mins = getClosingMinutes(p.board_closes_at);
      return mins !== null && mins < 30;
    });

  if (loading) {
    return (
      <div className="mb-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-zinc-100 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-zinc-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-4">
      {/* Section 1: Urgent Alert Bar */}
      {hasUrgent && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-rose-500 font-bold text-sm shrink-0">즉각 처리 필요</span>
          <div className="flex flex-wrap gap-2 text-sm text-rose-700">
            {awaitingTasks.length > 0 && (
              <span className="font-semibold">DEV 승인대기 {awaitingTasks.length}건</span>
            )}
            {closingPosts.filter((p) => {
              const m = getClosingMinutes(p.board_closes_at);
              return m !== null && m < 30;
            }).length > 0 && (
              <>
                {awaitingTasks.length > 0 && <span className="text-rose-300">·</span>}
                <span className="font-semibold">
                  마감 임박{' '}
                  {
                    closingPosts.filter((p) => {
                      const m = getClosingMinutes(p.board_closes_at);
                      return m !== null && m < 30;
                    }).length
                  }
                  건
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Section 2: 3-column action grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Card A: DEV 승인 */}
        <div className={`bg-white rounded-xl shadow-sm border border-zinc-100 border-l-4 hover:shadow-md transition-shadow flex flex-col ${awaitingTasks.length > 0 ? 'border-l-amber-400' : 'border-l-emerald-400'}`}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-zinc-700">DEV 승인</h3>
              {awaitingTasks.length > 0 && (
                <span className="text-2xl font-bold text-amber-500 leading-none">
                  {awaitingTasks.length}
                </span>
              )}
            </div>

            {awaitingTasks.length > 0 ? (
              <div className="space-y-2">
                {awaitingTasks.slice(0, 3).map((task) => (
                  <Link
                    key={task.id}
                    href="/dev-tasks"
                    className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <span
                      className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.low}`}
                    >
                      {PRIORITY_LABEL[task.priority] ?? task.priority}
                    </span>
                    <p className="text-xs text-zinc-800 line-clamp-1 leading-5">{task.title}</p>
                  </Link>
                ))}
                {awaitingTasks.length > 3 && (
                  <Link
                    href="/dev-tasks"
                    className="block text-center text-xs text-amber-600 hover:text-amber-800 font-medium pt-1"
                  >
                    +{awaitingTasks.length - 3}건 더보기 →
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-emerald-600 font-medium">모두 처리 완료 ✓</p>
            )}
          </div>
        </div>

        {/* Card B: 마감 임박 */}
        <div className={`bg-white rounded-xl shadow-sm border border-zinc-100 border-l-4 hover:shadow-md transition-shadow flex flex-col ${closingPosts.length > 0 ? 'border-l-rose-400' : 'border-l-emerald-400'}`}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-zinc-700">마감 임박</h3>
              {closingPosts.length > 0 && (
                <span className="text-2xl font-bold text-rose-500 leading-none">
                  {closingPosts.length}
                </span>
              )}
            </div>

            {closingPosts.length > 0 ? (
              <div className="space-y-2">
                {closingPosts.slice(0, 4).map((post) => {
                  const mins = getClosingMinutes(post.board_closes_at);
                  const isVeryUrgent = mins !== null && mins < 15;
                  return (
                    <Link
                      key={post.id}
                      href={`/posts/${post.id}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors gap-2"
                    >
                      <p className="text-xs text-zinc-800 line-clamp-1 flex-1">{post.title}</p>
                      {mins !== null && (
                        <span
                          className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isVeryUrgent
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {mins}분 남음
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-emerald-600 font-medium">임박한 마감 없음 ✓</p>
            )}
          </div>
        </div>

        {/* Card C: 이번 주 현황 */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-100 border-l-4 border-l-emerald-400 hover:shadow-md transition-shadow flex flex-col">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-zinc-700">이번 주 현황</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-emerald-600 leading-none">
                  {weeklyStats.rate}%
                </span>
                <span className="text-xs text-zinc-500 pb-0.5">실행률</span>
              </div>

              <div className="w-full bg-zinc-100 rounded-full h-2">
                <div
                  className="bg-emerald-400 h-2 rounded-full transition-all"
                  style={{ width: `${weeklyStats.rate}%` }}
                ></div>
              </div>

              <p className="text-xs text-zinc-500">
                완료{' '}
                <span className="font-semibold text-zinc-700">{weeklyStats.done}건</span>
                {' / 전체 '}
                <span className="font-semibold text-zinc-700">{weeklyStats.total}건</span>
                <span className="ml-1 text-zinc-400">(최근 7일)</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Live AI Activity (collapsed by default) */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowActivity((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            실시간 AI 활동 보기
            {aiActivities.length > 0 && (
              <span className="text-xs text-zinc-400">({aiActivities.length}건)</span>
            )}
          </span>
          <span className="text-zinc-400 text-xs">{showActivity ? '▾' : '▸'}</span>
        </button>

        {showActivity && (
          <div className="border-t border-zinc-100 px-4 py-3 space-y-2">
            {aiActivities.length > 0 ? (
              aiActivities.map((activity, idx) => {
                const meta = AUTHOR_META[activity.agent];
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 py-2 border-b border-zinc-50 last:border-0"
                  >
                    <div className="shrink-0 w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-base">
                      {meta?.emoji || '🤖'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-zinc-800">
                          {meta?.label || activity.agent}
                        </span>
                        <span className="text-[10px] text-zinc-400">{timeAgo(activity.timestamp)}</span>
                        {activity.postId && (
                          <Link
                            href={`/posts/${activity.postId}`}
                            className="text-[10px] text-indigo-400 hover:text-indigo-600 transition-colors ml-auto"
                          >
                            보기 →
                          </Link>
                        )}
                      </div>
                      {activity.content && (
                        <p className="text-[11px] text-zinc-500 line-clamp-1">&ldquo;{activity.content}&rdquo;</p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-zinc-400 text-center py-4">AI 활동 데이터를 불러오는 중...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
