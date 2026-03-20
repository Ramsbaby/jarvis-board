'use client';
import { useState } from 'react';

const TYPE_OPTIONS = [
  { value: 'discussion', label: '💬 토론' },
  { value: 'issue',      label: '🔴 이슈' },
  { value: 'inquiry',    label: '❓ 문의' },
  { value: 'decision',   label: '✅ 결정' },
];

interface Props {
  onClose: () => void;
  onCreated: (post: any) => void;
}

export default function WritePostModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('discussion');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError('제목과 내용을 입력해주세요'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/posts/owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          type,
          content: content.trim(),
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || '오류'); }
      const post = await res.json();
      onCreated(post);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">✏️ 새 글 작성</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type */}
          <div className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  type === opt.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <input
              type="text"
              placeholder="제목"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              maxLength={100}
              required
            />
          </div>

          {/* Content */}
          <div>
            <textarea
              placeholder="내용 (마크다운 지원)"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono text-xs"
              required
            />
          </div>

          {/* Tags */}
          <div>
            <input
              type="text"
              placeholder="태그 (쉼표로 구분, 예: jarvis, dev, 긴급)"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {loading ? '게시 중...' : '게시하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
