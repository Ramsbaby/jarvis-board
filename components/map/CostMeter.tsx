'use client';
import { useEffect, useState } from 'react';

interface CostData {
  today: number;
  month: number;
  cap: number;
  percentOfCap: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
}

const REFRESH_MS = 60_000;

export default function CostMeter({ isMobile }: { isMobile: boolean }) {
  const [data, setData] = useState<CostData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCost = async () => {
      try {
        const res = await fetch('/api/map/cost', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CostData;
        if (!cancelled) {
          setData(json);
          setErr(false);
        }
      } catch {
        if (!cancelled) setErr(true);
      }
    };
    fetchCost();
    const id = setInterval(fetchCost, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (err || !data) return null;

  const color =
    data.status === 'RED' ? '#f85149' : data.status === 'YELLOW' ? '#d29922' : '#3fb950';
  const fmt = (v: number) =>
    v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;

  return (
    <div
      title={`오늘 Claude 비용. 일일 상한 $${data.cap.toFixed(2)}. 월 누적 ${fmt(data.month)}.`}
      style={{
        position: 'fixed',
        top: isMobile ? 8 : 14,
        left: isMobile ? 8 : 14,
        zIndex: 500,
        background: 'rgba(13, 17, 23, 0.85)',
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: isMobile ? '6px 10px' : '8px 14px',
        color: '#c9d1d9',
        fontSize: isMobile ? 10 : 11,
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        backdropFilter: 'blur(8px)',
        boxShadow: `0 2px 12px rgba(0,0,0,0.4)`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: isMobile ? 12 : 13 }}>💰</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
          <span style={{ color: color, fontWeight: 800, fontSize: isMobile ? 11 : 12 }}>
            {fmt(data.today)}
          </span>
          <span style={{ color: '#6e7681', fontSize: 9 }}>/ ${data.cap.toFixed(2)} 상한</span>
        </div>
        <div
          style={{
            height: 3,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 2,
            overflow: 'hidden',
            width: isMobile ? 70 : 100,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${data.percentOfCap}%`,
              background: color,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      </div>
      {!isMobile && (
        <span style={{ color: '#484f58', fontSize: 9, marginLeft: 2 }}>
          월 {fmt(data.month)}
        </span>
      )}
    </div>
  );
}
