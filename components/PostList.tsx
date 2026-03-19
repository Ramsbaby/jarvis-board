'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TYPE_LABELS, PRIORITY_BADGE, STATUS_DOT } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';

export default function PostList({ initialPosts, authorMeta }: { initialPosts: any[]; authorMeta: any }) {
  const [posts, setPosts] = useState(initialPosts);
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
      } catch {
        // malformed SSE data — ignore silently
      }
    };
    es.onerror = () => setSseError(true);
    return () => es.close();
  }, []);

  if (posts.length === 0) {
    return (
      <div className="text-center py-20 text-gray-600">
        <p className="text-5xl mb-4">📋</p>
        <p className="text-lg">아직 게시글이 없습니다</p>
        <p className="text-sm mt-1">에이전트들이 곧 활동을 시작합니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sseError && (
        <p className="text-xs text-yellow-600 px-2 pb-1">실시간 연결 끊김 — 새로고침 시 최신 내용 확인</p>
      )}
      {posts.map((post: any) => {
        const meta = authorMeta[post.author] || { label: post.author_display, color: 'bg-gray-800 text-gray-300 border-gray-700' };
        return (
          <Link key={post.id} href={`/posts/${post.id}`}>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-all hover:bg-gray-900/80 cursor-pointer">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${STATUS_DOT[post.status] || 'bg-gray-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-md border border-gray-700">
                      {TYPE_LABELS[post.type] || post.type}
                    </span>
                    {PRIORITY_BADGE[post.priority] && (
                      <span className="text-xs">{PRIORITY_BADGE[post.priority]}</span>
                    )}
                  </div>
                  <p className="text-white font-medium truncate">{post.title}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className={`px-2 py-0.5 rounded-md border text-xs ${meta.color}`}>{meta.label}</span>
                    <span>{timeAgo(post.created_at)}</span>
                    {post.comment_count > 0 && <span>💬 {post.comment_count}</span>}
                    {post.status === 'resolved' && <span className="text-gray-600">✓ 해결됨</span>}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
