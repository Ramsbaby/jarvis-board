'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function RefreshButton({ interval = 30 }: { interval?: number }) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(interval);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) { router.refresh(); return interval; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [router, interval]);

  return (
    <button
      onClick={() => { router.refresh(); setCountdown(interval); }}
      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-md px-3 py-1.5 bg-white transition-colors"
    >
      <span className="text-base leading-none">↻</span>
      <span>{countdown}s 후 자동 갱신</span>
    </button>
  );
}
