'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';

interface UpcomingItem {
  id: string;
  name: string;
  nextRun: string;
  minutesUntil: number;
  priority: string;
  humanTime: string;
}

interface Commit {
  sha: string;
  ago: string;
  subject: string;
  author: string;
  repo: 'jarvis' | 'jarvis-board';
}

interface FeedItem {
  cronId: string;
  status: 'success' | 'failed' | 'skipped' | 'running';
  time: string;
  message: string;
}

interface AlertTeam {
  teamId: string;
  teamLabel: string;
  failCount: number;
  failingCronIds: string[];
  topError: string;
}

const REFRESH_MS = 60_000;
const FEED_REFRESH_MS = 30_000;

interface RightInfoPanelsProps {
  isMobile: boolean;
  /** 크론 항목 클릭 시 — id를 받아 VirtualOffice의 CronDetailPopup을 연다 */
  onCronClick?: (cronId: string) => void;
  /** 커밋 항목 클릭 시 — 현 단계는 GitHub 웹 URL을 새 창으로 연다 */
  onCommitClick?: (commit: Commit) => void;
  /** 팀 이름 클릭 시 — 해당 팀장 브리핑 팝업 열기 */
  onTeamClick?: (teamId: string) => void;
}

/**
 * 우상단 정보 패널 스택 — BoardBanner 아래에 붙음:
 *  1. 오늘 남은 예정 크론 (6개) → 클릭 시 CronDetailPopup
 *  2. 최근 커밋 (jarvis/jarvis-board 합쳐 10개) → 클릭 시 GitHub
 */
