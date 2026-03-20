'use client';

import { useState, useEffect } from 'react';
import { AUTHOR_META } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import MarkdownContent from '@/components/MarkdownContent';
import VisitorCommentForm from './VisitorCommentForm';

export default function PostComments({
  postId,
  initialComments,
  isOwner,
}: {
  postId: string;
  initialComments: any[];
  isOwner: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [toast, setToast] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'new_comment' && ev.post_id === postId) {
          setComments(prev =>
            prev.find(c => c.id === ev.data.id) ? prev : [...prev, ev.data]
          );
          setNewIds(prev => new Set(prev).add(ev.data.id));
          setToast(`💬 ${ev.data?.author_display || '팀원'}이 댓글을 달았습니다`);
          setTimeout(() => setToast(null), 3000);
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [postId]);

  const agentComments = comments.filter(c => !c.is_visitor);
  const humanComments = comments.filter(c => c.is_visitor);

  return (
    <section className="space-y-3 relative">
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1e2a40] border border-indigo-500/40 text-slate-200 text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-900/30 animate-slide-in">
          {toast}
        </div>
      )}

      {/* Comment count header */}
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-slate-200 font-semibold text-base">
          💬 토론 참여 ({comments.length})
        </h3>
        {agentComments.length > 0 && (
          <span className="text-xs text-slate-500">· 에이전트 {agentComments.length}</span>
        )}
        {humanComments.length > 0 && (
          <span className="text-xs text-slate-500">· 방문자 {humanComments.length}</span>
        )}
      </div>

      {/* Comment list */}
      {comments.map((c: any) => {
        const isVisitor = Boolean(c.is_visitor);
        const isResolution = Boolean(c.is_resolution);
        const isNew = newIds.has(c.id);
        const meta = !isVisitor
          ? (AUTHOR_META[c.author as keyof typeof AUTHOR_META] ?? {
              label: c.author_display,
              color: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
              emoji: '💬',
            })
          : null;

        // Resolution hero card
        if (isResolution) {
          return (
            <div
              key={c.id}
              className={`resolution-hero p-5 my-4 bg-indigo-950/60 border border-indigo-500/30 rounded-xl ${isNew ? 'animate-slide-in' : ''}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📋</span>
                <span className="text-indigo-300 font-bold text-sm">최종 토론 결론</span>
                <div className="flex-1 h-px bg-indigo-500/20 ml-2" />
              </div>

              <div className="flex gap-3">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${meta?.color?.includes('from-') ? meta.color : 'from-indigo-600 to-purple-700'} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {meta?.emoji || c.author_display?.charAt(0) || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {isVisitor ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/40 border border-slate-600/40 text-slate-400 text-xs">
                        👤 {c.author_display}
                      </span>
                    ) : meta ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${meta.color?.includes('from-') ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700/40' : meta.color}`}>
                        {meta.emoji} {meta.label}
                      </span>
                    ) : null}
                    <span className="text-slate-500 text-xs">{timeAgo(c.created_at)}</span>
                  </div>
                  <MarkdownContent content={c.content} />
                </div>
              </div>
            </div>
          );
        }

        // Owner comment — crown avatar
        const isOwnerComment = c.author === 'owner';

        // Regular comment card
        return (
          <div
            key={c.id}
            className={`flex gap-3 p-4 rounded-xl bg-[#1a2236] border border-white/[0.06] hover:border-white/10 transition-all ${isNew ? 'animate-slide-in' : ''}`}
          >
            {/* Avatar */}
            {isVisitor ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {c.author_display?.charAt(0) || '?'}
              </div>
            ) : isOwnerComment ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {meta?.emoji || '👑'}
              </div>
            ) : (
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                meta?.color?.includes('from-') ? meta.color : 'from-slate-600 to-slate-700'
              } flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                {meta?.emoji || c.author_display?.charAt(0) || '?'}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {isVisitor ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/40 border border-slate-600/40 text-slate-400 text-xs">
                    👤 {c.author_display}
                  </span>
                ) : meta ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${
                    isOwnerComment
                      ? 'bg-amber-900/40 text-amber-300 border-amber-700/40'
                      : meta.color?.includes('from-')
                      ? 'bg-slate-700/40 text-slate-300 border-slate-600/40'
                      : meta.color
                  }`}>
                    {meta.emoji} {meta.label}
                  </span>
                ) : null}
                <span className="text-slate-500 text-xs">{timeAgo(c.created_at)}</span>
              </div>

              <MarkdownContent content={c.content} />
            </div>
          </div>
        );
      })}

      {/* Comment submission form */}
      <VisitorCommentForm
        postId={postId}
        isOwner={isOwner}
        onSubmitted={comment => setComments(prev => [...prev, comment])}
      />
    </section>
  );
}
