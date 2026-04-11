'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

// ── 타입 ──────────────────────────────────────────────────────────────────────
type CronStatus = 'success' | 'failed' | 'skipped' | 'running' | 'unknown';

interface CronEntry {
  task: string;
  status: CronStatus;
  message: string;
  timestamp: string;
  teamId: string;
}

interface TeamActivity {
  teamId: string;
  label: string;
  emoji: string;
  schedule: string;
  status: CronStatus;
  lastTask: string;
  lastMessage: string;
  lastAt: string | null;
  successCount24h: number;
  failCount24h: number;
  recentCrons: CronEntry[];
}

interface LiveData {
  teams: TeamActivity[];
  botStatus: { running: boolean; pid: string | null };
  generatedAt: string;
  cached: boolean;
}

// ── 에이전트 ID 매핑 ──────────────────────────────────────────────────────────
const TEAM_TO_AGENT_ID: Record<string, string> = {
  'infra-lead':   'infra-lead',
  'trend-team':   'trend-team',
  'audit-team':   'audit-team',
  'record-team':  'record-lead',
  'brand-team':   'brand-lead',
  'growth-team':  'career-lead',
  'academy-team': 'academy-team',
  'bot-system':   'jung-mingi',
};

// ══════════════════════════════════════════════════════════════════════════════
//  게더타운 맵
//  W=벽  .=바닥  영문자=데스크
//  I=infra-lead  (API teamId 정확히 일치)
// ══════════════════════════════════════════════════════════════════════════════
const TILE_SIZE = 46;

const MAP_ROWS = [
  'WWWWWWWWWWWWWWW',  //  0  상단 벽
  'W.............W',  //  1  로비
  'W.BBBBB.......W',  //  2  bot-system  x=2-6
  'W.BBBBB.......W',  //  3
  'W.............W',  //  4  복도 A
  'W.AAA.TTT.GGG.W',  //  5  audit(2-4) trend(6-8) growth(10-12)
  'W.AAA.TTT.GGG.W',  //  6
  'W.............W',  //  7  복도 B
  'W.CCC.III.....W',  //  8  academy(2-4) infra(6-8)
  'W.CCC.III.....W',  //  9
  'W.............W',  // 10  복도 C
  'W.RRR.DDD.....W',  // 11  record(2-4) brand(6-8)
  'W.RRR.DDD.....W',  // 12
  'W.............W',  // 13  로비 하단
  'WWWWWWWWWWWWWWW',  // 14  하단 벽
];

// 맵 문자 → teamId (API가 반환하는 실제 teamId와 정확히 일치)
const CHAR_TO_TEAM: Record<string, string> = {
  B: 'bot-system',
  A: 'audit-team',
  T: 'trend-team',
  G: 'growth-team',
  C: 'academy-team',
  I: 'infra-lead',     // ← API teamId = 'infra-lead'
  R: 'record-team',
  D: 'brand-team',
};

interface DeskBox { teamId: string; x: number; y: number; w: number; h: number }
const DESK_BOXES: DeskBox[] = [
  { teamId: 'bot-system',   x: 2,  y:  2, w: 5, h: 2 },
  { teamId: 'audit-team',   x: 2,  y:  5, w: 3, h: 2 },
  { teamId: 'trend-team',   x: 6,  y:  5, w: 3, h: 2 },
  { teamId: 'growth-team',  x: 10, y:  5, w: 3, h: 2 },
  { teamId: 'academy-team', x: 2,  y:  8, w: 3, h: 2 },
  { teamId: 'infra-lead',   x: 6,  y:  8, w: 3, h: 2 },  // infra-lead
  { teamId: 'record-team',  x: 2,  y: 11, w: 3, h: 2 },
  { teamId: 'brand-team',   x: 6,  y: 11, w: 3, h: 2 },
];

type TileKind = 'wall' | 'floor' | 'desk';
interface MapTile { kind: TileKind; teamId?: string }

