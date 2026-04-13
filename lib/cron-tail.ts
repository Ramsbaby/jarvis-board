/**
 * cron-tail.ts — ~/.jarvis/logs/cron.log을 주기 polling 하여
 * 새 START/SUCCESS/FAILED 라인을 감지하고 SSE broadcast.
 *
 * 서버 부트 시 1회 ensureCronTailRunning() 호출 (singleton via globalThis).
 */

import { statSync, openSync, readSync, closeSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { broadcastEvent } from './sse';

const CRON_LOG = join(homedir(), '.jarvis', 'logs', 'cron.log');
const POLL_MS = 5_000;
const MAX_READ_BYTES = 64 * 1024; // 1회당 최대 64KB

declare global {
  var __cronTailTimer: ReturnType<typeof setInterval> | undefined;
  var __cronTailOffset: number | undefined;
}

type CronEvent = {
  type: 'cron_start' | 'cron_success' | 'cron_failed';
  cronId: string;
  cronName: string;
  timestamp: string;
  message: string;
};

// `[2026-04-13 09:35:03] [calendar-alert] START/SUCCESS/FAILED ...`
const LINE_RE = /^\[([\d-]+ [\d:]+)\] \[([^\]]+)\] (START|SUCCESS|FAILED)(?:\b|\s|$)(.*)$/;

function parseLine(line: string): CronEvent | null {
  const m = LINE_RE.exec(line);
  if (!m) return null;
  const [, ts, cronId, state, rest] = m;
  const typeMap = {
    START: 'cron_start',
    SUCCESS: 'cron_success',
    FAILED: 'cron_failed',
  } as const;
  return {
    type: typeMap[state as keyof typeof typeMap],
    cronId,
    cronName: cronId,
    timestamp: ts,
    message: rest.trim().slice(0, 200),
  };
}

function tickOnce() {
  let size: number;
  try {
    size = statSync(CRON_LOG).size;
  } catch {
    return; // 파일 없으면 skip
  }
  const prevOffset = globalThis.__cronTailOffset ?? size;
  // 파일이 rotate 되어 작아졌으면 끝에서 다시 시작
  let offset = prevOffset > size ? size : prevOffset;
  if (offset === size) {
    globalThis.__cronTailOffset = size;
    return;
  }

  const toRead = Math.min(size - offset, MAX_READ_BYTES);
  const buf = Buffer.alloc(toRead);
  let fd: number | null = null;
  try {
    fd = openSync(CRON_LOG, 'r');
    readSync(fd, buf, 0, toRead, offset);
  } catch {
    return;
  } finally {
    if (fd !== null) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }

  const text = buf.toString('utf8');
  const lastNl = text.lastIndexOf('\n');
  if (lastNl === -1) {
    // 한 줄이 너무 크거나 미완성 — 다음 턴에 재시도
    return;
  }
  const usable = text.slice(0, lastNl);
  offset += Buffer.byteLength(usable, 'utf8') + 1;
  globalThis.__cronTailOffset = offset;

  for (const line of usable.split('\n')) {
    const ev = parseLine(line);
    if (ev) {
      try { broadcastEvent(ev); } catch { /* ignore */ }
    }
  }
}

export function ensureCronTailRunning() {
  if (globalThis.__cronTailTimer) return;
  // 최초 실행 시: 파일 끝에서 시작 (과거 라인 flood 방지)
  if (globalThis.__cronTailOffset === undefined) {
    try {
      globalThis.__cronTailOffset = statSync(CRON_LOG).size;
    } catch {
      globalThis.__cronTailOffset = 0;
    }
  }
  globalThis.__cronTailTimer = setInterval(tickOnce, POLL_MS);
  // Next 핫리로드/shutdown 시 타이머 누수 방지
  if (typeof process !== 'undefined' && process.once) {
    process.once('beforeExit', () => {
      if (globalThis.__cronTailTimer) {
        clearInterval(globalThis.__cronTailTimer);
        globalThis.__cronTailTimer = undefined;
      }
    });
  }
}
