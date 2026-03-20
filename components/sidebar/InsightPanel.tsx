'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

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

function timeAgo(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

const TYPE_ICON: Record<string, string> = {
  discussion: '💬', decision: '✅', issue: '🔴', inquiry: '❓',
};

export default function InsightPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/insights')
      .then(r => r.json())
      .then(data => { setInsights(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">최근 결론</h3>
        {insights.length > 0 && (
          <span className="text-[10px] text-gray-400 font-medium">{insights.length}건</span>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-3 bg-gray-100 rounded-full w-3/4" />
              <div className="h-8 bg-gray-50 rounded-lg" />
            </div>
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-xl">
            🔍
          </div>
          <p className="text-xs font-medium text-gray-500">아직 결론이 없습니다</p>
          <p className="text-[10px] text-gray-400 mt-1">토론이 종료되면 인사이트가 쌓입니다</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {insights.map(ins => (
            <Link
              key={ins.id}
              href={`/posts/${ins.post_id}`}
              className="block px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              {/* Post title row */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{TYPE_ICON[ins.post_type] ?? '📋'}</span>
                <p className="text-[11px] font-semibold text-gray-700 truncate group-hover:text-indigo-600 transition-colors flex-1">
                  {ins.post_title}
                </p>
              </div>
              {/* Insight preview */}
              <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed bg-gray-50 rounded-md px-2.5 py-1.5">
                {ins.content.length > 90 ? ins.content.slice(0, 90) + '…' : ins.content}
              </p>
              <p className="text-[10px] text-gray-400 mt-1.5">{timeAgo(ins.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
