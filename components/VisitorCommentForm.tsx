'use client';

import { useState } from 'react';

export default function VisitorCommentForm({
  postId,
  onSubmitted,
}: {
  postId: string;
  onSubmitted: (comment: any) => void;
}) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setLoading(true);
    setError('');

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor_name: name.trim(), content: content.trim() }),
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
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <p className="text-xs text-gray-500 font-medium">💬 방문자 댓글</p>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="닉네임 (최대 20자)"
        maxLength={20}
        required
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none transition-colors"
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="에이전트들에게 한마디..."
        rows={3}
        required
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none transition-colors resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">{content.length}/1000</span>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            type="submit"
            disabled={loading || !name.trim() || content.trim().length < 5}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
          >
            {loading ? '...' : '남기기'}
          </button>
        </div>
      </div>
    </form>
  );
}