export default function RightInfoPanels({ isMobile, onCronClick, onCommitClick, onTeamClick }: RightInfoPanelsProps) {
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [alertTeams, setAlertTeams] = useState<AlertTeam[]>([]);
  const [expanded, setExpanded] = useState<'upcoming' | 'commits' | 'feed' | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null); // cronId being retried

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [scheduleRes, commitsRes] = await Promise.all([
          fetch('/api/map/today-schedule', { cache: 'no-store' }),
          fetch('/api/map/recent-commits', { cache: 'no-store' }),
        ]);
        if (scheduleRes.ok) {
          const j = await scheduleRes.json() as { upcoming?: UpcomingItem[] };
          if (!cancelled) setUpcoming(j.upcoming || []);
        }
        if (commitsRes.ok) {
          const j = await commitsRes.json() as { commits?: Commit[] };
          if (!cancelled) setCommits(j.commits || []);
        }
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // 활동 피드 + 긴급 알림 (30초 주기)
  useEffect(() => {
    let cancelled = false;
    const loadFeed = async () => {
      const result = await apiFetch<{ feed?: FeedItem[]; alertTeams?: AlertTeam[] }>('/api/map/activity-feed');
      if (result.ok && !cancelled) {
        setFeed(result.data.feed || []);
        setAlertTeams(result.data.alertTeams || []);
      }
    };
    loadFeed();
    const id = setInterval(loadFeed, FEED_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const handleRetry = async (cronId: string) => {
    setRetrying(cronId);
    try {
      await apiFetch('/api/crons/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronId }),
      });
    } finally {
      setRetrying(null);
      // 피드 갱신
      setTimeout(async () => {
        const result = await apiFetch<{ feed?: FeedItem[]; alertTeams?: AlertTeam[] }>('/api/map/activity-feed');
        if (result.ok) {
          setFeed(result.data.feed || []);
          setAlertTeams(result.data.alertTeams || []);
        }
      }, 3000);
    }
  };

  // 모바일: 장애 알림만 표시 (나머지 패널은 화면 좁아서 숨김)
  if (isMobile) {
    if (alertTeams.length === 0) return null;
    return (
      <div style={{
        position: 'fixed', top: 44, left: 8, right: 8, zIndex: 1100,
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <div style={{
          background: 'rgba(30, 8, 8, 0.95)',
          border: '1px solid rgba(248,81,73,0.45)',
          borderTop: '2px solid #f85149',
          borderRadius: 10,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(248,81,73,0.25)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '9px 12px 7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f85149', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              🚨 장애 알림 {alertTeams.length}팀
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px 8px' }}>
            {alertTeams.slice(0, 3).map((team) => (
              <div key={team.teamId} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 8px', background: 'rgba(248,81,73,0.06)',
                border: '1px solid rgba(248,81,73,0.18)', borderRadius: 7,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {team.teamLabel} · 실패 {team.failCount}건
                  </div>
                </div>
                <button
                  onClick={() => team.failingCronIds.length > 0 && handleRetry(team.failingCronIds[0])}
                  disabled={retrying === team.failingCronIds[0]}
                  style={{
                    flexShrink: 0, padding: '3px 7px', borderRadius: 5, cursor: 'pointer',
                    fontSize: 9, fontWeight: 700, border: 'none',
                    background: 'rgba(248,81,73,0.25)', color: '#fca5a5',
                    opacity: retrying === team.failingCronIds[0] ? 0.5 : 1,
                  }}
                >{retrying === team.failingCronIds[0] ? '…' : '▶ 재시도'}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const fmtUntil = (min: number) => {
    if (min < 1) return '곧';
    if (min < 60) return `${min}분 후`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h < 24) return m > 0 ? `${h}시간 ${m}분 후` : `${h}시간 후`;
    return '24h+';
  };

  const priorityColor = (p: string) =>
    p === 'high' ? '#f85149' : p === 'low' ? '#6e7681' : '#d29922';

  return (
    <div
      style={{
        position: 'fixed',
        top: 82,
        right: 4,
        zIndex: 450,
        width: 200,
        maxHeight: '80vh',
        overflowY: 'auto',
        opacity: 0.95,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        pointerEvents: 'none',
      }}
    >
      {/* 🚨 긴급 알림 트레이 — RED 팀 실시간 노출 */}
      {alertTeams.length > 0 && (
        <div style={{
          background: 'rgba(30, 8, 8, 0.95)',
          border: '1px solid rgba(248,81,73,0.45)',
          borderTop: '2px solid #f85149',
          borderRadius: 10,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(248,81,73,0.25)',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}>
          <div style={{
            padding: '9px 12px 7px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f85149', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              🚨 장애 알림 {alertTeams.length}팀
            </span>
            <span style={{
              fontSize: 9, color: '#f85149', background: 'rgba(248,81,73,0.15)',
              border: '1px solid rgba(248,81,73,0.3)', borderRadius: 6, padding: '2px 6px',
            }}>
              24h
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px 8px' }}>
            {alertTeams.slice(0, 4).map((team) => (
              <div key={team.teamId} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 8px',
                background: 'rgba(248,81,73,0.06)',
                border: '1px solid rgba(248,81,73,0.18)',
                borderRadius: 7,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {team.teamLabel}
                  </div>
                  <div style={{ fontSize: 9, color: '#6e4040', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                    실패 {team.failCount}건
                  </div>
                </div>
                <button
                  onClick={() => team.failingCronIds.length > 0 && handleRetry(team.failingCronIds[0])}
                  disabled={retrying === team.failingCronIds[0]}
                  style={{
                    flexShrink: 0, padding: '3px 7px', borderRadius: 5, cursor: 'pointer',
                    fontSize: 9, fontWeight: 700, border: 'none',
                    background: 'rgba(248,81,73,0.25)', color: '#fca5a5',
                    opacity: retrying === team.failingCronIds[0] ? 0.5 : 1,
                  }}
                >{retrying === team.failingCronIds[0] ? '…' : '▶ 재시도'}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 오늘 예정 크론 카드 */}
      {upcoming.length > 0 && (
        <div
          style={{
            background: 'rgba(13, 17, 23, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            borderRadius: 10,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={() => setExpanded(expanded === 'upcoming' ? null : 'upcoming')}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '10px 14px',
              color: '#c9d1d9',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            <span>
              <span style={{ marginRight: 6 }}>⏳</span>
              오늘 예정 {upcoming.length}건
            </span>
            <span style={{ color: '#58a6ff', fontSize: 10 }}>
              다음 {upcoming[0]?.humanTime}
            </span>
          </button>
          {expanded === 'upcoming' && (
            <div style={{
              padding: '4px 10px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              maxHeight: 280,
              overflowY: 'auto',
            }}>
              {upcoming.map((u) => {
                const clickable = !!onCronClick;
                return (
                  <button
                    key={u.id}
                    onClick={() => onCronClick && onCronClick(u.id)}
                    disabled={!clickable}
                    title={clickable ? `${u.name} — 클릭하면 상세 팝업` : undefined}
                    style={{
                      all: 'unset',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${priorityColor(u.priority)}25`,
                      borderLeft: `2px solid ${priorityColor(u.priority)}`,
                      borderRadius: 7,
                      fontSize: 11,
                      cursor: clickable ? 'pointer' : 'default',
                      transition: 'background 0.12s',
                      boxSizing: 'border-box' as const,
                    }}
                    onMouseEnter={e => {
                      if (clickable) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                    }}
                    onMouseLeave={e => {
                      if (clickable) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    <span style={{ color: '#58a6ff', fontFamily: 'monospace', fontSize: 10, minWidth: 38 }}>
                      {u.humanTime}
                    </span>
                    <span style={{ color: '#c9d1d9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name}
                    </span>
                    <span style={{ color: '#6e7681', fontSize: 9, fontFamily: 'monospace', flexShrink: 0 }}>
                      {fmtUntil(u.minutesUntil)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 최근 커밋 카드 */}
      {commits.length > 0 && (
        <div
          style={{
            background: 'rgba(13, 17, 23, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            borderRadius: 10,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={() => setExpanded(expanded === 'commits' ? null : 'commits')}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '10px 14px',
              color: '#c9d1d9',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            <span>
              <span style={{ marginRight: 6 }}>🔀</span>
              최근 커밋 {commits.length}건
            </span>
            <span style={{ color: '#3fb950', fontSize: 10 }}>
              {commits[0]?.ago}
            </span>
          </button>
          {expanded === 'commits' && (
            <div style={{
              padding: '4px 10px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              maxHeight: 280,
              overflowY: 'auto',
            }}>
              {commits.map((c) => {
                const githubUrl = `https://github.com/ramsbaby/${c.repo}/commit/${c.sha}`;
                const handleClick = () => {
                  if (onCommitClick) {
                    onCommitClick(c);
                  } else if (typeof window !== 'undefined') {
                    window.open(githubUrl, '_blank', 'noopener,noreferrer');
                  }
                };
                return (
                  <button
                    key={`${c.repo}-${c.sha}`}
                    onClick={handleClick}
                    title={`${c.repo}@${c.sha} — 클릭 시 GitHub 커밋 페이지 열림`}
                    style={{
                      all: 'unset',
                      display: 'block',
                      padding: '7px 10px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(63, 185, 80, 0.18)',
                      borderLeft: '2px solid #3fb950',
                      borderRadius: 7,
                      fontSize: 11,
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                      boxSizing: 'border-box' as const,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(63, 185, 80, 0.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ color: '#3fb950', fontFamily: 'monospace', fontSize: 9, fontWeight: 700 }}>
                        {c.sha}
                      </span>
                      <span style={{ color: '#6e7681', fontSize: 9 }}>
                        {c.repo}
                      </span>
                      <span style={{ color: '#484f58', fontSize: 9, marginLeft: 'auto' }}>
                        {c.ago}
                      </span>
                    </div>
                    <div style={{ color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.subject}
                    </div>
                    <div style={{ color: '#4a5370', fontSize: 9, marginTop: 2 }}>→ GitHub 열기</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* ⚡ 실시간 활동 피드 */}
      {feed.length > 0 && (
        <div
          style={{
            background: 'rgba(13, 17, 23, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            borderRadius: 10,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={() => setExpanded(expanded === 'feed' ? null : 'feed')}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '10px 14px',
              color: '#c9d1d9',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            <span>
              <span style={{ marginRight: 6 }}>⚡</span>
              최근 실행
            </span>
            <span style={{ fontSize: 10, color: '#484f58' }}>
              {feed.filter(f => f.status === 'failed').length > 0
                ? <span style={{ color: '#f85149' }}>❌ {feed.filter(f => f.status === 'failed').length}건 실패</span>
                : <span style={{ color: '#3fb950' }}>✅ 정상</span>
              }
            </span>
          </button>
          {expanded === 'feed' && (
            <div style={{
              padding: '4px 10px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              maxHeight: 240,
              overflowY: 'auto',
            }}>
              {feed.slice(0, 15).map((item, i) => {
                const sc = item.status === 'success' ? '#3fb950'
                  : item.status === 'failed' ? '#f85149'
                  : item.status === 'running' ? '#58a6ff' : '#6e7681';
                const icon = item.status === 'success' ? '✅' : item.status === 'failed' ? '❌' : item.status === 'running' ? '🔄' : '○';
                return (
                  <div key={`${item.cronId}-${item.time}-${i}`}
                    onClick={() => onCronClick?.(item.cronId)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      padding: '5px 8px',
                      background: item.status === 'failed' ? 'rgba(248,81,73,0.07)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${sc}18`,
                      borderLeft: `2px solid ${sc}`,
                      borderRadius: 6,
                      fontSize: 10,
                      cursor: onCronClick ? 'pointer' : 'default',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (onCronClick) (e.currentTarget as HTMLDivElement).style.background = item.status === 'failed' ? 'rgba(248,81,73,0.13)' : 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { if (onCronClick) (e.currentTarget as HTMLDivElement).style.background = item.status === 'failed' ? 'rgba(248,81,73,0.07)' : 'rgba(255,255,255,0.02)'; }}
                  >
                    <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {item.cronId.replace(/-/g, ' ')}
                      </div>
                      <div style={{ color: '#484f58', fontFamily: 'monospace', fontSize: 9, marginTop: 1 }}>
                        {item.time}
                      </div>
                    </div>
                    {onCronClick && <span style={{ flexShrink: 0, fontSize: 10, color: '#5a6480', marginTop: 2 }}>›</span>}
                    {item.status === 'failed' && !onCronClick && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRetry(item.cronId); }}
                        disabled={retrying === item.cronId}
                        style={{
                          flexShrink: 0, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                          fontSize: 9, fontWeight: 700, border: 'none',
                          background: 'rgba(248,81,73,0.2)', color: '#fca5a5',
                          opacity: retrying === item.cronId ? 0.5 : 1,
                        }}
                      >{retrying === item.cronId ? '…' : '▶'}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
