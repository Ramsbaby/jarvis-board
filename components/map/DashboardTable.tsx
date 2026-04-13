'use client';
/* ═══════════════════════════════════════════════════════════════════
   Jarvis MAP — Dashboard Table View (표 모드)
   ROOMS 13개를 행으로 렌더. 상태/성공률/실패/활동 집계.
   행 클릭 → 기존 TeamBriefingPopup 재사용 (부모에게 briefing 주입).
   ═══════════════════════════════════════════════════════════════════ */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ROOMS } from '@/lib/map/rooms';
import type { BriefingData, RoomDef } from '@/lib/map/rooms';
import { apiFetch } from '@/lib/api-fetch';

interface DashboardTableProps {
  isMobile: boolean;
  onRowClick: (room: RoomDef, briefing: BriefingData) => void;
}

type Row = {
  room: RoomDef;
  status: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  rate: number | null;
  failed: number | null;
  lastActivity: string;
  upcoming: string;
  briefing: BriefingData | null;
};

const statusRank = (s: Row['status']) =>
  s === 'RED' ? 0 : s === 'YELLOW' ? 1 : s === 'GREEN' ? 2 : 3;

const statusColor = (s: Row['status']) => {
  if (s === 'GREEN') return '#3fb950';
  if (s === 'RED') return '#f85149';
  if (s === 'YELLOW') return '#d29922';
  return '#6e7681';
};

const statusEmoji = (s: Row['status']) => {
  if (s === 'GREEN') return '🟢';
  if (s === 'RED') return '🔴';
  if (s === 'YELLOW') return '🟡';
  return '⚪';
};

