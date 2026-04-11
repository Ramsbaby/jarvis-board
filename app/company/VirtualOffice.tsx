'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   Jarvis Company HQ — Gather Town Style Virtual Office
   Pure Canvas 2D, no external game engine
   ═══════════════════════════════════════════════════════════════════ */

const T = 32; // tile size
const COLS = 40;
const ROWS = 30;
const MOVE_SPEED = 150; // ms per tile

// ── 색상 팔레트 (16bit 레트로) ──────────────────────────────────
const C = {
  floor: '#2d2d3f',
  corridor: '#3a3a52',
  wall: '#4a5568',
  wallTop: '#5a6577',
  desk: '#8b6914',
  monitor: '#1a1a2e',
  monitorScreen: '#58a6ff',
  chair: '#4a4a6a',
  carpet: '#2a2a42',
  lobby: '#3d3530',
  serverRack: '#1a1a2e',
  serverLed: '#3fb950',
  plant: '#2d6b30',
  plantPot: '#8b6914',
  bg: '#0d1117',
  textDim: '#8b949e',
  textBright: '#e6edf3',
  green: '#3fb950',
  yellow: '#d29922',
  red: '#f85149',
  blue: '#58a6ff',
  playerBody: '#58a6ff',
  playerHead: '#f0d0a0',
};

// ── 방 정의 ────────────────────────────────────────────────────
interface RoomDef {
  id: string; name: string; emoji: string;
  x: number; y: number; w: number; h: number;
  type: 'team' | 'server' | 'meeting' | 'lobby';
  npcX: number; npcY: number;
}

const ROOMS: RoomDef[] = [
  // Row 1: 임원실
  { id: 'council', name: 'CEO실', emoji: '👔', x: 2, y: 2, w: 7, h: 5, type: 'meeting', npcX: 5, npcY: 4 },
  { id: 'infra', name: '인프라팀', emoji: '🖥️', x: 11, y: 2, w: 7, h: 5, type: 'team', npcX: 14, npcY: 4 },
  { id: 'trend', name: '정보팀', emoji: '📡', x: 20, y: 2, w: 7, h: 5, type: 'team', npcX: 23, npcY: 4 },
  { id: 'finance', name: '재무팀', emoji: '📊', x: 29, y: 2, w: 7, h: 5, type: 'team', npcX: 32, npcY: 4 },
  // Row 2: 팀 오피스
  { id: 'record', name: '기록팀', emoji: '📁', x: 2, y: 10, w: 7, h: 5, type: 'team', npcX: 5, npcY: 12 },
  { id: 'security', name: '감사팀', emoji: '🔒', x: 11, y: 10, w: 7, h: 5, type: 'team', npcX: 14, npcY: 12 },
  { id: 'academy', name: '학습팀', emoji: '📚', x: 20, y: 10, w: 7, h: 5, type: 'team', npcX: 23, npcY: 12 },
  { id: 'brand', name: '브랜드팀', emoji: '🎨', x: 29, y: 10, w: 7, h: 5, type: 'team', npcX: 32, npcY: 12 },
  // Row 3
  { id: 'career', name: '커리어팀', emoji: '💼', x: 2, y: 18, w: 7, h: 5, type: 'team', npcX: 5, npcY: 20 },
  { id: 'standup', name: '스탠드업', emoji: '🎤', x: 11, y: 18, w: 7, h: 5, type: 'meeting', npcX: 14, npcY: 20 },
  { id: 'recon', name: '정찰팀', emoji: '🔍', x: 20, y: 18, w: 7, h: 5, type: 'team', npcX: 23, npcY: 20 },
  // 서버룸
  { id: 'server-room', name: '서버룸', emoji: '🖥️', x: 29, y: 18, w: 7, h: 5, type: 'server', npcX: 32, npcY: 20 },
];

// ── 벽 타일 맵 생성 ────────────────────────────────────────────
function buildCollisionMap(): boolean[][] {
  const map = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  // 맵 경계
  for (let x = 0; x < COLS; x++) { map[0][x] = true; map[ROWS - 1][x] = true; }
  for (let y = 0; y < ROWS; y++) { map[y][0] = true; map[y][COLS - 1] = true; }
  // 방 벽 (내부는 통과 가능, 벽면만 충돌)
  for (const r of ROOMS) {
    for (let x = r.x; x < r.x + r.w; x++) {
      map[r.y][x] = true;
      map[r.y + r.h - 1][x] = true;
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      map[y][r.x] = true;
      map[y][r.x + r.w - 1] = true;
    }
    // 입구 (하단 중앙 2타일)
    const doorX = r.x + Math.floor(r.w / 2);
    map[r.y + r.h - 1][doorX] = false;
    map[r.y + r.h - 1][doorX - 1] = false;
  }
  return map;
}

