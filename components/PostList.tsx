'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AUTHOR_META, TYPE_LABELS, TYPE_COLOR, PRIORITY_BADGE, STATUS_DOT } from '@/lib/constants';
import { timeAgo, truncate } from '@/lib/utils';
import TeamGrid from './TeamGrid';

const TYPES = ['decision', 'discussion', 'issue', 'inquiry'] as const;
const STATUSES = ['open', 'in-progress', 'resolved'] as const;
const STATUS_LABEL_KO: Record<string, string> = { open: '대기', 'in-progress': '처리중', resolved: '해결됨' };

export default function PostList({ initialPosts, authorMeta }: { initialPosts: any[]; authorMeta: any }) {
  const [posts, setPosts] = useState(initialPosts);
  const [teamFilter, setTeamFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sseError, setSseError] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'new_post') setPosts(p => [{ ...ev.data, comment_count: 0 }, ...p]);
        if (ev.type === 'new_comment') {
          setPosts(p => p.map((post: any) =>
            post.id === ev.post_id ? { ...post, comment_count: (post.comment_count || 0) + 1 } : post
          ));
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => setSseError(true);
    return () => es.close();
  }, []);

  // Team stats for TeamGrid
  const teamStats = Object.keys(AUTHOR_META).map(key => ({
    author: key,
    count: posts.filter((p: any) => p.author === key).length,
  }));

  // Apply filters
  const filtered = posts.filter((p: any) => {
    if (teamFilter && p.author !== teamFilter) return false;
    if (typeFilter && p.type !== typeFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <TeamGrid stats={teamStats} onFilter={setTeamFilter} activeTeam={teamFilter} />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 flex-wrap">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(v => v === t ? '' : t)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                typeFilter === t
                  ? TYPE_COLOR[t]
                  : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(v => v === s ? '' : s)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                statusFilter === s
                  ? 'border-gray-500 bg-gray-800 text-gray-200'
                  : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400'
              }`}
            >
              {STATUS_LABEL_KO[s]}
            </button>
          ))}
        </div>
      </div>

      {sseError && (
        <p className="text-xs text-yellow-700 px-2 pb-3">실시간 연결 끊김 — 새로고침 시 최신 내용 확인</p>
      )}

      {/* Post list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">해당 조건의 게시글이 없습니다</p>
          {(teamFilter || typeFilter || statusFilter) && (
            <button
              onClick={() => { setTeamFilter(''); setTypeFilter(''); setStatusFilter(''); }}
              className="mt-3 text-xs text-gray-500 hover:text-gray-400 underline"
            >
              필터 초기화
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((post: any) => {
            const meta = authorMeta[post.author] ?? { label: post.author_display, color: 'bg-gray-800 text-gray-300 border-gray-700', accent: 'border-gray-500', emoji: '💬' };
            const preview = truncate(post.content, 110);
            return (
              <Link key={post.id} href={`/posts/${post.id}`} className="block group">
                <div className={`bg-gray-900 border border-gray-800 border-l-4 ${meta.accent} rounded-xl p-4 group-hover:border-gray-700 group-hover:border-l-4 transition-all`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Top meta */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${TYPE_COLOR[post.type] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                          {TYPE_LABELS[post.type] ?? post.type}
                        </span>
                        {PRIORITY_BADGE[post.priority] && (
                          <span className="text-xs">{PRIORITY_BADGE[post.priority]}</span>
                        )}
                        <span className="ml-auto text-xs text-gray-600">{timeAgo(post.created_at)}</span>
                      </div>
                      {/* Title */}
                      <p className="text-white font-semibold text-sm leading-snug mb-1.5">{post.title}</p>
                      {/* Preview */}
                      {preview && (
                        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-2">{preview}</p>
                      )}
                      {/* Bottom meta */}
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className={`px-2 py-0.5 rounded-md border text-xs ${meta.color}`}>
                          {meta.emoji} {meta.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[post.status] ?? 'bg-gray-600'}`} />
                          {post.status === 'resolved' ? '해결됨' : post.status === 'in-progress' ? '처리중' : '대기'}
                        </span>
                        {post.comment_count > 0 && <span>💬 {post.comment_count}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
