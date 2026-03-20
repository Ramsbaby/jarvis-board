'use client';

import { useState, useEffect, useRef } from 'react';
import { AUTHOR_META } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import MarkdownContent from '@/components/MarkdownContent';
import VisitorCommentForm from './VisitorCommentForm';
import { useEvent } from '@/contexts/EventContext';

function DiscussionSummary({ postId, commentCount }: { postId: string; commentCount: number }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (commentCount < 2) return;
    setLoading(true);
    fetch(`/api/posts/${postId}/summarize`)
      .then(r => r.json())
      .then(d => { if (d.summary) setSummary(d.summary); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId, commentCount]);

  if (commentCount < 2) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-500 animate-pulse mb-4">
        <span>✨</span> 토론 요약 생성 중...
      </div>
    );
  }

  if (!summary) return null;

  const lines = summary.split('\n').filter(l => l.trim());

  return (
    <div className="mb-4 bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-2.5 text-xs font-semibold text-violet-700">
        <span>✨</span> 토론 요약
      </div>
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="text-xs text-gray-700 leading-relaxed">
            {line.startsWith('•') ? line : `• ${line}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

const PERSONA_BADGE: Record<string, string> = {
  'strategy-lead':    'bg-purple-50 text-purple-700 border-purple-200',
  'infra-lead':       'bg-slate-100 text-slate-700 border-slate-300',
  'career-lead':      'bg-emerald-50 text-emerald-700 border-emerald-200',
  'brand-lead':       'bg-pink-50 text-pink-700 border-pink-200',
  'academy-lead':     'bg-amber-50 text-amber-700 border-amber-200',
  'record-lead':      'bg-cyan-50 text-cyan-700 border-cyan-200',
  'jarvis-proposer':  'bg-violet-50 text-violet-700 border-violet-200',
  'board-synthesizer':'bg-yellow-50 text-yellow-800 border-yellow-200',
  'council-team':     'bg-yellow-50 text-yellow-800 border-yellow-200',
};


export default function PostComments({
  postId,
  initialComments,
  isOwner,
  postCreatedAt,
  postStatus,
}: {
  postId: string;
  initialComments: any[];
  isOwner: boolean;
  postCreatedAt: string;
  postStatus: string;
}) {
  const [comments, setComments] = useState(initialComments);
  const [toast, setToast] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { subscribe } = useEvent();

  // Task #14: compute if discussion time has expired
  const isExpired = postStatus !== 'resolved' &&
    new Date(postCreatedAt).getTime() + 30 * 60 * 1000 < Date.now();

  // Task #11/#12: use singleton SSE via EventContext
  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === 'new_comment' && ev.post_id === postId) {
        setComments(prev =>
          prev.find(c => c.id === ev.data.id) ? prev : [...prev, ev.data]
        );
        setNewIds(prev => new Set(prev).add(ev.data.id));
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast(`💬 ${ev.data?.author_display || '팀원'}이 댓글을 달았습니다`);
        toastTimerRef.current = setTimeout(() => setToast(null), 5000);
      }
    });
  }, [subscribe, postId]);

  const agentComments = comments.filter(c => !c.is_visitor);
  const humanComments = comments.filter(c => c.is_visitor);

  return (
    <section className="space-y-3 relative">
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3 text-sm animate-slide-in-up min-w-[240px] max-w-sm">
          <span className="text-lg shrink-0">💬</span>
          <span className="flex-1 text-gray-700 text-xs leading-snug">{toast}</span>
          <button
            onClick={() => setToast(null)}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors text-base leading-none"
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      )}

      {/* Comment count header */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-gray-900 font-semibold text-base">
          💬 토론 참여 ({comments.length})
        </h3>
        {agentComments.length > 0 && (
          <span className="text-gray-400 text-sm">· 에이전트 {agentComments.length}</span>
        )}
        {humanComments.length > 0 && (
          <span className="text-gray-400 text-sm">· 방문자 {humanComments.length}</span>
        )}
      </div>

      {/* Task #14: Expired CTA for owner */}
      {isExpired && isOwner && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-2 text-sm">
          <span>⏰</span>
          <div className="flex-1">
            <p className="font-medium text-amber-800 text-xs">토론 시간이 종료되었습니다</p>
            <p className="text-amber-600 text-xs">결론 댓글을 작성해 주세요</p>
          </div>
          <button
            onClick={() => document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-xs px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            결론 입력 →
          </button>
        </div>
      )}

      {/* Auto discussion summary */}
      <DiscussionSummary postId={postId} commentCount={comments.length} />

      {/* Comment list */}
      {comments.map((c: any) => {
        const isVisitor = Boolean(c.is_visitor);
        const isResolution = Boolean(c.is_resolution);
        const isNew = newIds.has(c.id);
        const meta = !isVisitor
          ? (AUTHOR_META[c.author as keyof typeof AUTHOR_META] ?? {
              label: c.author_display,
              color: 'bg-gray-100 text-gray-700 border-gray-200',
              emoji: '💬',
            })
          : null;

        // Resolution hero card
        if (isResolution) {
          return (
            <div key={c.id} className={isNew ? 'animate-slide-in' : ''}>
              {/* Section divider: 토론 종료 */}
              <div className="flex items-center gap-3 my-6 text-xs text-gray-400">
                <div className="flex-1 border-t border-gray-200" />
                <span>── 토론 종료 ──</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              {/* Hero card */}
              <div className="resolution-hero p-5 my-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🏆</span>
                  <span className="text-emerald-700 font-bold text-base">최종 토론 결론</span>
                  <div className="flex-1 h-px bg-emerald-200 ml-2" />
                </div>

                <div className="flex gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${meta?.color?.includes('from-') ? meta.color : 'from-emerald-500 to-teal-600'} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {meta?.emoji || c.author_display?.charAt(0) || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {isVisitor ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 border border-gray-200 text-gray-600 text-sm">
                          👤 {c.author_display}
                        </span>
                      ) : meta ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-sm bg-emerald-50 text-emerald-700 border-emerald-200`}>
                          {meta.emoji} {meta.label}
                        </span>
                      ) : null}
                      <span className="text-gray-400 text-xs">{timeAgo(c.created_at)}</span>
                    </div>
                    <MarkdownContent content={c.content} />
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Owner comment — crown avatar
        const isOwnerComment = c.author === 'owner';

        // Badge class based on persona or owner
        const badgeClass = isOwnerComment
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : (PERSONA_BADGE[c.author] ?? (meta?.color?.includes('from-') ? 'bg-gray-100 text-gray-700 border-gray-200' : (meta?.color ?? 'bg-gray-100 text-gray-700 border-gray-200')));

        // Regular comment card
        return (
          <div
            key={c.id}
            className={`flex gap-3 p-4 rounded-xl bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all ${isNew ? 'animate-slide-in' : ''}`}
          >
            {/* Avatar */}
            {isVisitor ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {c.author_display?.charAt(0) || '?'}
              </div>
            ) : isOwnerComment ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {meta?.emoji || '👑'}
              </div>
            ) : (
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                meta?.color?.includes('from-') ? meta.color : 'from-gray-400 to-gray-500'
              } flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                {meta?.emoji || c.author_display?.charAt(0) || '?'}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {isVisitor ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600 text-xs">
                    👤 {c.author_display}
                  </span>
                ) : meta ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${badgeClass}`}>
                    {meta.emoji} {meta.label}
                  </span>
                ) : null}
                <span className="text-gray-400 text-xs">{timeAgo(c.created_at)}</span>
              </div>

              <MarkdownContent content={c.content} />
            </div>
          </div>
        );
      })}

      {/* Comment submission form */}
      <div id="comment-form">
        <VisitorCommentForm
          postId={postId}
          isOwner={isOwner}
          onSubmitted={comment => setComments(prev => [...prev, comment])}
        />
      </div>
    </section>
  );
}
