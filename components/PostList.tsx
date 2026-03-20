'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AUTHOR_META, TYPE_LABELS, PRIORITY_BADGE, STATUS_DOT } from '@/lib/constants';
import { timeAgo, truncate } from '@/lib/utils';
import CountdownTimer from './CountdownTimer';
import { useEvent } from '@/contexts/EventContext';

const TYPES = ['decision', 'discussion', 'issue', 'inquiry'] as const;
const STATUSES = ['open', 'in-progress', 'resolved'] as const;

const STATUS_LABEL_KO: Record<string, string> = {
  open: '토론중',
  'in-progress': '진행중',
  resolved: '결론',
};

const STATUS_STYLE: Record<string, string> = {
  open: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  'in-progress': 'text-amber-600 bg-amber-50 border-amber-200',
  resolved: 'text-zinc-500 bg-zinc-100 border-zinc-200',
};

const TYPE_DOT: Record<string, string> = {
  decision: 'bg-blue-500',
  discussion: 'bg-indigo-500',
  issue: 'bg-red-500',
  inquiry: 'bg-violet-500',
};

interface Stats {
  open: number;
  inProgress: number;
  resolved: number;
}

function PostListInner({
  initialPosts,
  authorMeta,
  stats,
}: {
  initialPosts: any[];
  authorMeta: any;
  stats: Stats;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [posts, setPosts] = useState(initialPosts);
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [authorFilter, setAuthorFilter] = useState(searchParams.get('author') || '');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'comments'>('newest');
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | null>(null);

  const { subscribe } = useEvent();

  // Task #15: initialize notification permission state on mount
  useEffect(() => {
    if ('Notification' in window) setNotifPerm(Notification.permission);
  }, []);

  function pushFilter(t: string, s: string, a: string) {
    const p = new URLSearchParams();
    if (t) p.set('type', t);
    if (s) p.set('status', s);
    if (a) p.set('author', a);
    const q = p.toString();
    router.replace(q ? `/?${q}` : '/', { scroll: false });
  }

  useEffect(() => {
    setTypeFilter(searchParams.get('type') || '');
    setStatusFilter(searchParams.get('status') || '');
    setAuthorFilter(searchParams.get('author') || '');
  }, [searchParams]);

  // Task #11/#12: use singleton SSE via EventContext
  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === 'new_post') {
        setPosts(p => [{ ...ev.data, comment_count: 0 }, ...p]);
        // Task #15: browser notification
        if (notifPerm === 'granted') {
          new Notification('새 토론 📋', { body: ev.data?.title, icon: '/favicon.ico' });
        }
      }
      if (ev.type === 'new_comment') {
        setPosts(p => p.map((post: any) =>
          post.id === ev.post_id ? { ...post, comment_count: (post.comment_count || 0) + 1 } : post
        ));
      }
    });
  }, [subscribe, notifPerm]);

  const typeCounts = Object.fromEntries(
    TYPES.map(t => [t, posts.filter((p: any) => p.type === t).length])
  );

  const filtered = posts.filter((p: any) => {
    if (typeFilter && p.type !== typeFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (authorFilter && p.author !== authorFilter) return false;
    return true;
  });

  // Task #22: client-side sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'comments') return (b.comment_count || 0) - (a.comment_count || 0);
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const hasFilter = !!(typeFilter || statusFilter || authorFilter);

  function clearFilters() {
    setTypeFilter('');
    setStatusFilter('');
    setAuthorFilter('');
    router.replace('/', { scroll: false });
  }

  return (
    <div>
      {/* ── FILTER BAR ── */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {/* Type tabs */}
        <button
          onClick={() => { setTypeFilter(''); pushFilter('', statusFilter, authorFilter); }}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
            !typeFilter
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
          }`}
        >
          전체
        </button>
        {TYPES.map(t => (
          <button
            key={t}
            onClick={() => {
              const next = typeFilter === t ? '' : t;
              setTypeFilter(next);
              pushFilter(next, statusFilter, authorFilter);
            }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
              typeFilter === t
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${typeFilter === t ? 'bg-white' : (TYPE_DOT[t] ?? 'bg-zinc-400')}`} />
            {TYPE_LABELS[t]}
            {typeCounts[t] > 0 && (
              <span className={`${typeFilter === t ? 'opacity-70' : 'text-zinc-400'}`}>{typeCounts[t]}</span>
            )}
          </button>
        ))}

        {/* Divider */}
        <span className="w-px h-5 bg-zinc-200 mx-1" />

        {/* Status chips */}
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => {
              const next = statusFilter === s ? '' : s;
              setStatusFilter(next);
              pushFilter(typeFilter, next, authorFilter);
            }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${
              statusFilter === s
                ? 'bg-zinc-900 text-white font-medium'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === s ? 'bg-white' : STATUS_DOT[s]}`} />
            {STATUS_LABEL_KO[s]}
          </button>
        ))}

        {/* Author filter chip */}
        {authorFilter && (
          <button
            onClick={() => { setAuthorFilter(''); pushFilter(typeFilter, statusFilter, ''); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900 text-white font-medium"
          >
            {authorFilter} ×
          </button>
        )}

        {hasFilter && (
          <button onClick={clearFilters} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
            초기화 ×
          </button>
        )}

        {/* Task #22: Sort dropdown */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="ml-auto text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-600 focus:outline-none focus:border-zinc-400"
        >
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="comments">댓글 많은순</option>
        </select>

        {/* Task #15: Notification permission button */}
        {notifPerm === 'default' && (
          <button
            onClick={async () => {
              const perm = await Notification.requestPermission();
              setNotifPerm(perm);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
          >
            알림 받기
          </button>
        )}
      </div>

      {/* ── MAIN FEED ── */}
      <main>
        {/* Result bar */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <span className="text-zinc-400 text-xs">
            {hasFilter ? `${sorted.length}개 결과` : `전체 ${posts.length}개`}
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-500 mb-1">해당 조건의 포스트가 없습니다</p>
            <p className="text-xs text-zinc-400 mb-4">다른 필터를 선택하거나 조건을 변경해보세요</p>
            <button
              onClick={clearFilters}
              className="text-xs px-3 py-1.5 border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((post: any) => {
              const meta = authorMeta[post.author] ?? {
                label: post.author_display,
                color: 'bg-zinc-100 text-zinc-600 border-zinc-200',
                emoji: '',
              };
              const preview = truncate(post.content, 140);
              const isResolved = post.status === 'resolved';

              return (
                <Link key={post.id} href={`/posts/${post.id}`} className="block group">
                  <article className={`bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm rounded-lg overflow-hidden transition-all duration-150 ${isResolved ? 'opacity-60' : ''}`}>
                    <div className="p-4">
                      {/* Type + priority + time */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md border font-medium bg-zinc-50 text-zinc-700 border-zinc-200">
                          <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[post.type] ?? 'bg-zinc-400'}`} />
                          {TYPE_LABELS[post.type] ?? post.type}
                        </span>
                        {PRIORITY_BADGE[post.priority] && (
                          <span className="text-xs text-zinc-500">{PRIORITY_BADGE[post.priority]}</span>
                        )}
                        <span className="ml-auto text-zinc-400 text-xs shrink-0">{timeAgo(post.created_at)}</span>
                      </div>

                      {/* Title */}
                      <h2 className="text-sm font-medium text-zinc-900 leading-snug mb-1.5">
                        {post.title}
                      </h2>

                      {/* Preview */}
                      {preview && (
                        <p className="text-xs text-zinc-500 leading-relaxed mb-3 line-clamp-2">{preview}</p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] ${meta.color}`}>
                          {meta.emoji ? `${meta.emoji} ` : ''}{meta.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] ${STATUS_STYLE[post.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[post.status] ?? 'bg-zinc-300'}`} />
                          {STATUS_LABEL_KO[post.status]}
                        </span>
                        {/* Countdown visible badge — only for open/in-progress */}
                        {post.status !== 'resolved' && (
                          <CountdownTimer
                            expiresAt={new Date(new Date(post.created_at).getTime() + 30 * 60 * 1000).toISOString()}
                            variant="badge"
                          />
                        )}
                        {post.status !== 'resolved' ? (
                          <span className="ml-auto text-xs px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-500 flex items-center gap-1">
                            💬 {post.comment_count || 0}개 의견
                          </span>
                        ) : (
                          post.comment_count > 0 && (
                            <span className="ml-auto text-xs px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-500 flex items-center gap-1">
                              💬 {post.comment_count}
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Countdown bar — full width at bottom */}
                    {post.status !== 'resolved' && (
                      <CountdownTimer
                        expiresAt={new Date(new Date(post.created_at).getTime() + 30 * 60 * 1000).toISOString()}
                        variant="bar"
                      />
                    )}
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function PostList(props: Parameters<typeof PostListInner>[0]) {
  return (
    <Suspense fallback={<div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-24 bg-white border border-zinc-200 rounded-lg animate-pulse"/>)}</div>}>
      <PostListInner {...props} />
    </Suspense>
  );
}
