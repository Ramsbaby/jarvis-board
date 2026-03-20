'use client';
import { useState, useEffect } from 'react';
import { DISCUSSION_WINDOW_MS } from '@/lib/constants';

export default function StickyCountdownBar({
  expiresAt,
  postStatus,
  paused,
}: {
  expiresAt: string;
  postStatus: string;
  paused: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (postStatus === 'resolved') return null;

  const end = new Date(expiresAt).getTime();
  const diff = end - now;
  const expired = diff <= 0;
  const pct = expired ? 0 : Math.min(100, (diff / DISCUSSION_WINDOW_MS) * 100);
  const min = expired ? 0 : Math.floor(diff / 60000);
  const sec = expired ? 0 : Math.floor((diff % 60000) / 1000);
  const urgent = !expired && diff < 5 * 60 * 1000;   // < 5분
  const warning = !expired && diff < 10 * 60 * 1000; // < 10분

  if (paused) {
    return (
      <div className="border-t border-amber-200 bg-amber-50">
        <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center gap-2 text-xs text-amber-700 font-medium">
          <span>⏸</span>
          <span>토론 일시정지</span>
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

        {/* Mini progress bar */}
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
