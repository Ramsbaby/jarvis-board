'use client';
import { useState, useEffect } from 'react';
import { DISCUSSION_WINDOW_MS } from '@/lib/constants';
import { useEvent } from '@/contexts/EventContext';

export default function StickyCountdownBar({
  expiresAt: initialExpiresAt,
  postStatus,
  paused: initialPaused,
  postId,
}: {
  expiresAt: string;
  postStatus: string;
  paused: boolean;
  postId?: string;
}) {
  const [paused, setPaused] = useState(initialPaused);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [now, setNow] = useState(() => Date.now());
  const { subscribe } = useEvent();

  // Subscribe to SSE post_updated to react to pause/resume without page refresh
  useEffect(() => {
    if (!postId) return;
    return subscribe((ev) => {
      if (ev.type === 'post_updated' && ev.post_id === postId && ev.data) {
        if (typeof ev.data.paused === 'boolean') {
          setPaused(ev.data.paused);
          // If resuming and extra_ms provided, adjust expiresAt
          if (!ev.data.paused && typeof ev.data.extra_ms === 'number') {
            const base = new Date(initialExpiresAt).getTime();
            // extra_ms difference from original
            setExpiresAt(new Date(base + ev.data.extra_ms).toISOString());
          }
        }
      }
    });
  }, [subscribe, postId, initialExpiresAt]);

  // Only tick when NOT paused
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused]);

  if (postStatus === 'resolved') return null;

  const end = new Date(expiresAt).getTime();
  const diff = end - now;
  const expired = diff <= 0;
  const pct = expired ? 0 : Math.min(100, (diff / DISCUSSION_WINDOW_MS) * 100);
  const min = expired ? 0 : Math.floor(diff / 60000);
  const sec = expired ? 0 : Math.floor((diff % 60000) / 1000);
  const urgent = !expired && diff < 5 * 60 * 1000;
  const warning = !expired && diff < 10 * 60 * 1000;

  if (paused) {
    return (
      <div className="border-t border-amber-200 bg-amber-50">
        <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center gap-2 text-xs text-amber-700 font-medium">
          <span>⏸</span>
          <span>토론 일시정지 — {expired ? '마감' : `${min}분 ${String(sec).padStart(2, '0')}초 남음`} (정지됨)</span>
          <div className="ml-auto h-1 w-20 bg-amber-200 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const barColor = expired || urgent ? 'bg-red-500' : warning ? 'bg-amber-400' : 'bg-emerald-500';
  const rowBg   = expired ? 'bg-red-50 border-red-200' : urgent ? 'bg-red-50/80 border-red-100' : warning ? 'bg-amber-50/80 border-amber-100' : 'bg-emerald-50/50 border-emerald-100';
  const textCls = expired || urgent ? 'text-red-700' : warning ? 'text-amber-700' : 'text-emerald-700';
  const dotCls  = expired || urgent ? 'bg-red-500 animate-pulse' : warning ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500';

  return (
    <div className={`border-t ${rowBg}`}>
      <div className={`max-w-5xl mx-auto px-4 py-1.5 flex items-center gap-3 text-xs font-semibold tabular-nums ${textCls}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />

        {expired
          ? <span>토론 마감</span>
          : <span>토론 마감까지 <strong className={`${urgent ? 'text-lg' : ''}`}>{min}분 {String(sec).padStart(2, '0')}초</strong> 남음</span>
        }

        <div className="ml-auto h-1.5 w-32 bg-white/70 rounded-full overflow-hidden border border-black/5 flex-shrink-0">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${barColor} ${urgent ? 'animate-pulse' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
