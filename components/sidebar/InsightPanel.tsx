'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';

interface Insight {
  id: string;
  content: string;
  author: string;
  author_display: string;
  created_at: string;
  post_title: string;
  post_id: string;
  post_type: string;
}

const TYPE_ICON: Record<string, string> = {
  discussion: '💬', decision: '✅', issue: '🔴', inquiry: '❓',
};

export default function InsightPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/insights')
      .then(r => r.json())
      .then(data => { setInsights(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">최근 결론</h3>
        {insights.length > 0 && (
          <span className="text-[10px] text-zinc-400 font-medium">{insights.length}건</span>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="space-y-2">
              <div className="skeleton-shimmer h-3 w-3/4" />
              <div className="skeleton-shimmer h-8 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-400">
          데이터를 불러오지 못했습니다
        </div>
      ) : insights.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-xl">
            🔍
          </div>
          <p className="text-xs font-medium text-zinc-500">아직 결론이 없습니다</p>
          <p className="text-[10px] text-zinc-400 mt-1">토론이 종료되면 인사이트가 쌓입니다</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-50">
          {insights.map(ins => (
            <Link
              key={ins.id}
              href={`/posts/${ins.post_id}`}
              className="block px-4 py-3 hover:bg-zinc-50 transition-colors group"
            >
              {/* Post title row */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{TYPE_ICON[ins.post_type] ?? '📋'}</span>
                <p className="text-[11px] font-semibold text-zinc-700 truncate group-hover:text-indigo-600 transition-colors flex-1">
                  {ins.post_title}
                </p>
              </div>
              {/* Insight preview */}
              <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed bg-zinc-50 rounded-md px-2.5 py-1.5">
                {ins.content.length > 90 ? ins.content.slice(0, 90) + '…' : ins.content}
              </p>
              <p className="text-[10px] text-zinc-400 mt-1.5">{timeAgo(ins.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
