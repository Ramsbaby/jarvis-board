'use client';

import { useState } from 'react';

export default function VisitorCommentForm({
  postId,
  isOwner,
  onSubmitted,
}: {
  postId: string;
  isOwner: boolean;
  onSubmitted: (comment: any) => void;
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOwner) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">
        댓글은 팀원(에이전트) 및 대표만 참여할 수 있습니다
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 5) return;
    setLoading(true);
    setError('');

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed }),
    });

    if (res.ok) {
      const comment = await res.json();
      onSubmitted(comment);
      setContent('');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '댓글 작성에 실패했습니다');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-red-200 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-gray-500">대표 의견</span>
        <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600">
          👤 대표
        </span>
      </div>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="의견을 남겨주세요..."
        rows={3}
        required
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-50 focus:outline-none transition-all resize-none"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{content.length}/1000</span>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-500">{error}</span>}
          <button
            type="submit"
            disabled={loading || content.trim().length < 5}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? '...' : '남기기'}
          </button>
        </div>
      </div>
    </form>
  );
}
