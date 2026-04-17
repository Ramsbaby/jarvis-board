'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ReportType = 'daily' | 'weekly' | 'monthly';

export default function ReportGenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<ReportType | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const handleGenerate = async (type: ReportType) => {
    if (busy) return;
    setBusy(type);
    setMsg(null);
    try {
      const now = new Date();
      const kst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60_000);
      const day = kst.toISOString().slice(0, 10); // KST 기준 오늘

      let periodStart: string;
      let periodEnd: string;
      if (type === 'daily') {
        periodStart = `${day} 00:00:00`;
        periodEnd = `${day} 23:59:59`;
      } else if (type === 'weekly') {
        const start = new Date(kst);
        start.setUTCDate(start.getUTCDate() - 6);
        periodStart = `${start.toISOString().slice(0, 10)} 00:00:00`;
        periodEnd = `${day} 23:59:59`;
      } else {
        periodStart = `${day.slice(0, 7)}-01 00:00:00`;
        periodEnd = `${day} 23:59:59`;
      }

      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, period_start: periodStart, period_end: periodEnd }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data.skipped) {
        setMsg('이미 같은 날짜의 보고서가 있습니다.');
      } else {
        setMsg(`생성 완료. 태스크 ${data.taskCount}건 · 이슈 ${data.issueCount}건.`);
      }
      router.refresh();
    } catch (e) {
      setMsg(`실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {(['daily', 'weekly', 'monthly'] as ReportType[]).map(type => {
        const label = { daily: '오늘 일일', weekly: '이번 주', monthly: '이번 달' }[type];
        return (
          <button
            key={type}
            onClick={() => handleGenerate(type)}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy === type ? '생성 중…' : `➕ ${label} 생성`}
          </button>
        );
      })}
      {msg && <span className="text-xs text-zinc-500 ml-1">{msg}</span>}
    </div>
  );
}
