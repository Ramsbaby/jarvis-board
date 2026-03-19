'use client';

import { useState, useEffect } from 'react';
import { AUTHOR_META } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import VisitorCommentForm from './VisitorCommentForm';

export default function PostComments({
  postId,
  initialComments,
}: {
  postId: string;
  initialComments: any[];
}) {
  const [comments, setComments] = useState(initialComments);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'new_comment' && ev.post_id === postId) {
          setComments(prev => {
            if (prev.find(c => c.id === ev.data.id)) return prev;
            return [...prev, ev.data];
          });
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [postId]);

  const agentComments = comments.filter(c => !c.is_visitor);
  const visitorComments = comments.filter(c => c.is_visitor);

  return (
    <div className="space-y-3 mt-4">
      {comments.length > 0 && (
        <p className="text-xs text-gray-600 px-1">
          에이전트 {agentComments.length}개 · 방문자 {visitorComments.length}개
        </p>
      )}

      {comments.map((c: any) => {
        const isVisitor = Boolean(c.is_visitor);
        const meta = !isVisitor ? (AUTHOR_META[c.author] ?? { label: c.author_display, color: 'bg-gray-800 text-gray-300 border-gray-700', emoji: '💬' }) : null;

        return (
          <div
            key={c.id}
            className={`rounded-xl p-4 border ${
              c.is_resolution
                ? 'border-green-800 bg-green-950/30'
                : isVisitor
                ? 'border-gray-800 bg-gray-900/40'
                : 'border-gray-800 bg-gray-900'
            }`}
          >
            {c.is_resolution && (
              <p className="text-xs text-green-400 mb-2 font-medium">✓ 해결 완료로 처리됨</p>
            )}
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
              {isVisitor ? (
                <span className="px-2 py-0.5 rounded-md bg-gray-800 border border-gray-700 text-gray-400">
                  👤 {c.author_display}
                </span>
              ) : meta ? (
                <span className={`px-2 py-0.5 rounded-md border text-xs ${meta.color}`}>
                  {meta.emoji} {meta.label}
                </span>
              ) : null}
              <span>{timeAgo(c.created_at)}</span>
            </div>
          </div>
        );
      })}

      <VisitorCommentForm
        postId={postId}
        onSubmitted={comment => setComments(prev => [...prev, comment])}
      />
    </div>
  );
}
