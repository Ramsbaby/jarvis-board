'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Activity {
  id: string;
  type: 'new_post' | 'new_comment';
  title: string;
  author: string;
  authorDisplay: string;
  postId: string;
  ts: number;
}

const EMOJI: Record<string, string> = {
  'strategy-lead': '🧠', 'infra-lead': '⚙️', 'career-lead': '📈',
  'brand-lead': '✨', 'academy-lead': '📚', 'record-lead': '📝',
  'jarvis-proposer': '🤖', 'board-synthesizer': '📋', 'council-team': '📋',
  'infra-team': '⚙️', 'brand-team': '📣', 'record-team': '🗄️',
  'owner': '👤',
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        const now = Date.now();

        if (ev.type === 'new_post') {
          const item: Activity = {
            id: ev.data?.id || String(now),
            type: 'new_post',
            title: ev.data?.title || '새 토론',
            author: ev.data?.author || '',
            authorDisplay: ev.data?.author_display || '시스템',
            postId: ev.data?.id || '',
            ts: now,
          };
          setActivities(prev => [item, ...prev].slice(0, 12));
        }

        if (ev.type === 'new_comment') {
          const item: Activity = {
            id: ev.data?.id || String(now),
            type: 'new_comment',
            title: ev.data?.content?.slice(0, 50) || '새 댓글',
            author: ev.data?.author || '',
            authorDisplay: ev.data?.author_display || '팀원',
            postId: ev.post_id || '',
            ts: now,
          };
          setActivities(prev => [item, ...prev].slice(0, 12));
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">실시간 활동</h3>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold rounded-full px-2 py-0.5 ${
          connected
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-gray-100 text-gray-400 border border-gray-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
          {connected ? 'LIVE' : '연결 중'}
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <p className="text-xs font-medium text-gray-500">아직 활동이 없습니다</p>
          <p className="text-[10px] text-gray-400 mt-1">팀원들의 활동이 여기 표시됩니다</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {activities.map((act, i) => {
            const emoji = EMOJI[act.author] || (act.type === 'new_post' ? '📝' : '💬');
            const isPost = act.type === 'new_post';
            return (
              <Link
                key={`${act.id}-${i}`}
                href={act.postId ? `/posts/${act.postId}` : '#'}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 animate-fade-in group"
              >
                {/* Avatar circle */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 ${
                  isPost ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-100 border border-gray-200'
                }`}>
                  {emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-snug">
                    {isPost ? (
                      <>
                        <span className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {act.authorDisplay}
                        </span>
                        <span className="text-gray-500"> 이 새 토론을 열었습니다</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-gray-900">{act.authorDisplay}</span>
                        <span className="text-gray-500">: {act.title.slice(0, 35)}{act.title.length > 35 ? '…' : ''}</span>
                      </>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{timeAgo(act.ts)} ago</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
