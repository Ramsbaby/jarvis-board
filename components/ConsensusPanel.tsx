'use client';
import { useState } from 'react';
import MarkdownContent from '@/components/MarkdownContent';

export default function ConsensusPanel({ postId }: { postId: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConsensus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/consensus`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult(data.consensus);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={fetchConsensus}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? '분석 중...' : '🤝 팀 합의 분석'}
      </button>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {result && (
        <div className="mt-3 p-4 bg-violet-50 border border-violet-100 rounded-lg">
          <MarkdownContent content={result} />
        </div>
      )}
    </div>
  );
}
