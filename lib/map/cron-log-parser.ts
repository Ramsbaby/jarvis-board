/**
 * 크론 로그 파서 SSoT.
 *
 * 왜 이 파일이 존재하는가:
 *   `~/.jarvis/logs/cron.log` 의 라인 형식 — `[YYYY-MM-DD HH:mm:ss] [task-id] message`
 *   — 를 파싱하는 코드가 briefing/route.ts, game/chat/route.ts, crons/route.ts,
 *   agent-live/route.ts, standup/briefing/route.ts 등 5군데에 중복되어 있었다.
 *   각자 조금씩 다르게 구현돼서 task_\d+_ 필터가 빠진 곳, 상태 분류 규칙이
 *   다른 곳 등이 생겼다. 이 파일 하나만 보면 된다.
 *
 * 규칙:
 *   - 새 라우트에서 cron.log 를 직접 split 하지 말 것.
 *   - 새 필드가 필요하면 여기에 추가하고 모든 caller 가 혜택받게 할 것.
 */

import { readFileSync } from 'fs';

/** cron.log 라인 형식 매처. */
export const CRON_LOG_LINE_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[([^\]]+)\] (.+)$/;

/**
 * `task_123_foo` 형태의 ad-hoc 임시 태스크 이름을 필터링하는 패턴.
 * 이런 태스크는 한 번만 실행되고 의미 있는 집계 대상이 아니다.
 */
export const SKIP_TASK_RE = /^task_\d+_/;

export type CronResult = 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'RUNNING' | 'DEFERRED' | 'unknown';

export interface CronLogEntry {
  /** 원본 타임스탬프 문자열 `YYYY-MM-DD HH:mm:ss` (KST) */
  time: string;
  /** 태스크 ID */
  task: string;
  /** 분류된 실행 결과 */
  result: CronResult;
  /** 원본 메시지 (첫 200자 이내로 절단) */
  message: string;
}

/**
 * 로그 라인 한 줄을 `CronLogEntry` 로 변환한다. 매치 실패 시 null.
 *
 * `task_\d+_` 임시 태스크는 여기서 null 반환 (caller 가 별도 필터할 필요 없음).
 */
export function parseCronLogLine(line: string): CronLogEntry | null {
  const m = line.match(CRON_LOG_LINE_RE);
  if (!m) return null;
  const [, time, task, message] = m;
  if (SKIP_TASK_RE.test(task)) return null;

  let result: CronResult = 'unknown';
  if (/\bDONE\b|\bSUCCESS\b/.test(line)) result = 'SUCCESS';
  else if (/FAILED|ERROR|CRITICAL/.test(line)) result = 'FAILED';
  else if (/\bSKIPPED\b/.test(line)) result = 'SKIPPED';
  else if (/\bSTARTED?\b|\bRUNNING\b/.test(line)) result = 'RUNNING';
  else if (/\bDEFERRED\b/.test(line)) result = 'DEFERRED';

  return { time, task, result, message: message.slice(0, 200) };
}

/**
 * cron.log raw 문자열을 받아 최근 N 줄을 파싱하고 키워드 필터를 적용한다.
 * 기존 각 라우트의 parseCronLog/parseRecent 와 동일한 동작.
 *
 * @param rawLog    readFileSync 결과 (string)
 * @param keywords  팀 키워드 (소문자 substring 매칭). 빈 배열 → 전체
 * @param opts.limit 반환할 엔트리 수 (기본 20, 최근부터 역순)
 * @param opts.scanLines 최근 N 줄만 스캔 (기본 3000) — 성능 보호
 * @param opts.includeUnknown 상태 미분류 엔트리 포함 여부 (기본 false)
 */
export function parseCronLog(
  rawLog: string,
  keywords: string[] = [],
  opts: { limit?: number; scanLines?: number; includeUnknown?: boolean } = {},
): CronLogEntry[] {
  if (!rawLog) return [];
  const { limit = 20, scanLines = 3000, includeUnknown = false } = opts;
  const lines = rawLog.split('\n').filter(Boolean).slice(-scanLines);

  const entries: CronLogEntry[] = [];
  for (const line of lines) {
    const entry = parseCronLogLine(line);
    if (!entry) continue;
    if (keywords.length > 0) {
      const lower = entry.task.toLowerCase();
      if (!keywords.some(kw => lower.includes(kw))) continue;
    }
    if (!includeUnknown && entry.result === 'unknown') continue;
    entries.push(entry);
  }

  // 최근부터 반환 (lines 는 시간 오름차순 → reverse 후 slice)
  return entries.reverse().slice(0, limit);
}

/**
 * 파일 경로를 받아 직접 읽고 파싱하는 편의 함수.
 * 파일이 없거나 읽기 실패 시 빈 배열.
 */
export function parseCronLogFile(
  filePath: string,
  keywords: string[] = [],
  opts?: Parameters<typeof parseCronLog>[2],
): CronLogEntry[] {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return parseCronLog(raw, keywords, opts);
  } catch {
    return [];
  }
}
