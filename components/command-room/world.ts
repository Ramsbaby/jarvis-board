import { aStarPath, COLS, ROWS } from '@/lib/map/rooms';
import type { StationId } from '@/lib/command-room/types';

export const TILE = 32;
export const WORLD = { width: 960, height: 608 };
export const SPACES: { id: StationId; name: string; x: number; y: number; color: string; tile: { x: number; y: number }; approach: { x: number; y: number } }[] = [
  { id: 'work', name: '현재 업무', x: 64, y: 64, color: '#bb714d', tile: { x: 8, y: 5 }, approach: { x: 8, y: 8 } },
  { id: 'qa', name: '고스톱 연구실', x: 544, y: 64, color: '#658980', tile: { x: 23, y: 5 }, approach: { x: 23, y: 8 } },
  { id: 'secretary', name: '비서 데스크', x: 64, y: 368, color: '#b69a55', tile: { x: 8, y: 15 }, approach: { x: 8, y: 13 } },
  { id: 'codex', name: '자동화 관제실', x: 544, y: 368, color: '#7486a7', tile: { x: 23, y: 15 }, approach: { x: 23, y: 13 } },
];
export const COLLISIONS = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) =>
  x < 1 || x >= 29 || y < 2 || y >= 18 || ((y === 5 || y === 6 || y === 15 || y === 16) && ((x >= 5 && x <= 10) || (x >= 20 && x <= 25)))));
export function pathTo(from: { x: number; y: number }, to: { x: number; y: number }) {
  return aStarPath(from.x, from.y, to.x, to.y, COLLISIONS);
}
export function nearby(position: { x: number; y: number }) {
  return SPACES.find(space => Math.hypot(space.tile.x - position.x, space.tile.y - position.y) <= 3.4);
}

export type Direction = 'up' | 'down' | 'left' | 'right';
export function createMovementControls() {
  const held = new Map<string, Direction>();
  return {
    press: (id: string, direction: Direction) => held.set(id, direction),
    release: (id: string) => held.delete(id),
    clear: () => held.clear(),
    vector() {
      const directions = new Set(held.values());
      return { x: Number(directions.has('right')) - Number(directions.has('left')), y: Number(directions.has('down')) - Number(directions.has('up')) };
    },
  };
}

// Track the furthest excursion, not just the final point: an out-and-back swipe
// must never become a tap. Browser pointercancel also invalidates a gesture.
export function createTapGesture(threshold = 9) {
  let start: { id: number; x: number; y: number; moved: boolean } | null = null;
  return {
    begin(id: number, x: number, y: number) {
      if (start) { start.moved = true; return; }
      start = { id, x, y, moved: false };
    },
    move(id: number, x: number, y: number) {
      if (start && start.id === id && Math.hypot(x - start.x, y - start.y) > threshold) start.moved = true;
    },
    finish(id: number, x: number, y: number) {
      const previous = start;
      if (!previous || previous.id !== id) return false;
      start = null;
      return !previous.moved && Math.hypot(x - previous.x, y - previous.y) <= threshold;
    },
    cancel() { start = null; },
  };
}