function formatRelative(iso: string | undefined | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso || '—';
  const diff = Date.now() - t;
  if (diff < 0) return new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

function extractLastActivity(b: BriefingData | null): string {
  if (!b) return '—';
  if (b.recentActivity && b.recentActivity.length > 0) {
    const first = b.recentActivity[0];
    if (first?.time) return formatRelative(first.time);
  }
  if (b.recentEvents && b.recentEvents.length > 0) {
    const first = b.recentEvents[0];
    if (first?.time) return formatRelative(first.time);
  }
  return '—';
}

function extractUpcoming(b: BriefingData | null): string {
  if (!b) return '—';
  if (b.upcoming && b.upcoming.length > 0) {
    const u = b.upcoming[0];
    return u.taskKo || u.task || u.time || '—';
  }
  if (b.schedule) return b.schedule;
  return '—';
}

function normalizeStatus(s: string | undefined): Row['status'] {
  if (s === 'GREEN' || s === 'RED' || s === 'YELLOW') return s;
  return 'UNKNOWN';
}

export default function DashboardTable({ isMobile, onRowClick }: DashboardTableProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    ROOMS.map(room => ({
      room,
      status: 'UNKNOWN',
      rate: null,
      failed: null,
      lastActivity: '—',
      upcoming: '—',
      briefing: null,
    }))
  );
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    const targets = ROOMS.filter(r => r.entityId && r.id !== 'cron-center');
    const results = await Promise.allSettled(
      targets.map(async room => {
        const result = await apiFetch<BriefingData>(`/api/entity/${room.entityId}/briefing`);
        if (!result.ok) throw new Error(result.message);
        const data = result.data;
        if (data.metrics && !data.stats) {
          data.stats = {
            total: data.metrics.totalToday || 0,
            success: (data.metrics.totalToday || 0) - (data.metrics.failedToday || 0),
            failed: data.metrics.failedToday || 0,
            rate: data.metrics.cronSuccessRate || 0,
          };
        }
        if (!data.emoji) data.emoji = room.emoji;
        data.roomDescription = room.description;
        return { room, data };
      })
    );

    const nextMap = new Map<string, { data: BriefingData; room: RoomDef }>();
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        nextMap.set(targets[i].id, { data: r.value.data, room: r.value.room });
      }
    });

    setRows(
      ROOMS.map(room => {
        const found = nextMap.get(room.id);
        if (!found) {
          return {
            room,
            status: room.id === 'cron-center' ? 'UNKNOWN' : 'UNKNOWN',
            rate: null,
            failed: null,
            lastActivity: '—',
            upcoming: room.id === 'cron-center' ? '실시간 모니터링' : '—',
            briefing: null,
          };
        }
        const { data } = found;
        return {
          room,
          status: normalizeStatus(data.status),
          rate: data.stats?.rate ?? null,
          failed: data.stats?.failed ?? null,
          lastActivity: extractLastActivity(data),
          upcoming: extractUpcoming(data),
          briefing: data,
        };
      })
    );
    setLoading(false);
    setLastRefresh(Date.now());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => statusRank(a.status) - statusRank(b.status)),
    [rows]
  );

  const summary = useMemo(() => {
    let red = 0, yellow = 0, green = 0;
    for (const r of rows) {
      if (r.status === 'RED') red++;
      else if (r.status === 'YELLOW') yellow++;
      else if (r.status === 'GREEN') green++;
    }
    return { red, yellow, green };
  }, [rows]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, #0d1117 0%, #0a0d14 100%)',
        overflowY: 'auto',
        color: '#e6edf3',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        padding: isMobile ? '16px 12px 80px' : '32px 48px',
      }}
    >
      {/* 헤더 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, letterSpacing: 0.5 }}>
            📊 전사 대시보드
          </div>
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
            13개 엔티티 실시간 상태 · 15초 자동 새로고침
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: '#f85149' }}>🔴 {summary.red}</span>
          <span style={{ color: '#d29922' }}>🟡 {summary.yellow}</span>
          <span style={{ color: '#3fb950' }}>🟢 {summary.green}</span>
          <span style={{ color: '#6e7681', marginLeft: 8 }}>
            {loading || lastRefresh == null ? '로딩 중…' : `업데이트 ${formatRelative(new Date(lastRefresh).toISOString())}`}
          </span>
        </div>
      </div>

      {/* 테이블 */}
      <div
        style={{
          background: '#0f1420',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* 헤더 행 */}
        {!isMobile && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.1fr 1fr 1.2fr 1.4fr 1fr',
              gap: 12,
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: '#141a28',
              fontSize: 11,
              fontWeight: 700,
              color: '#8b949e',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            <div>팀</div>
            <div>상태</div>
            <div>성공률 24h</div>
            <div>실패</div>
            <div>마지막 활동</div>
            <div>다음 예정</div>
            <div style={{ textAlign: 'right' }}>액션</div>
          </div>
        )}

        {/* 행 */}
        {sorted.map(row => (
          <div
            key={row.room.id}
            onClick={() => row.briefing && onRowClick(row.room, row.briefing)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ' ') && row.briefing) {
                e.preventDefault();
                onRowClick(row.room, row.briefing);
              }
            }}
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1.1fr 1fr 1.2fr 1.4fr 1fr',
              gap: isMobile ? 4 : 12,
              padding: isMobile ? '14px 16px' : '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              cursor: row.briefing ? 'pointer' : 'default',
              opacity: row.briefing ? 1 : 0.6,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => {
              if (row.briefing) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{row.room.emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc' }}>{row.room.name}</div>
                {isMobile && (
                  <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
                    {statusEmoji(row.status)} {row.rate != null ? `${row.rate}%` : '—'} · 실패 {row.failed ?? '—'}
                  </div>
                )}
              </div>
            </div>

            {!isMobile && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: statusColor(row.status),
                    boxShadow: `0 0 8px ${statusColor(row.status)}`,
                  }} />
                  <span style={{ fontSize: 12, color: statusColor(row.status), fontWeight: 700 }}>
                    {row.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#c9d1d9', fontVariantNumeric: 'tabular-nums' }}>
                  {row.rate != null ? `${row.rate}%` : '—'}
                </div>
                <div style={{ fontSize: 13, color: row.failed && row.failed > 0 ? '#f85149' : '#8b949e', fontVariantNumeric: 'tabular-nums' }}>
                  {row.failed != null ? `${row.failed}건` : '—'}
                </div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>{row.lastActivity}</div>
                <div style={{ fontSize: 12, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.upcoming}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (row.briefing) onRowClick(row.room, row.briefing);
                    }}
                    disabled={!row.briefing}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: row.briefing ? '#1f2937' : 'transparent',
                      color: row.briefing ? '#e6edf3' : '#6e7681',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: row.briefing ? 'pointer' : 'not-allowed',
                    }}
                  >
                    💬 채팅
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
