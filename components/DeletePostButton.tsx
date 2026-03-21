'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeletePostButton({ postId }: { postId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('이 포스트를 삭제할까요? 댓글을 포함한 모든 데이터가 영구 삭제됩니다.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      router.push('/');
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {loading ? <span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> : '🗑'}
      포스트 삭제
    </button>
  );
}
