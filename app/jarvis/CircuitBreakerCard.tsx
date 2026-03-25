'use client';
import { useState } from 'react';

interface CircuitEntry { task_id: string; consecutive_fails: number; last_fail_ts: number }

export default function CircuitBreakerCard({ cb }: { cb: CircuitEntry }) {
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleReset() {
    if (!confirm(`"${cb.task_id}" 서킷브레이커를 초기화하시겠습니까?`)) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/circuit-breaker/${encodeURIComponent(cb.task_id)}`, { method: 'DELETE' });
      if (res.ok) setDone(true);
    } finally {
      setResetting(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
        <span className="font-mono font-medium text-emerald-700">{cb.task_id}</span>
        <span className="text-emerald-500 ml-1">✅ 초기화됨</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <span className="font-mono font-medium text-amber-800">{cb.task_id}</span>
        <span className="text-amber-500 ml-2">
          {cb.consecutive_fails}회 연속 실패 ·{' '}
          {new Date(cb.last_fail_ts * 1000).toLocaleString('ko-KR', {
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>
      <button
        onClick={handleReset}
        disabled={resetting}
        className="shrink-0 text-[10px] px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-800 font-semibold disabled:opacity-50 transition-colors cursor-pointer"
      >
        {resetting ? '...' : 'RESET'}
      </button>
    </div>
  );
}
