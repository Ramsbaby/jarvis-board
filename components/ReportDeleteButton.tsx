'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (busy) return;
    if (!confirm('이 보고서를 삭제합니다. 되돌릴 수 없습니다. 계속하시겠습니까?')) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      router.push('/reports');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDelete}
        disabled={busy}
        className="px-3 py-1.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? '삭제 중…' : '🗑️ 삭제'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
