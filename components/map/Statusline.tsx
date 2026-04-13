'use client';
import { useEffect, useState } from 'react';

interface StatuslineBlock {
  label: string;
  icon: string;
  value: string;
  raw: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  tooltip: string;
}

interface StatuslineData {
  blocks: StatuslineBlock[];
  updatedAt: string;
}

const REFRESH_MS = 15_000;

const STATUS_COLOR = {
  GREEN: '#3fb950',
  YELLOW: '#d29922',
  RED: '#f85149',
};

/**
 * 좌상단 statusline — 클릭하면 상세 팝오버 토글.
 */
export default function Statusline({ isMobile }: { isMobile: boolean }) {
  const [data, setData] = useState<StatuslineData | null>(null);
  const [err, setErr] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/map/statusline', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as StatuslineData;
        if (!cancelled) {
          setData(json);
          setErr(false);
        }
      } catch {
        if (!cancelled) setErr(true);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (err || !data) return null;

  const visible = isMobile
    ? data.blocks.filter(b => ['5h', '7d', 'CPU', 'Cron 24h'].includes(b.label))
    : data.blocks;

  return (
    <div
      style={{
        position: 'fixed',
        top: isMobile ? 32 : 14,
        left: isMobile ? 6 : 14,
        zIndex: 500,
        display: 'flex',
        gap: isMobile ? 4 : 6,
        pointerEvents: 'auto',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {visible.map((b) => {
        const color = STATUS_COLOR[b.status];
        const isOpen = expanded === b.label;
        return (
          <div key={b.label} style={{ position: 'relative' }}>
            <div
              onClick={() => setExpanded(isOpen ? null : b.label)}
              style={{
                background: 'rgba(13, 17, 23, 0.88)',
                border: `1px solid ${isOpen ? color : color + '35'}`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 8,
                padding: isMobile ? '5px 8px' : '7px 11px',
                color: '#c9d1d9',
                fontSize: isMobile ? 10 : 11,
                backdropFilter: 'blur(10px)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
                display: 'flex',
                flexDirection: 'column' as const,
                gap: 2,
                cursor: 'pointer',
                minWidth: isMobile ? 52 : 64,
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: isMobile ? 10 : 11 }}>{b.icon}</span>
                <span style={{ color: '#6e7681', fontSize: isMobile ? 8 : 9, fontWeight: 600, letterSpacing: 0.3 }}>
                  {b.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 800,
                  color,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: -0.2,
                }}
              >
                {b.value}
              </div>
            </div>

            {/* 상세 팝오버 */}
            {isOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 6,
                  minWidth: 220,
                  maxWidth: 280,
                  background: 'rgba(13, 17, 23, 0.95)',
                  border: `1px solid ${color}50`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: '#c9d1d9',
                  fontSize: 12,
                  lineHeight: 1.7,
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{b.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color }}>{b.label}</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                    padding: '2px 6px', borderRadius: 4,
                    background: color + '20', color,
                  }}>
                    {b.status}
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color, marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                  {b.value}
                </div>
                <div style={{ color: '#8b949e', fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {b.tooltip}
                </div>
                {data.updatedAt && (
                  <div style={{ marginTop: 8, fontSize: 10, color: '#4b5563', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
                    갱신: {new Date(data.updatedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })} KST
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 바깥 클릭 시 닫기 */}
      {expanded && (
        <div
          onClick={() => setExpanded(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 499 }}
        />
      )}
    </div>
  );
}