const PARSED_MAP: MapTile[][] = MAP_ROWS.map(row =>
  row.split('').map(ch => {
    if (ch === 'W') return { kind: 'wall' };
    const teamId = CHAR_TO_TEAM[ch];
    if (teamId) return { kind: 'desk', teamId };
    return { kind: 'floor' };
  })
);
const MAP_H = PARSED_MAP.length;
const MAP_W = PARSED_MAP[0].length;

function isWalkable(x: number, y: number): boolean {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  return PARSED_MAP[y][x].kind === 'floor';
}

function getNearbyTeamId(x: number, y: number): string | null {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
      const t = PARSED_MAP[ny][nx];
      if (t.kind === 'desk' && t.teamId) return t.teamId;
    }
  }
  return null;
}

// 오피스/그리드 뷰용 정렬 상수
const ALL_TEAM_IDS = ['bot-system', 'audit-team', 'trend-team', 'growth-team',
                      'academy-team', 'infra-lead', 'record-team', 'brand-team'];

// ── 헬퍼 함수 ────────────────────────────────────────────────────────────────
function statusBadge(status: CronStatus) {
  switch (status) {
    case 'success': return { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'SUCCESS', bg: 'bg-emerald-950/70', border: 'border-emerald-800/80', ring: 'ring-emerald-500', glow: 'shadow-emerald-900/20', pulse: false };
    case 'failed':  return { dot: 'bg-red-400',     text: 'text-red-400',     label: 'FAILED',  bg: 'bg-red-950/70',     border: 'border-red-800/80',     ring: 'ring-red-500',     glow: 'shadow-red-900/30',     pulse: false };
    case 'skipped': return { dot: 'bg-zinc-500',    text: 'text-zinc-500',    label: 'SKIPPED', bg: 'bg-zinc-900/80',    border: 'border-zinc-700/80',    ring: 'ring-zinc-600',    glow: '',                      pulse: false };
    case 'running': return { dot: 'bg-blue-400',    text: 'text-blue-400',    label: 'RUNNING', bg: 'bg-blue-950/70',    border: 'border-blue-700/80',    ring: 'ring-blue-400',    glow: 'shadow-blue-900/40',    pulse: true  };
    default:        return { dot: 'bg-zinc-600',    text: 'text-zinc-600',    label: 'IDLE',    bg: 'bg-zinc-900/60',    border: 'border-zinc-800/60',    ring: 'ring-zinc-700',    glow: '',                      pulse: false };
  }
}

function cronIcon(status: CronStatus) {
  return { success: '✅', failed: '❌', skipped: '⏭️', running: '⏳', unknown: '❓' }[status] ?? '❓';
}

function timeAgo(ts: string | null): string {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts.replace(' ', 'T')).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function rate(s: number, f: number) {
  const t = s + f;
  return t === 0 ? '—' : `${Math.round((s / t) * 100)}%`;
}

function taskLabel(task: string): string {
  // cron task 이름 → 사람 이름처럼 읽기 좋게
  return task.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 22);
}

