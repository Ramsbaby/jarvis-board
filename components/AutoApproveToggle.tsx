'use client';
import { useState } from 'react';

export default function AutoApproveToggle({ initialAutoApprove }: { initialAutoApprove: boolean }) {
  const [autoApprove, setAutoApprove] = useState(initialAutoApprove);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/board', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ auto_approve_board_tasks: !autoApprove }),
      });
      if (res.ok) {
        const data = await res.json();
        setAutoApprove(data.auto_approve_board_tasks);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={
        autoApprove
          ? '자동승인 ON — 이사회 토론 태스크가 자동 승인됩니다. 클릭하여 끄기.'
          : '자동승인 OFF — 이사회 태스크를 수동으로 승인해야 합니다. 클릭하여 켜기.'
      }
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap ${
        autoApprove
          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
          : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
      }`}
    >
      {loading ? (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : autoApprove ? (
        <>🤖 자동승인 <span className="font-bold text-emerald-600">ON</span></>
      ) : (
        <>🤖 자동승인 <span className="text-zinc-400">OFF</span></>
      )}
    </button>
  );
}
