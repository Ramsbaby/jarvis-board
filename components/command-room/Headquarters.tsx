'use client';

import { useEffect, useRef, useState } from 'react';
import type { Station, StationId } from '@/lib/command-room/types';
import { COLLISIONS, createMovementControls, createTapGesture, nearby, pathTo, SPACES, TILE, WORLD, type Direction } from './world';

const STATUS_COLORS = { running: '#82c9ad', waiting: '#d4bd82', attention: '#eea282', unknown: '#a9b4be', scheduled: '#9cb4da' };
function Plant({ x, y, large = false }: { x: number; y: number; large?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${large ? 1.3 : 1})`}>
    <ellipse cx="0" cy="16" rx="18" ry="6" fill="#283d37" opacity=".14" />
    <path d="M-12 0 L12 0 L9 20 L-8 20Z" fill="#c88764" /><path d="M0 3V-26" stroke="#4e7061" strokeWidth="4" />
    <ellipse cx="-8" cy="-13" rx="9" ry="16" transform="rotate(-40 -8 -13)" fill="#547c65" />
    <ellipse cx="9" cy="-20" rx="9" ry="15" transform="rotate(35 9 -20)" fill="#789776" />
    <ellipse cx="-1" cy="-30" rx="7" ry="12" fill="#63896a" />
  </g>;
}
function Bookshelf({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect x="2" y="5" width="83" height="64" rx="3" fill="#624b3a" opacity=".2" />
    <rect width="82" height="62" rx="3" fill="#927252" /><rect x="5" y="5" width="72" height="24" fill="#654f3f" />
    <rect x="5" y="34" width="72" height="22" fill="#654f3f" />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <g key={n}><rect x={9 + n * 8} y={8 + n % 3 * 2} width="6" height={20 - n % 3 * 2} rx="1" fill={['#a9b5a0', '#c89b77', '#8f9ea5', '#d9c99e'][n % 4]} /><rect x={10 + n * 8} y="38" width="5" height="17" fill={['#a49b80', '#899f93', '#ba876b'][n % 3]} /></g>)}
    <rect y="28" width="82" height="5" fill="#ac8b65" />
  </g>;
}
function Desk({ x, y, color, kind }: { x: number; y: number; color: string; kind: string }) {
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cx="83" cy="81" rx="83" ry="13" fill="#4c4437" opacity=".12" />
    <rect x="9" y="19" width="157" height="66" rx="8" fill="#8b6d51" />
    <rect x="3" y="8" width="167" height="65" rx="7" fill="#b8976c" /><rect x="6" y="8" width="161" height="5" rx="2" fill="#d1b58c" />
    <rect x="25" y="0" width="70" height="45" rx="5" fill="#344947" /><rect x="30" y="5" width="60" height="32" rx="2" fill="#b6d5c5" />
    <rect x="34" y="10" width="22" height="4" rx="1" fill={color} /><rect x="34" y="19" width="42" height="3" rx="1" fill="#719d8e" /><rect x="34" y="26" width="30" height="3" rx="1" fill="#8cb3a3" />
    <rect x="55" y="44" width="12" height="6" fill="#455c53" /><rect x="45" y="49" width="33" height="4" rx="2" fill="#455c53" />
    <rect x="31" y="57" width="63" height="10" rx="2" fill="#e5dac1" /><path d="M37 60H88 M40 64H84" stroke="#b7ac94" strokeWidth="2" />
    <rect x="115" y="27" width="30" height="35" rx="2" fill="#f0e4cb" /><path d="M120 34H139 M120 40H136 M120 46H139" stroke={color} strokeWidth="2" />
    <circle cx="148" cy="17" r="9" fill="#ead9b7" /><circle cx="148" cy="17" r="5" fill="#866c51" />
    {kind === 'qa' && <g><rect x="-24" y="30" width="18" height="29" rx="3" fill="#425a51" /><rect x="-21" y="34" width="12" height="19" rx="1" fill="#b8d2af" /></g>}
    {kind === 'codex' && <g><rect x="173" y="0" width="36" height="65" rx="3" fill="#526468" />{[0, 1, 2].map(i => <g key={i}><rect x="177" y={7 + i * 18} width="28" height="12" rx="1" fill="#354e52" /><circle cx="198" cy={13 + i * 18} r="2" fill="#a0b8a2" /></g>)}</g>}
    <rect x="63" y="83" width="45" height="28" rx="12" fill={color} /><rect x="68" y="88" width="35" height="11" rx="5" fill="#ffffff" opacity=".12" /><path d="M85 111V119 M71 119H99" stroke="#5c655a" strokeWidth="4" />
  </g>;
}
function Jarvis({ characterScale }: { characterScale: number }) {
  return <g className="hq-jarvis" aria-label="JARVIS 홀로그램 인터페이스" pointerEvents="none" transform={`translate(480 320) scale(${characterScale} 1)`}>
    <circle r="40" fill="#071c30" fillOpacity=".85" stroke="#55cfe5" strokeWidth="1" />
    <circle r="32" fill="none" stroke="#5ed9ee" strokeWidth="3" strokeDasharray="44 8 12 8" />
    <circle r="23" fill="none" stroke="#7ae4f0" strokeOpacity=".55" />
    <circle r="12" fill="#55d8e9" fillOpacity=".18" stroke="#b4f5ff" />
    <path d="M-6 0H6 M0-6V6 M-47 0H-36 M36 0H47 M0-47V-36 M0 36V47" stroke="#98edf5" strokeWidth="2" />
    <text y="62" textAnchor="middle" fill="#b8f2ff" fontSize="11" fontWeight="700" letterSpacing="3">J.A.R.V.I.S.</text>
  </g>;
}
export default function Headquarters({ stations, selected, onSelect, onInteract }: { stations: Station[]; selected: StationId; onSelect: (id: StationId) => void; onInteract: () => void }) {
  const [position, setPosition] = useState({ x: 13, y: 10 });
  const [moving, setMoving] = useState(false);
  const [hint, setHint] = useState('');
  const [characterScale, setCharacterScale] = useState(1);
  const route = useRef<{ x: number; y: number }[]>([]);
  const positionRef = useRef(position);
  const controls = useRef(createMovementControls());
  const gesture = useRef(createTapGesture());
  const sceneRef = useRef<SVGSVGElement>(null);
  const near = nearby(position);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setCharacterScale((height / WORLD.height) / (width / WORLD.width));
    });
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const input = controls.current;
    const tap = gesture.current;
    const keyDirections: Record<string, Direction> = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' };
    const down = (event: KeyboardEvent) => {
      if (!(document.activeElement instanceof Element) || !sceneRef.current?.contains(document.activeElement)) return;
      const key = event.key.toLowerCase();
      if (keyDirections[key] || key === 'e' || key === 'enter') { event.preventDefault(); onInteract(); }
      if (key === 'e' || key === 'enter') {
        const current = nearby(positionRef.current);
        if (current) { onSelect(current.id); setHint(`${current.name} 상태를 열었습니다.`); }
      } else if (keyDirections[key]) input.press(`key:${key}`, keyDirections[key]);
    };
    const up = (event: KeyboardEvent) => input.release(`key:${event.key.toLowerCase()}`);
    const release = (event: PointerEvent) => input.release(`pointer:${event.pointerId}`);
    const clear = () => { input.clear(); tap.cancel(); route.current = []; setMoving(false); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => {
      if (document.hidden) { clear(); return; }
      const p = positionRef.current;
      const { x: dx, y: dy } = input.vector();
      let next: { x: number; y: number } | undefined;
      if (dx || dy) { route.current = []; next = { x: p.x + dx, y: p.y + (dx ? 0 : dy) }; }
      else next = route.current.shift();
      if (next && !COLLISIONS[next.y]?.[next.x]) { positionRef.current = next; setPosition(next); setMoving(true); }
      else setMoving(false);
    }, 110);
    return () => { clearInterval(timer); input.clear(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); document.removeEventListener('visibilitychange', visibility); };
  }, [onSelect, onInteract]);
  function moveTo(x: number, y: number) { route.current = pathTo(positionRef.current, { x, y }); }
  function step(direction: Direction) {
    onInteract(); route.current = [];
    const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    const next = { x: positionRef.current.x + delta[0], y: positionRef.current.y + delta[1] };
    if (!COLLISIONS[next.y]?.[next.x]) { positionRef.current = next; setPosition(next); }
  }
  return <div className="hq-world-wrap">
    <div className="hq-world-scroll" role="region" aria-label="작업실 전체 지도">
      <svg ref={sceneRef} viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} className="hq-world" preserveAspectRatio="none" role="application" aria-label="작업실. 방향키나 WASD로 이동하고 가까운 데스크에서 E로 살펴보세요. 아래 데스크 버튼과 이동 버튼도 사용할 수 있습니다." tabIndex={0}
        onBlur={() => { controls.current.clear(); route.current = []; }}
        onPointerDown={event => { if (event.button !== 0) return; onInteract(); gesture.current.begin(event.pointerId, event.clientX, event.clientY); }}
        onPointerMove={event => gesture.current.move(event.pointerId, event.clientX, event.clientY)}
        onPointerCancel={() => gesture.current.cancel()}
        onPointerLeave={() => gesture.current.cancel()}
        onPointerUp={event => {
          if (!gesture.current.finish(event.pointerId, event.clientX, event.clientY)) return;
          sceneRef.current?.focus({ preventScroll: true });
          const stationId = (event.target as Element).closest('[data-station]')?.getAttribute('data-station');
          const space = SPACES.find(item => item.id === stationId);
          if (space) { moveTo(space.approach.x, space.approach.y); onSelect(space.id); return; }
          const rect = event.currentTarget.getBoundingClientRect();
          moveTo(Math.floor((event.clientX - rect.left) / rect.width * WORLD.width / TILE), Math.floor((event.clientY - rect.top) / rect.height * WORLD.height / TILE));
        }}>
        <defs>
          <pattern id="hq-planks" width="128" height="32" patternUnits="userSpaceOnUse"><rect width="128" height="32" fill="#d5c5a7" /><path d="M0 31H128 M64 0V31 M0 4H55 M70 27H120" stroke="#bdac91" strokeWidth="1" opacity=".6" /></pattern>
          <pattern id="hq-rug" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0L12 12 M12 0L0 12" stroke="#fff" strokeWidth=".5" opacity=".12" /></pattern>
          <filter id="hq-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#28372d" floodOpacity=".17" /></filter>
        </defs>
        <rect width="960" height="608" rx="6" fill="#163a3b" />
        <rect x="11" y="52" width="938" height="546" rx="5" fill="#725e49" />
        <rect x="18" y="44" width="924" height="548" rx="7" fill="url(#hq-planks)" />
        <path d="M16 49V17H944V49" fill="#4f6c5f" /><path d="M18 49H942" stroke="#9a997a" strokeWidth="7" />
        {[104, 348, 592, 836].map(x => <g key={x}><rect x={x - 48} y="11" width="96" height="32" rx="3" fill="#264f63" /><path d={`M${x} 11V43 M${x - 47} 27H${x + 47}`} stroke="#54776a" strokeWidth="4" /><path d={`M${x - 40} 39L${x - 10} 13H${x + 8}L${x - 24} 40Z`} fill="#7ba8ab" opacity=".25" /></g>)}
        {[228, 720].map(x => <g key={x}><path d={`M${x} 49V67`} stroke="#40564e" strokeWidth="3" /><path d={`M${x - 15} 78L${x - 9} 66H${x + 9}L${x + 15} 78Z`} fill="#e4bc74" /><ellipse cx={x} cy="105" rx="68" ry="36" fill="#ffe2a3" opacity=".1" /></g>)}
        <path d="M464 50V589 M496 50V589" stroke="#eadbc0" strokeWidth="1" opacity=".8" />
        <path d="M32 319H928" stroke="#efe2c9" strokeWidth="52" /><path d="M32 319H928" stroke="#d2c0a0" strokeDasharray="4 12" opacity=".6" />
        <g transform="translate(432 287)"><rect width="96" height="63" rx="20" fill="#c1b58f" /><path d="M31 14V35Q31 46 44 46Q57 46 57 34V14" stroke="#62735f" strokeWidth="5" fill="none" /><circle cx="69" cy="44" r="3" fill="#62735f" /></g>
        {SPACES.map(space => {
          const station = stations.find(item => item.id === space.id);
          const color = station ? STATUS_COLORS[station.status] : STATUS_COLORS.unknown;
          const top = space.y < 300;
          return <g key={space.id} data-station={space.id} className="hq-map-station" aria-hidden="true">
            <rect x={space.x - 8} y={space.y + 14} width="352" height="200" rx="12" fill={space.color} opacity=".08" />
            <rect x={space.x + 9} y={space.y + 54} width="318" height="143" rx="10" fill={space.color} opacity=".35" />
            <rect x={space.x + 15} y={space.y + 59} width="306" height="131" rx="8" fill="url(#hq-rug)" />
            <rect x={space.x - 8} y={space.y - 2} width="352" height="42" rx="6" fill={selected === space.id ? '#264d53' : '#536553'} filter="url(#hq-shadow)" />
            <circle cx={space.x + 10} cy={space.y + 19} r="5" fill={color} />
            <text x={space.x + 25} y={space.y + 25} fill="#fff4da" fontSize="17" fontWeight="700">{space.name}</text>
            <text x={space.x + 324} y={space.y + 24} textAnchor="end" fill="#dedbc0" fontSize="11">0{SPACES.indexOf(space) + 1}</text>
            <Desk x={space.x + 108} y={space.y + 77} color={space.color} kind={space.id} />
            <Bookshelf x={space.x + 8} y={space.y + 64} />
            <Plant x={space.x + 28} y={space.y + 177} />
            <g transform={`translate(${space.x + 310} ${space.y + 148})`}><rect x="-10" y="0" width="28" height="34" rx="3" fill="#e9dbb8" /><path d="M-4 8H12 M-4 15H9 M-4 22H12" stroke="#a68d63" strokeWidth="2" /></g>
            {space.id === 'secretary' && <g transform={`translate(${space.x + 315} ${space.y + 104})`}><rect width="14" height="42" rx="3" fill="#d0b575" /><circle cx="7" cy="-7" r="17" fill="#ead6a1" /><circle cx="7" cy="-7" r="9" fill="#f2e5bf" /></g>}
            <g transform={`translate(${space.x + 80} ${top ? space.y + 219 : space.y - 28})`}>
              <rect x="0" y="-12" width="202" height="25" rx="12" fill="#f5edda" opacity=".97" /><circle cx="13" cy="0" r="3.5" fill={station?.status === 'attention' ? '#b16b4c' : '#557965'} />
              <text x="24" y="4" fill="#4a564b" fontSize="11.5" fontWeight="600">{station?.statusLabel ?? '실제 상태 확인 중'}</text>
            </g>
          </g>;
        })}
        <Jarvis characterScale={characterScale} /><Plant x={33} y={310} large /><Plant x={927} y={310} large />
        <g transform="translate(450 68)"><rect width="60" height="110" rx="5" fill="#7e8d70" /><rect x="7" y="9" width="46" height="90" rx="3" fill="#b3bea0" /><path d="M16 22H44 M16 34H39 M16 46H44" stroke="#d5dbc1" strokeWidth="5" /><text x="30" y="77" textAnchor="middle" fill="#4b6956" fontSize="11" fontWeight="800">JARVIS</text><text x="30" y="92" textAnchor="middle" fill="#4b6956" fontSize="9">HQ</text></g>
        <g className={`hq-avatar ${moving ? 'is-moving' : ''}`} style={{ transform: `translate(${position.x * TILE + TILE / 2}px, ${position.y * TILE + TILE / 2}px)` }}>
          <ellipse cy="13" rx="13" ry="5" fill="#344c41" opacity=".24" /><g transform={`scale(${characterScale} 1) translate(-12 -22)`}>
            <rect x="5" y="0" width="15" height="6" rx="2" fill="#423e37" /><rect x="3" y="5" width="19" height="13" rx="4" fill="#e1b28c" /><rect x="3" y="4" width="5" height="9" fill="#423e37" /><rect x="17" y="5" width="6" height="5" fill="#423e37" />
            <rect x="10" y="10" width="2" height="2" fill="#343c36" /><rect x="17" y="10" width="2" height="2" fill="#343c36" />
            <path d="M4 19L0 31H6L8 26V37H20V25L22 31H27L23 19Z" fill="#425f50" /><rect x="9" y="20" width="11" height="9" rx="2" fill="#678472" /><rect x="9" y="37" width="5" height="7" fill="#514c40" /><rect x="16" y="37" width="5" height="7" fill="#514c40" />
          </g><rect x="-23" y="-42" width="46" height="16" rx="7" fill="#f5ecd5" /><text x="0" y="-31" textAnchor="middle" fill="#3d5347" fontSize="10" fontWeight="700">주인님</text>
        </g>
      </svg>
    </div>
    <div className="hq-world-footer"><span className="hq-walk-hint"><span className="hq-key">W A S D</span> / 방향키 이동 · 빈 곳 클릭 · 가까운 데스크에서 E</span>
      {near && <button onClick={() => { onSelect(near.id); setHint(`${near.name} 상태를 열었습니다.`); }}><span className="hq-key">E</span> {near.name} 살펴보기 ↗</button>}
    </div>
    <div className="hq-touch-controls" role="group" aria-label="주인님 이동 버튼">
      <span>이동</span><div className="hq-dpad">{(['up', 'left', 'down', 'right'] as const).map(direction => <button key={direction} className={`hq-pad-${direction}`} aria-label={{ up: '위로 이동', left: '왼쪽으로 이동', down: '아래로 이동', right: '오른쪽으로 이동' }[direction]}
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onInteract(); route.current = []; controls.current.press(`pointer:${event.pointerId}`, direction); step(direction); }}
        onPointerUp={event => controls.current.release(`pointer:${event.pointerId}`)}
        onPointerCancel={event => controls.current.release(`pointer:${event.pointerId}`)}
        onLostPointerCapture={event => controls.current.release(`pointer:${event.pointerId}`)}
        onBlur={() => controls.current.clear()}
        onClick={event => { if (event.detail === 0) step(direction); }}
      >{{ up: '↑', left: '←', down: '↓', right: '→' }[direction]}</button>)}</div><span className="hq-touch-note">길게 눌러 이동</span>
    </div>
    <p className="sr-only" role="status">{hint}</p>
  </div>;
}