// ══════════════════════════════════════════════════════════════════════════════
//  🎮 게더타운 게임 뷰
// ══════════════════════════════════════════════════════════════════════════════
function GameView({
  teamMap,
  onSelectTeam,
}: {
  teamMap: Record<string, TeamActivity>;
  onSelectTeam: (t: TeamActivity | null) => void;
}) {
  const [pos, setPos]           = useState({ x: 1, y: 1 });
  const [nearbyId, setNearbyId] = useState<string | null>(null);
  const posRef                  = useRef({ x: 1, y: 1 });

  const move = useCallback((dx: number, dy: number) => {
    const { x, y } = posRef.current;
    const nx = x + dx, ny = y + dy;
    if (isWalkable(nx, ny)) {
      const next = { x: nx, y: ny };
      posRef.current = next;
      setPos(next);
      setNearbyId(getNearbyTeamId(nx, ny));
    }
  }, []);

  const talk = useCallback(() => {
    const id = getNearbyTeamId(posRef.current.x, posRef.current.y);
    if (id && teamMap[id]) onSelectTeam(teamMap[id]);
  }, [teamMap, onSelectTeam]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); move(0, -1); break;
        case 'ArrowDown':  e.preventDefault(); move(0,  1); break;
        case 'ArrowLeft':  e.preventDefault(); move(-1, 0); break;
        case 'ArrowRight': e.preventDefault(); move( 1, 0); break;
        case 'Enter':
        case ' ':          e.preventDefault(); talk();      break;
        case 'Escape':     e.preventDefault(); onSelectTeam(null); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, talk, onSelectTeam]);

  const nearbyTeam = nearbyId ? teamMap[nearbyId] : null;
  const mapPxW     = MAP_W * TILE_SIZE;
  const mapPxH     = MAP_H * TILE_SIZE;

  // 구역 라벨
  const ZONE_LABELS = [
    { text: '비서동',     col: 1, row: 1,  color: 'text-indigo-700' },
    { text: '팀장동',     col: 1, row: 4,  color: 'text-amber-800' },
    { text: '─── 복도 ───', col: 1, row: 7,  color: 'text-zinc-800' },
    { text: '─── 복도 ───', col: 1, row: 10, color: 'text-zinc-800' },
  ];

  return (
    <div className="space-y-3">

      {/* ── 근접 알림 배너 ── */}
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-300 ${
        nearbyTeam
          ? 'bg-indigo-950/80 border-indigo-700 shadow-lg shadow-indigo-950/50'
          : 'bg-zinc-900/40 border-zinc-800/60 opacity-50'
      }`}>
        {nearbyTeam ? (
          <>
            <span className="text-2xl shrink-0">{nearbyTeam.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-indigo-200 text-sm leading-tight">{nearbyTeam.label}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{nearbyTeam.schedule}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <kbd className="bg-zinc-800 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-md border border-zinc-600 font-mono leading-none">Enter</kbd>
              <span className="text-zinc-500 text-xs">말 걸기</span>
            </div>
          </>
        ) : (
          <p className="text-zinc-600 text-xs w-full text-center tracking-wide">
            ← ↑ ↓ → 이동 · 팀 데스크 바로 옆에 서면 Enter로 말 걸 수 있어요
          </p>
        )}
      </div>

      {/* ── 게임 맵 ── */}
      <div className="overflow-auto rounded-2xl border border-zinc-800/80 shadow-2xl">
        <div className="relative bg-zinc-950" style={{ width: mapPxW, height: mapPxH }}>

          {/* 타일 레이어 */}
          {PARSED_MAP.map((row, y) =>
            row.map((tile, x) => (
              <div
                key={`${x}-${y}`}
                className={`absolute ${tile.kind === 'wall' ? 'bg-zinc-800/90 border border-zinc-700/30' : 'bg-zinc-950'}`}
                style={{ left: x * TILE_SIZE, top: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
              />
            ))
          )}

          {/* 구역 라벨 */}
          {ZONE_LABELS.map((z, i) => (
            <div
              key={i}
              className={`absolute text-[9px] font-bold tracking-[0.2em] uppercase pointer-events-none select-none ${z.color}`}
              style={{ left: z.col * TILE_SIZE + 4, top: z.row * TILE_SIZE + TILE_SIZE / 2 - 5 }}
            >
              {z.text}
            </div>
          ))}

          {/* ── 데스크 카드 ── */}
          {DESK_BOXES.map(box => {
            const team    = teamMap[box.teamId];
            if (!team) return null;
            const badge   = statusBadge(team.status);
            const nearby  = nearbyId === box.teamId;
            const isWide  = box.w >= 5;
            const dots    = team.recentCrons.slice(0, 5);

            return (
              <div
                key={box.teamId}
                onClick={() => onSelectTeam(team)}
                className={[
                  'absolute flex flex-col items-center justify-center cursor-pointer',
                  'rounded-2xl border-2 overflow-hidden transition-all duration-200',
                  badge.bg, badge.border,
                  nearby
                    ? `ring-2 ${badge.ring} ring-offset-1 ring-offset-zinc-950 brightness-125 scale-[1.05] z-20 shadow-xl ${badge.glow}`
                    : `hover:brightness-115 hover:scale-[1.02] z-10 ${badge.glow} shadow-lg`,
                ].join(' ')}
                style={{
                  left:   box.x * TILE_SIZE + 3,
                  top:    box.y * TILE_SIZE + 3,
                  width:  box.w * TILE_SIZE - 6,
                  height: box.h * TILE_SIZE - 6,
                  gap: '2px',
                }}
              >
                {/* 실행 중 상단 빛 바 */}
                {badge.pulse && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-400 rounded-t-2xl animate-pulse" />
                )}

                {/* 상태 표시등 */}
                <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${badge.dot} ${badge.pulse ? 'animate-ping' : ''}`} />

                {/* 팀 이모지 */}
                <span className={`leading-none ${isWide ? 'text-3xl' : 'text-2xl'} ${badge.pulse ? 'animate-bounce' : ''}`}>
                  {team.emoji}
                </span>

                {/* 팀 이름 */}
                <span className={`font-semibold text-zinc-100 text-center px-1 leading-tight ${isWide ? 'text-[11px]' : 'text-[9px]'}`}>
                  {team.label}
                </span>

                {/* 상태 배지 */}
                <span className={`text-[8px] font-bold tracking-wide ${badge.text}`}>
                  {badge.label}
                </span>

                {/* 팀원 활동 점 (recentCrons = 팀원들) */}
                {dots.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {dots.map((c, i) => {
                      const d = statusBadge(c.status);
                      return (
                        <span
                          key={i}
                          title={c.task}
                          className={`w-1.5 h-1.5 rounded-full ${d.dot} ${c.status === 'running' ? 'animate-pulse' : ''}`}
                        />
                      );
                    })}
                  </div>
                )}

                {/* 성공률 (넓은 카드만) */}
                {isWide && (team.successCount24h + team.failCount24h) > 0 && (
                  <span className="text-[8px] text-zinc-400 mt-0.5">
                    {rate(team.successCount24h, team.failCount24h)} · 24h
                  </span>
                )}
              </div>
            );
          })}

          {/* ── 아바타 🧑‍💻 ── */}
          <div
            className="absolute z-30 flex items-center justify-center pointer-events-none select-none transition-all duration-[90ms] ease-linear"
            style={{ left: pos.x * TILE_SIZE, top: pos.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
          >
            {/* 그림자 */}
            <div className="absolute bottom-0.5 w-5 h-1.5 bg-black/50 rounded-full blur-sm" />
            <span style={{ fontSize: TILE_SIZE * 0.62, lineHeight: 1 }}>🧑‍💻</span>
          </div>

          {/* 근접 펄스 링 */}
          {nearbyTeam && (
            <div
              className="absolute z-25 rounded-full border border-indigo-500/40 animate-ping pointer-events-none"
              style={{
                left:   pos.x * TILE_SIZE - TILE_SIZE * 0.15,
                top:    pos.y * TILE_SIZE - TILE_SIZE * 0.15,
                width:  TILE_SIZE * 1.3,
                height: TILE_SIZE * 1.3,
              }}
            />
          )}
        </div>
      </div>

      {/* ── 모바일 D-패드 ── */}
      <div className="flex flex-col items-center gap-2 sm:hidden pt-1">
        <button onClick={() => move(0, -1)} className="dpad">▲</button>
        <div className="flex gap-2">
          <button onClick={() => move(-1, 0)} className="dpad">◀</button>
          <button onClick={talk} disabled={!nearbyId}
            className={`w-13 h-13 w-12 h-12 rounded-2xl text-xs font-bold border transition-all active:scale-90 ${
              nearbyId ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400' : 'bg-zinc-900 text-zinc-700 border-zinc-800'
            }`}>💬</button>
          <button onClick={() => move(1, 0)} className="dpad">▶</button>
        </div>
        <button onClick={() => move(0, 1)} className="dpad">▼</button>
      </div>

      <p className="text-center text-[10px] text-zinc-700 hidden sm:block">
        ←↑↓→ 이동&nbsp; · &nbsp;
        <kbd className="bg-zinc-800 text-zinc-600 px-1 py-0.5 rounded border border-zinc-700 text-[9px]">Enter</kbd> 말 걸기&nbsp; · &nbsp;
        <kbd className="bg-zinc-800 text-zinc-600 px-1 py-0.5 rounded border border-zinc-700 text-[9px]">Esc</kbd> 닫기&nbsp; · &nbsp;
        데스크 직접 클릭 가능
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  💬 TalkPanel — 슬라이드 인 상세 패널
// ══════════════════════════════════════════════════════════════════════════════
function TalkPanel({
  team,
  onClose,
}: {
  team: TeamActivity;
  onClose: () => void;
}) {
  const badge   = statusBadge(team.status);
  const agentId = TEAM_TO_AGENT_ID[team.teamId] ?? team.teamId;

  // 첫 번째(최신)는 "지금 하는 일"로, 나머지는 팀원 목록
  const [current, ...members] = team.recentCrons;

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-full max-w-[360px] bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col"
      onClick={e => e.stopPropagation()}   // 배경 딤 클릭과 분리
    >
      {/* ── 헤더 ── */}
      <div className={`px-5 pt-5 pb-4 border-b border-zinc-800/80 ${badge.bg} shrink-0`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-4xl leading-none">{team.emoji}</span>
              {badge.pulse && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping" />}
            </div>
            <div>
              <h2 className="font-bold text-zinc-100 text-[15px] leading-tight">{team.label}</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">{team.schedule}</p>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={e => { e.stopPropagation(); onClose(); }}
            className="text-zinc-500 hover:text-zinc-200 active:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 shrink-0"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 현재 상태 */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${badge.border}`} style={{ background: 'rgba(0,0,0,0.25)' }}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot} ${badge.pulse ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-bold ${badge.text}`}>{badge.label}</span>
          {team.lastAt && <span className="text-[11px] text-zinc-500 ml-auto">{timeAgo(team.lastAt)}</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── 지금 하는 일 ── */}
        {current && (
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 font-medium">
              {team.status === 'running' ? '🔴 지금 하는 일' : '💤 마지막 작업'}
            </p>
            <div className="bg-zinc-800/70 rounded-xl p-3 border border-zinc-700/40">
              <div className="flex items-center gap-2 mb-1.5">
                {team.status === 'running' && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse shrink-0" />}
                <code className="text-[11px] font-mono text-indigo-300 truncate leading-none">{current.task}</code>
                <span className="text-[10px] text-zinc-600 ml-auto shrink-0">{timeAgo(current.timestamp)}</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">{current.message || '—'}</p>
            </div>
          </div>
        )}

        {/* ── 오늘 실적 ── */}
        {(team.successCount24h + team.failCount24h) > 0 && (
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2.5 font-medium">📊 오늘 실적 (24h)</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-950/60 border border-emerald-900/60 rounded-xl p-2.5 text-center">
                <p className="text-lg font-bold text-emerald-400 leading-none">{team.successCount24h}</p>
                <p className="text-[9px] text-zinc-500 mt-1">성공</p>
              </div>
              <div className="bg-red-950/60 border border-red-900/60 rounded-xl p-2.5 text-center">
                <p className="text-lg font-bold text-red-400 leading-none">{team.failCount24h}</p>
                <p className="text-[9px] text-zinc-500 mt-1">실패</p>
              </div>
              <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl p-2.5 text-center">
                <p className="text-lg font-bold text-zinc-100 leading-none">{rate(team.successCount24h, team.failCount24h)}</p>
                <p className="text-[9px] text-zinc-500 mt-1">성공률</p>
              </div>
            </div>
          </div>
        )}

        {/* ── 팀원 현황 (recentCrons = 실제 워커들) ── */}
        {members.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 font-medium">
              👥 팀원 현황 <span className="text-zinc-700 normal-case font-normal tracking-normal">({members.length}명)</span>
            </p>
            <div className="space-y-2">
              {members.map((entry, i) => {
                const d = statusBadge(entry.status);
                return (
                  <div key={i} className={`flex items-start gap-3 p-2.5 rounded-xl border ${d.border} ${d.bg}`}>
                    {/* 상태 아이콘 */}
                    <div className="shrink-0 w-6 h-6 flex items-center justify-center text-sm mt-0.5">
                      {cronIcon(entry.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-semibold text-zinc-200 truncate leading-tight">
                          {taskLabel(entry.task)}
                        </span>
                        <span className="text-[9px] text-zinc-600 shrink-0 ml-auto">{timeAgo(entry.timestamp)}</span>
                      </div>
                      {entry.message && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug line-clamp-2">{entry.message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!current && members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
            <span className="text-4xl mb-3">😴</span>
            <p className="text-zinc-400 text-sm">오늘 활동 기록 없음</p>
            <p className="text-zinc-600 text-xs mt-1">{team.schedule} 예정</p>
          </div>
        )}
      </div>

      {/* ── 액션 버튼 ── */}
      <div className="px-5 py-4 border-t border-zinc-800/80 bg-zinc-950/80 space-y-2 shrink-0">
        <Link
          href={`/agents/${agentId}`}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          💬 에이전트 전체 프로필 보기
        </Link>
        <div className="flex gap-2">
          <Link href={`/posts?tag=${team.teamId}`}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-xl transition-colors">
            📋 관련 토론
          </Link>
          <Link href="/dev-tasks"
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-xl transition-colors">
            🔧 태스크
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── 오피스/그리드 뷰용 카드 컴포넌트 ─────────────────────────────────────────
function TeamCard({ team, onClick }: { team: TeamActivity; onClick: (t: TeamActivity) => void }) {
  const [open, setOpen] = useState(false);
  const badge = statusBadge(team.status);
  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all duration-200 ${badge.bg} ${badge.border} ${badge.glow && `shadow-md ${badge.glow}`}`}>
      {badge.pulse && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-400 animate-pulse" />}
      <div className="p-4 cursor-pointer select-none" onClick={() => setOpen(v => !v)}>
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <span className={`text-3xl leading-none ${badge.pulse ? 'animate-bounce' : ''}`}>{team.emoji}</span>
            {badge.pulse && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-400 rounded-full animate-ping" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100 text-sm">{team.label}</span>
              <span className={`text-[10px] font-bold ${badge.text}`}>{badge.label}</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">{team.schedule}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-zinc-200">{rate(team.successCount24h, team.failCount24h)}</p>
            <p className="text-[9px] text-zinc-600">24h</p>
          </div>
        </div>
        {team.lastTask ? (
          <div className="mt-3 px-3 py-2 rounded-xl border border-white/5 bg-black/20">
            <div className="flex items-center gap-1.5 mb-1">
              <code className="text-[10px] font-mono text-zinc-400 bg-black/30 px-1.5 py-0.5 rounded truncate">{team.lastTask}</code>
              <span className="text-[10px] text-zinc-600 ml-auto shrink-0">{timeAgo(team.lastAt)}</span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate">{team.lastMessage}</p>
          </div>
        ) : (
          <div className="mt-3 px-3 py-2 rounded-xl border border-dashed border-zinc-700 text-center">
            <p className="text-[11px] text-zinc-600">오늘 활동 없음</p>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2.5">
          {team.successCount24h > 0 && <span className="text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full">✓ {team.successCount24h}</span>}
          {team.failCount24h   > 0 && <span className="text-[10px] text-red-400     bg-red-950/50     px-2 py-0.5 rounded-full">✗ {team.failCount24h}</span>}
          <button onPointerDown={e => { e.stopPropagation(); onClick(team); }}
            className="ml-auto text-[10px] text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800/60 hover:border-indigo-600 transition-colors">
            💬 말 걸기
          </button>
        </div>
      </div>
      {open && team.recentCrons.length > 0 && (
        <div className="border-t border-zinc-800 bg-black/20 px-4 py-3 space-y-1.5">
          <p className="text-[9px] text-zinc-600 font-medium mb-2 uppercase tracking-widest">팀원 현황</p>
          {team.recentCrons.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className="shrink-0">{cronIcon(c.status)}</span>
              <code className="text-zinc-400 font-mono bg-black/30 px-1 rounded truncate flex-1">{c.task}</code>
              <span className="text-zinc-600 shrink-0">{timeAgo(c.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  메인 페이지
// ══════════════════════════════════════════════════════════════════════════════
export default function CompanyPage() {
  const [data, setData]               = useState<LiveData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown]     = useState(30);
  const [viewMode, setViewMode]       = useState<'game' | 'grid'>('game');
  const [selectedTeam, setSelectedTeam] = useState<TeamActivity | null>(null);

  // ── stale closure 버그 수정: ref로 최신 값 유지 ──────────────────────────
  const selectedTeamRef = useRef<TeamActivity | null>(null);

  const handleSelectTeam = useCallback((team: TeamActivity | null) => {
    selectedTeamRef.current = team;  // 동기 업데이트 (interval 경쟁 방지)
    setSelectedTeam(team);
  }, []);

  // ── fetchData: selectedTeam 의존성 제거 → ref로 읽기 ─────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/agent-live', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as LiveData;
      setData(json);

      // 패널이 열려 있으면 최신 데이터로 갱신 (ref로 읽어 stale closure 방지)
      const sel = selectedTeamRef.current;
      if (sel) {
        const updated = json.teams.find(t => t.teamId === sel.teamId);
        if (updated) {
          selectedTeamRef.current = updated;
          setSelectedTeam(updated);
        }
      }

      setLastRefresh(new Date());
      setCountdown(30);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, []); // 의존성 없음 → 안정적인 참조, interval 재시작 없음

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 30), 1000);
    return () => clearInterval(t);
  }, [lastRefresh]);

  // Esc 글로벌 핸들러 (게임 뷰 자체에도 있지만 안전망)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedTeamRef.current) {
        e.preventDefault();
        handleSelectTeam(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSelectTeam]);

  const teamMap      = Object.fromEntries((data?.teams ?? []).map(t => [t.teamId, t]));
  const failedTeams  = data?.teams.filter(t => t.status === 'failed').length  ?? 0;
  const runningTeams = data?.teams.filter(t => t.status === 'running').length ?? 0;
  const totalS       = data?.teams.reduce((s, t) => s + t.successCount24h, 0) ?? 0;
  const totalF       = data?.teams.reduce((s, t) => s + t.failCount24h, 0)    ?? 0;

  return (
    <div className="bg-zinc-950 min-h-screen text-white">

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-20 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">← 목록</Link>

          <div className="flex items-center gap-2">
            <span className="text-lg">🏢</span>
            <span className="font-semibold text-zinc-100 text-sm">자비스 컴퍼니 — 라이브</span>
          </div>

          {data?.botStatus && (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full shrink-0 ${
              data.botStatus.running
                ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-800'
                : 'bg-red-900/60 text-red-400 border border-red-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${data.botStatus.running ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {data.botStatus.running ? `Bot ON · PID ${data.botStatus.pid}` : 'Bot DOWN'}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-xl border border-zinc-700 overflow-hidden text-xs">
              {(['game', 'grid'] as const).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    viewMode === v ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}>
                  {v === 'game' ? '🎮 게임' : '⬜ 카드'}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-zinc-700 tabular-nums hidden sm:block">{countdown}s</span>
            <button onClick={fetchData} className="text-xs text-zinc-500 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 hover:border-zinc-500 transition-all">↺</button>
          </div>
        </div>
      </header>

      {/* 패널 열릴 때 우측 밀기 */}
      <div
        className="max-w-5xl mx-auto px-4 py-6 space-y-5 transition-[margin] duration-300"
        style={{ marginRight: selectedTeam ? '360px' : undefined }}
      >
        {/* KPI 요약 */}
        {data && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { v: data.teams.length, label: '팀',     cls: 'text-zinc-200',   bg: '' },
              { v: runningTeams,       label: '실행 중', cls: runningTeams > 0 ? 'text-blue-300'  : 'text-zinc-200', bg: runningTeams > 0 ? 'bg-blue-950/60 border-blue-900' : '' },
              { v: failedTeams,        label: '실패',    cls: failedTeams  > 0 ? 'text-red-300'   : 'text-zinc-200', bg: failedTeams  > 0 ? 'bg-red-950/60 border-red-900'   : '' },
              { v: rate(totalS, totalF), label: '성공률', cls: 'text-emerald-400', bg: '' },
            ].map((k, i) => (
              <div key={i} className={`rounded-2xl border p-3 text-center ${k.bg || 'bg-zinc-900 border-zinc-800'}`}>
                <p className={`text-xl font-bold ${k.cls}`}>{k.v}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-3">
              <div className="text-4xl animate-spin">⚙️</div>
              <p className="text-zinc-500 text-sm">에이전트 현황 조회 중...</p>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="bg-red-950/60 border border-red-800 rounded-2xl p-4 text-center">
            <p className="text-red-400 text-sm">조회 실패: {error}</p>
            <button onClick={fetchData} className="mt-2 text-xs text-red-300 underline">다시 시도</button>
          </div>
        )}

        {/* 🎮 게임 뷰 */}
        {data && !loading && viewMode === 'game' && (
          <GameView teamMap={teamMap} onSelectTeam={handleSelectTeam} />
        )}

        {/* ⬜ 카드 뷰 */}
        {data && !loading && viewMode === 'grid' && (
          <div className="space-y-4">
            {(failedTeams > 0 || runningTeams > 0) && (
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">⚡ 주목</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.teams.filter(t => t.status === 'failed' || t.status === 'running')
                    .map(t => <TeamCard key={t.teamId} team={t} onClick={handleSelectTeam} />)}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">🏢 전체 팀</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ALL_TEAM_IDS.map(id => teamMap[id])
                  .filter(t => t && t.status !== 'failed' && t.status !== 'running')
                  .map(t => <TeamCard key={t.teamId} team={t} onClick={handleSelectTeam} />)}
              </div>
            </div>
          </div>
        )}

        {data && !loading && (
          <p className="text-center text-[10px] text-zinc-800">
            {lastRefresh?.toLocaleTimeString('ko-KR') ?? '—'} 갱신
            {data.cached && ' (캐시)'}
            {' · '}
            <Link href="/agents" className="hover:text-zinc-600 underline">에이전트 상세 →</Link>
          </p>
        )}
      </div>

      {/* ── TalkPanel ── */}
      {selectedTeam && (
        <>
          {/* 딤 배경 */}
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
            onPointerDown={() => handleSelectTeam(null)}
          />
          <TalkPanel team={selectedTeam} onClose={() => handleSelectTeam(null)} />
        </>
      )}
    </div>
  );
}
