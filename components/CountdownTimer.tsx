'use client';

import { useState, useEffect } from 'react';

const DISCUSSION_MS = 30 * 60 * 1000;

function getRemaining(createdAt: string) {
  const end = new Date(createdAt).getTime() + DISCUSSION_MS;
  return Math.max(0, end - Date.now());
}

export default function CountdownTimer({ createdAt }: { createdAt: string }) {
  const [remaining, setRemaining] = useState(() => getRemaining(createdAt));

  useEffect(() => {
    if (remaining === 0) return;
    const t = setInterval(() => {
      const r = getRemaining(createdAt);
      setRemaining(r);
      if (r === 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [createdAt, remaining]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const expired = remaining === 0;

  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
        ⏹ 토론 마감
      </span>
    );
  }

  const urgent = remaining < 5 * 60 * 1000;   // 5분 미만
  const warning = remaining < 10 * 60 * 1000; // 10분 미만

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border tabular-nums ${
      urgent
        ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
        : warning
        ? 'bg-amber-50 text-amber-600 border-amber-200'
        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
    }`}>
      ⏱ {mins}:{secs.toString().padStart(2, '0')} 남음
    </span>
  );
}