// ── 브리핑 타입 ────────────────────────────────────────────────
interface BriefingData {
  id: string; name: string; emoji?: string; avatar?: string; status: string;
  summary: string; schedule?: string; title?: string; description?: string;
  stats?: { total: number; success: number; failed: number; rate: number };
  metrics?: Record<string, number>;
  recentActivity?: Array<{ time: string; task: string; result: string; message: string }>;
  recentEvents?: Array<{ time: string; task?: string; event?: string; result: string }>;
  upcoming?: Array<{ time: string; task: string }>;
  lastBoardMinutes?: string | null;
  boardMinutes?: { date: string; content: string } | null;
  alerts?: string[];
  discordChannel?: string;
}

// ── NPC 상태 ───────────────────────────────────────────────────
interface NpcState {
  status: 'green' | 'yellow' | 'red';
  task: string;
  activity: string;
}

// ═══════════════════════════════════════════════════════════════
// React 컴포넌트
// ═══════════════════════════════════════════════════════════════
export default function VirtualOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [nearbyRoom, setNearbyRoom] = useState<RoomDef | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatResp, setChatResp] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // 게임 상태 refs
  const playerRef = useRef({ x: 20, y: 8 }); // grid position
  const movingRef = useRef(false);
  const animRef = useRef({ frame: 0, dir: 0, walking: false }); // 0=down,1=left,2=right,3=up
  const tweenRef = useRef({ sx: 0, sy: 0, tx: 0, ty: 0, t: 0, active: false });
  const npcStatesRef = useRef<Record<string, NpcState>>({});
  const keysRef = useRef<Set<string>>(new Set());
  const collisionMap = useRef(buildCollisionMap());
  const panelOpenRef = useRef(false);

  // 패널 상태 sync
  useEffect(() => { panelOpenRef.current = panelOpen; }, [panelOpen]);

  // ── 데이터 로드 ──────────────────────────────────────────────
  const loadStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-live');
      if (!res.ok) return;
      const data = await res.json();
      const states: Record<string, NpcState> = {};
      for (const team of data.teams || []) {
        const st = team.status === 'failed' ? 'red' : team.status === 'success' ? 'green' : 'yellow';
        states[team.teamId] = { status: st, task: team.lastTask || '', activity: team.lastMessage || '' };
      }
      // 서버룸은 별도 헬스
      try {
        const hRes = await fetch('/api/entity/cron-engine/briefing');
        if (hRes.ok) {
          const h = await hRes.json() as BriefingData;
          states['server-room'] = {
            status: h.status === 'GREEN' ? 'green' : h.status === 'RED' ? 'red' : 'yellow',
            task: 'system', activity: h.summary || '',
          };
        }
      } catch { /* skip */ }
      npcStatesRef.current = states;
    } catch { /* retry */ }
  }, []);

  const openBriefing = useCallback(async (roomId: string) => {
    setPanelOpen(true);
    setBriefing(null);
    setChatResp('');
    try {
      // 팀 브리핑 API
      const res = await fetch(`/api/entity/${roomId}/briefing`);
      if (res.ok) {
        setBriefing(await res.json() as BriefingData);
        return;
      }
      // fallback: agent-live에서
      const res2 = await fetch('/api/agent-live');
      if (!res2.ok) return;
      const data = await res2.json();
      const team = (data.teams || []).find((t: { teamId: string }) => t.teamId === roomId);
      if (team) {
        setBriefing({
          id: roomId, name: team.label, emoji: team.emoji, status: team.status === 'success' ? 'GREEN' : team.status === 'failed' ? 'RED' : 'YELLOW',
          summary: `최근: ${team.lastTask || 'idle'} — ${team.lastMessage || ''}`,
          schedule: team.schedule,
          stats: { total: team.successCount24h + team.failCount24h, success: team.successCount24h, failed: team.failCount24h, rate: team.successCount24h + team.failCount24h > 0 ? Math.round(team.successCount24h / (team.successCount24h + team.failCount24h) * 100) : 0 },
          recentActivity: team.recentCrons || [],
        });
      }
    } catch { setBriefing(null); }
  }, []);

  // ── 게임 루프 (Canvas) ───────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastMove = 0;
    const cMap = collisionMap.current;

    // 키 입력
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
        const nr = findNearbyRoom();
        if (nr) openBriefing(nr.id);
      }
      if (e.key === 'Escape') { setPanelOpen(false); setBriefing(null); }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 리사이즈
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    function findNearbyRoom(): RoomDef | null {
      const p = playerRef.current;
      for (const r of ROOMS) {
        const dist = Math.abs(p.x - r.npcX) + Math.abs(p.y - r.npcY);
        if (dist <= 2) return r;
      }
      return null;
    }

    // ── 렌더 함수들 ────────────────────────────────────────────
    function drawTile(x: number, y: number, color: string) {
      ctx!.fillStyle = color;
      ctx!.fillRect(x * T, y * T, T, T);
    }

    function drawRoom(r: RoomDef, camX: number, camY: number) {
      const rx = r.x * T - camX, ry = r.y * T - camY;
      const rw = r.w * T, rh = r.h * T;

      // 바닥
      ctx!.fillStyle = r.type === 'server' ? '#1a1a2e' : r.type === 'meeting' ? '#2a2535' : C.carpet;
      ctx!.fillRect(rx, ry, rw, rh);

      // 벽
      ctx!.strokeStyle = C.wall;
      ctx!.lineWidth = 2;
      ctx!.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);

      // 벽 상단 두께감
      ctx!.fillStyle = C.wallTop;
      ctx!.fillRect(rx, ry, rw, 4);

      // 입구 (하단 중앙 빈 공간)
      const doorX = (r.x + Math.floor(r.w / 2)) * T - camX;
      ctx!.fillStyle = C.corridor;
      ctx!.fillRect(doorX - T, ry + rh - 4, T * 2, 6);

      // 가구: 책상
      const deskX = (r.x + 2) * T - camX;
      const deskY = (r.y + 1) * T - camY;
      ctx!.fillStyle = C.desk;
      ctx!.fillRect(deskX, deskY, T * 2, T * 0.6);
      // 모니터
      ctx!.fillStyle = C.monitor;
      ctx!.fillRect(deskX + 8, deskY - 12, 16, 12);
      ctx!.fillStyle = C.monitorScreen;
      ctx!.fillRect(deskX + 10, deskY - 10, 12, 8);

      // 서버룸 특수 가구
      if (r.type === 'server') {
        for (let i = 0; i < 3; i++) {
          const sx = (r.x + 1 + i * 2) * T - camX;
          const sy = (r.y + 1) * T - camY;
          ctx!.fillStyle = C.serverRack;
          ctx!.fillRect(sx, sy, T * 1.2, T * 2.5);
          // LED 표시등
          for (let j = 0; j < 4; j++) {
            ctx!.fillStyle = j % 2 === 0 ? C.serverLed : C.blue;
            ctx!.fillRect(sx + 4, sy + 6 + j * 8, 4, 3);
          }
        }
      }

      // 방 이름
      ctx!.fillStyle = C.textDim;
      ctx!.font = '11px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText(`${r.emoji} ${r.name}`, rx + rw / 2, ry + 16);
    }

    function drawNPC(r: RoomDef, camX: number, camY: number) {
      const nx = r.npcX * T - camX + T / 2;
      const ny = r.npcY * T - camY + T / 2;
      const state = npcStatesRef.current[r.id];
      const stColor = state?.status === 'red' ? C.red : state?.status === 'yellow' ? C.yellow : C.green;

      // 그림자
      ctx!.fillStyle = 'rgba(0,0,0,0.3)';
      ctx!.beginPath();
      ctx!.ellipse(nx, ny + 12, 8, 4, 0, 0, Math.PI * 2);
      ctx!.fill();

      // 몸체
      ctx!.fillStyle = stColor + '60';
      ctx!.fillRect(nx - 6, ny - 2, 12, 14);

      // 머리
      ctx!.fillStyle = '#f0d0a0';
      ctx!.beginPath();
      ctx!.arc(nx, ny - 6, 7, 0, Math.PI * 2);
      ctx!.fill();

      // 상태 LED
      ctx!.fillStyle = stColor;
      ctx!.beginPath();
      ctx!.arc(nx + 10, ny - 12, 4, 0, Math.PI * 2);
      ctx!.fill();
      // LED glow
      ctx!.shadowColor = stColor;
      ctx!.shadowBlur = 6;
      ctx!.fill();
      ctx!.shadowBlur = 0;

      // 이름표
      const label = state?.task && state.task.length > 12 ? state.task.slice(0, 11) + '…' : (state?.task || 'idle');
      ctx!.fillStyle = C.textDim;
      ctx!.font = '9px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText(label, nx, ny + 26);
    }

    function drawPlayer(camX: number, camY: number) {
      const p = playerRef.current;
      let px: number, py: number;

      if (tweenRef.current.active) {
        const tw = tweenRef.current;
        px = (tw.sx + (tw.tx - tw.sx) * tw.t) * T - camX + T / 2;
        py = (tw.sy + (tw.ty - tw.sy) * tw.t) * T - camY + T / 2;
      } else {
        px = p.x * T - camX + T / 2;
        py = p.y * T - camY + T / 2;
      }

      // 그림자
      ctx!.fillStyle = 'rgba(0,0,0,0.4)';
      ctx!.beginPath();
      ctx!.ellipse(px, py + 13, 8, 4, 0, 0, Math.PI * 2);
      ctx!.fill();

      // 몸체
      ctx!.fillStyle = C.playerBody;
      ctx!.fillRect(px - 6, py - 2, 12, 14);

      // 머리
      ctx!.fillStyle = C.playerHead;
      ctx!.beginPath();
      ctx!.arc(px, py - 7, 8, 0, Math.PI * 2);
      ctx!.fill();

      // 눈
      ctx!.fillStyle = '#333';
      ctx!.fillRect(px - 3, py - 8, 2, 2);
      ctx!.fillRect(px + 1, py - 8, 2, 2);

      // 이름표
      ctx!.fillStyle = C.blue;
      ctx!.font = 'bold 10px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText('YOU', px, py - 18);
    }

    function drawInteractPrompt(room: RoomDef, camX: number, camY: number) {
      const nx = room.npcX * T - camX + T / 2;
      const ny = room.npcY * T - camY - 24;
      const text = `[E] ${room.name}`;
      const tw = ctx!.measureText(text).width + 16;

      ctx!.fillStyle = 'rgba(0,0,0,0.8)';
      ctx!.beginPath();
      ctx!.roundRect(nx - tw / 2, ny - 10, tw, 20, 6);
      ctx!.fill();

      ctx!.fillStyle = '#fff';
      ctx!.font = 'bold 11px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText(text, nx, ny + 4);
    }

    // ── 게임 루프 ──────────────────────────────────────────────
    function gameLoop(time: number) {
      const w = canvas!.width;
      const h = canvas!.height;

      // 이동 처리
      if (!movingRef.current && !panelOpenRef.current && time - lastMove > MOVE_SPEED) {
        const keys = keysRef.current;
        let dx = 0, dy = 0;
        if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) { dx = -1; animRef.current.dir = 1; }
        else if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) { dx = 1; animRef.current.dir = 2; }
        else if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) { dy = -1; animRef.current.dir = 3; }
        else if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) { dy = 1; animRef.current.dir = 0; }

        if (dx !== 0 || dy !== 0) {
          const p = playerRef.current;
          const nx = p.x + dx, ny = p.y + dy;
          if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !cMap[ny][nx]) {
            movingRef.current = true;
            tweenRef.current = { sx: p.x, sy: p.y, tx: nx, ty: ny, t: 0, active: true };
            playerRef.current = { x: nx, y: ny };
            animRef.current.walking = true;
            lastMove = time;

            // 트윈 애니메이션
            const startTime = time;
            const tweenLoop = (t: number) => {
              const progress = Math.min(1, (t - startTime) / MOVE_SPEED);
              tweenRef.current.t = progress;
              if (progress >= 1) {
                tweenRef.current.active = false;
                movingRef.current = false;
                animRef.current.walking = false;
              } else {
                requestAnimationFrame(tweenLoop);
              }
            };
            requestAnimationFrame(tweenLoop);
          }
        }
      }

      // 근접 NPC 감지
      const nearby = findNearbyRoom();
      setNearbyRoom(nearby);

      // 카메라
      const p = playerRef.current;
      let cpx = p.x * T, cpy = p.y * T;
      if (tweenRef.current.active) {
        const tw = tweenRef.current;
        cpx = (tw.sx + (tw.tx - tw.sx) * tw.t) * T;
        cpy = (tw.sy + (tw.ty - tw.sy) * tw.t) * T;
      }
      const camX = Math.max(0, Math.min(COLS * T - w, cpx - w / 2 + T / 2));
      const camY = Math.max(0, Math.min(ROWS * T - h, cpy - h / 2 + T / 2));

      // 클리어
      ctx!.fillStyle = C.bg;
      ctx!.fillRect(0, 0, w, h);

      // 바닥 (복도)
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const sx = x * T - camX, sy = y * T - camY;
          if (sx > w || sy > h || sx + T < 0 || sy + T < 0) continue;
          ctx!.fillStyle = (x + y) % 2 === 0 ? C.corridor : '#363650';
          ctx!.fillRect(sx, sy, T, T);
        }
      }

      // 방
      for (const r of ROOMS) drawRoom(r, camX, camY);

      // NPC
      for (const r of ROOMS) drawNPC(r, camX, camY);

      // 플레이어
      drawPlayer(camX, camY);

      // 상호작용 프롬프트
      if (nearby && !panelOpenRef.current) {
        drawInteractPrompt(nearby, camX, camY);
      }

      // HUD: 하단바
      ctx!.fillStyle = 'rgba(13,17,23,0.85)';
      ctx!.fillRect(0, h - 32, w, 32);
      ctx!.fillStyle = C.textDim;
      ctx!.font = '11px monospace';
      ctx!.textAlign = 'left';
      ctx!.fillText('[←↑↓→/WASD] 이동   [E/Space] 대화   [ESC] 닫기', 12, h - 12);

      // HUD: 시간
      ctx!.textAlign = 'right';
      ctx!.fillStyle = C.blue;
      const now = new Date();
      ctx!.fillText(now.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST', w - 12, h - 12);

      // HUD: 상단 타이틀
      ctx!.fillStyle = 'rgba(13,17,23,0.7)';
      ctx!.fillRect(0, 0, w, 28);
      ctx!.fillStyle = C.blue;
      ctx!.font = 'bold 13px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText('🏢 JARVIS COMPANY HQ', w / 2, 18);

      // 미니맵
      drawMinimap(w, camX, camY);

      animId = requestAnimationFrame(gameLoop);
    }

    function drawMinimap(canvasW: number, _camX: number, _camY: number) {
      const mmW = 140, mmH = 100;
      const mx = canvasW - mmW - 12, my = 36;
      const scale = Math.min(mmW / (COLS * T), mmH / (ROWS * T));

      ctx!.fillStyle = 'rgba(13,17,23,0.8)';
      ctx!.fillRect(mx - 2, my - 2, mmW + 4, mmH + 4);
      ctx!.strokeStyle = '#30363d';
      ctx!.strokeRect(mx - 2, my - 2, mmW + 4, mmH + 4);

      // 방
      for (const r of ROOMS) {
        const state = npcStatesRef.current[r.id];
        const color = state?.status === 'red' ? C.red : state?.status === 'yellow' ? C.yellow : C.green;
        ctx!.fillStyle = color + '40';
        ctx!.fillRect(mx + r.x * T * scale, my + r.y * T * scale, r.w * T * scale, r.h * T * scale);
        ctx!.strokeStyle = color;
        ctx!.lineWidth = 1;
        ctx!.strokeRect(mx + r.x * T * scale, my + r.y * T * scale, r.w * T * scale, r.h * T * scale);
      }

      // 플레이어
      const p = playerRef.current;
      ctx!.fillStyle = C.playerBody;
      ctx!.beginPath();
      ctx!.arc(mx + p.x * T * scale + T * scale / 2, my + p.y * T * scale + T * scale / 2, 3, 0, Math.PI * 2);
      ctx!.fill();
    }

    // 데이터 로드 시작
    loadStatuses();
    const dataInterval = setInterval(loadStatuses, 15000);

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(dataInterval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
    };
  }, [loadStatuses, openBriefing]);

  // ── /btw 전송 ────────────────────────────────────────────────
  const sendBtw = async () => {
    if (!chatInput.trim() || !briefing) return;
    setChatLoading(true); setChatResp('');
    const msg = chatInput; setChatInput('');
    try {
      setChatResp(`✅ "${msg}" → ${briefing.name || briefing.id} 전송됨`);
    } catch { setChatResp('❌ 전송 실패'); }
    setChatLoading(false);
  };

  // ── 렌더 ─────────────────────────────────────────────────────
  const stColor = (s: string) => {
    const m: Record<string, string> = { GREEN: '#3fb950', YELLOW: '#d29922', RED: '#f85149' };
    return m[s] || m.GREEN;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, color: C.textBright, fontFamily: '-apple-system, sans-serif', overflow: 'hidden' }}>
      {/* 게임 캔버스 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>

      {/* 브리핑 패널 */}
      <div style={{
        width: panelOpen ? 380 : 0, minWidth: panelOpen ? 380 : 0,
        transition: 'all 0.3s ease', overflow: 'hidden',
        borderLeft: panelOpen ? '1px solid #30363d' : 'none',
        background: '#161b22',
      }}>
        <div style={{ width: 380, height: '100vh', overflowY: 'auto', padding: panelOpen ? '16px 20px' : 0 }}>
          {briefing ? (
            <>
              <button onClick={() => { setPanelOpen(false); setBriefing(null); }} style={{
                float: 'right', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 18,
              }}>✕</button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 36 }}>{briefing.emoji || briefing.avatar || '👤'}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{briefing.name}</div>
                  <div style={{ fontSize: 12, color: '#8b949e' }}>{briefing.title || briefing.description || ''}</div>
                  {briefing.schedule && <div style={{ fontSize: 11, color: '#8b949e' }}>📅 {briefing.schedule}</div>}
                </div>
              </div>

              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 16,
                fontSize: 12, fontWeight: 600, background: stColor(briefing.status) + '18',
                color: stColor(briefing.status), border: `1px solid ${stColor(briefing.status)}`,
              }}>● {briefing.status === 'GREEN' ? '정상' : briefing.status === 'RED' ? '이상' : '주의'}</span>

              <div style={{ marginTop: 16 }}>
                <h4 style={{ color: '#8b949e', fontSize: 13, margin: '0 0 6px' }}>📌 현재 상태</h4>
                <p style={{ margin: 0, fontSize: 13 }}>{briefing.summary}</p>
              </div>

              {briefing.stats && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ color: '#8b949e', fontSize: 13, margin: '0 0 6px' }}>📊 24h 지표</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[['성공률', `${briefing.stats.rate}%`], ['성공', String(briefing.stats.success)], ['실패', String(briefing.stats.failed)]].map(([l, v], i) => (
                      <div key={i} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#8b949e' }}>{l}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: i === 2 ? C.red : i === 1 ? C.green : C.textBright }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(briefing.recentActivity?.length || briefing.recentEvents?.length) ? (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ color: '#8b949e', fontSize: 13, margin: '0 0 6px' }}>📋 최근 활동</h4>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {(briefing.recentActivity || briefing.recentEvents || []).slice(0, 10).map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, padding: '3px 0', fontSize: 11, borderBottom: '1px solid #21262d' }}>
                        <span style={{ color: '#8b949e', minWidth: 38 }}>{(a.time || '').slice(11, 16)}</span>
                        <span style={{ color: a.result === 'SUCCESS' || a.result === 'success' ? C.green : a.result === 'FAILED' || a.result === 'failed' ? C.red : C.yellow, fontWeight: 600, minWidth: 50 }}>{a.result}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.task || (a as { event?: string }).event}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(briefing.lastBoardMinutes || briefing.boardMinutes) && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ color: '#8b949e', fontSize: 13, margin: '0 0 6px' }}>📝 최근 보고</h4>
                  <pre style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 10, fontSize: 10, color: '#8b949e', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
                    {briefing.lastBoardMinutes || briefing.boardMinutes?.content || ''}
                  </pre>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <h4 style={{ color: '#8b949e', fontSize: 13, margin: '0 0 6px' }}>💬 /btw 말걸기</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendBtw()}
                    placeholder={`${briefing.name}에게...`}
                    style={{ flex: 1, background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: '6px 10px', color: '#e6edf3', fontSize: 12, outline: 'none' }} />
                  <button onClick={sendBtw} disabled={chatLoading} style={{
                    background: '#238636', border: 'none', borderRadius: 6, padding: '6px 14px', color: '#fff', fontSize: 12, cursor: 'pointer',
                  }}>전송</button>
                </div>
                {chatResp && <div style={{ marginTop: 8, fontSize: 12, color: chatResp.startsWith('✅') ? C.green : C.red }}>{chatResp}</div>}
              </div>
            </>
          ) : panelOpen ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>로딩 중...</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
