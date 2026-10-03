/**
 * openclaw-automations.ts — OpenClaw 자동화(스케줄러) 읽기 전용 어댑터
 *
 * 왜 이 파일이 존재하는가:
 *   2026-09-12 자비스가 OpenClaw로 이관되면서 스케줄러가 `~/.jarvis/config/effective-tasks.json`
 *   + `cron.log` 에서 OpenClaw automations 로 바뀌었다. 옛 파일은 09-13 이후 갱신되지 않아
 *   보드의 크론 센터·최근 실행·오늘 예정이 과거 상태를 보여 주고 있었다.
 *   이 모듈은 공개 CLI(`openclaw cron list --all --json`, `openclaw cron runs`)만 호출한다 —
 *   게이트웨이 내부 저장소(sqlite)를 직접 읽지 않으므로 OpenClaw 내부 스키마 변경에 안전하다.
 *
 * 규칙:
 *   - 읽기 전용. run/enable/disable 같은 쓰기 명령은 여기서 호출하지 않는다.
 *   - CLI 실패 시 마지막 성공 값을 돌려주고(stale=true), 그것도 없으면 null.
 */

import { execFile } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import type { CronItem, CronStatus } from '@/lib/map/rooms';
import { cronToHuman } from '@/lib/map/cron-human';

export const OPENCLAW_BIN = process.env.OPENCLAW_BIN || join(homedir(), 'bin', 'openclaw');

const LIST_TTL_MS = 30_000;
const CLI_TIMEOUT_MS = 20_000;
const MAX_BUFFER = 32 * 1024 * 1024;

export interface AutomationSchedule {
  kind: 'cron' | 'every' | 'at' | string;
  expr?: string;
  tz?: string;
  everyMs?: number;
  at?: string;
}

export interface AutomationState {
  lastRunAtMs?: number;
  lastRunStatus?: string;
  lastDurationMs?: number;
  lastDiagnosticSummary?: string;
  lastError?: string;
  consecutiveErrors?: number;
  nextRunAtMs?: number;
  runningAtMs?: number;
}

export interface AutomationJob {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
  status?: string;
  schedule: AutomationSchedule;
  payload?: { kind?: string };
  state?: AutomationState;
  lastRunAtMs?: number;
  lastRunStatus?: string;
  nextRunAtMs?: number;
}

export interface AutomationRun {
  ts: number;
  jobId: string;
  jobName?: string;
  status?: string;
  summary?: string;
  error?: string;
  runAtMs?: number;
  durationMs?: number;
}

function runCli(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      OPENCLAW_BIN,
      args,
      // ~/bin/openclaw shim 은 env -i 로 자체 격리하지만, 보드 프로세스의 비밀값이 자식에게 새지 않도록 최소 env 만 넘긴다.
      {
        timeout: CLI_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        encoding: 'utf8',
        env: { HOME: homedir(), PATH: '/usr/bin:/bin' } as unknown as NodeJS.ProcessEnv,
      },
      (err: Error | null, stdout: string) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

let listCache: { jobs: AutomationJob[]; ts: number } | null = null;
let listInflight: Promise<AutomationJob[] | null> | null = null;

/** 전체 자동화 목록(비활성 포함). 30초 캐시. 실패 시 마지막 성공 값, 없으면 null. */
export async function listAutomations(): Promise<AutomationJob[] | null> {
  if (listCache && Date.now() - listCache.ts < LIST_TTL_MS) return listCache.jobs;
  if (listInflight) return listInflight;
  listInflight = (async () => {
    try {
      const out = await runCli(['cron', 'list', '--all', '--json']);
      const parsed = JSON.parse(out) as { jobs?: AutomationJob[] };
      const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
      listCache = { jobs, ts: Date.now() };
      return jobs;
    } catch (err) {
      console.error('[openclaw-automations] cron list failed:', err instanceof Error ? err.message : err);
      return listCache?.jobs ?? null;
    } finally {
      listInflight = null;
    }
  })();
  return listInflight;
}

/** 한 자동화의 최근 실행 이력 (최신순). 실패 시 null. */
export async function listAutomationRuns(jobId: string, limit = 10): Promise<AutomationRun[] | null> {
  if (!/^[A-Za-z0-9-]{1,80}$/.test(jobId)) return null;
  try {
    const out = await runCli(['cron', 'runs', '--id', jobId, '--limit', String(limit), '--sort', 'desc']);
    const parsed = JSON.parse(out) as { entries?: AutomationRun[] };
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch (err) {
    console.error('[openclaw-automations] cron runs failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** 이름(보드에서 쓰는 id) 또는 OpenClaw job id 로 자동화를 찾는다. */
export async function findAutomation(idOrName: string): Promise<AutomationJob | null> {
  const jobs = await listAutomations();
  if (!jobs) return null;
  return jobs.find(j => j.name === idOrName || j.id === idOrName) ?? null;
}

// ── 변환 헬퍼 ─────────────────────────────────────────────────────

export function lastRunAtMs(j: AutomationJob): number | undefined {
  return j.state?.lastRunAtMs ?? j.lastRunAtMs;
}

export function nextRunAtMs(j: AutomationJob): number | undefined {
  return j.state?.nextRunAtMs ?? j.nextRunAtMs;
}

export function runStatus(j: AutomationJob): CronStatus {
  if (j.state?.runningAtMs) return 'running';
  const s = j.state?.lastRunStatus ?? j.lastRunStatus;
  if (s === 'ok') return 'success';
  if (s === 'error') return 'failed';
  if (s === 'skipped') return 'skipped';
  return 'unknown';
}

export function runStatusFromString(s?: string): CronStatus {
  if (s === 'ok') return 'success';
  if (s === 'error') return 'failed';
  if (s === 'skipped') return 'skipped';
  return 'unknown';
}

/** "YYYY-MM-DD HH:mm:ss" (KST) — 보드 UI 의 timeAgo/fmtTime 이 기대하는 형식 */
export function toKstString(ms: number): string {
  const kst = new Date(ms + 9 * 3600_000);
  return kst.toISOString().replace('T', ' ').slice(0, 19);
}

export function scheduleString(s: AutomationSchedule): string {
  if (s.kind === 'cron' && s.expr) return s.expr;
  if (s.kind === 'every' && s.everyMs) {
    const min = Math.round(s.everyMs / 60_000);
    return min >= 60 && min % 60 === 0 ? `every ${min / 60}h` : `every ${min}m`;
  }
  if (s.kind === 'at' && s.at) return `at ${s.at}`;
  return s.kind || '';
}

export function scheduleHuman(s: AutomationSchedule): string {
  if (s.kind === 'cron' && s.expr) return cronToHuman(s.expr);
  if (s.kind === 'every' && s.everyMs) {
    const min = Math.round(s.everyMs / 60_000);
    return min >= 60 && min % 60 === 0 ? `${min / 60}시간마다` : `${min}분마다`;
  }
  if (s.kind === 'at' && s.at) return `1회 (${s.at.slice(0, 16).replace('T', ' ')})`;
  return '';
}

export function lastMessage(j: AutomationJob): string {
  return (j.state?.lastError || j.state?.lastDiagnosticSummary || '').slice(0, 600);
}

/** OpenClaw 자동화 → 보드 크론 센터 카드(CronItem). id 는 사람이 읽는 job 이름. */
export function toCronItem(j: AutomationJob, team: { label: string; emoji: string }): CronItem {
  const last = lastRunAtMs(j);
  const next = nextRunAtMs(j);
  const status = runStatus(j);
  const dur = j.state?.lastDurationMs;
  const msg = lastMessage(j);
  return {
    id: j.name,
    name: j.displayName || j.name,
    description: (j.description || '').slice(0, 500),
    schedule: scheduleString(j.schedule),
    scheduleHuman: scheduleHuman(j.schedule),
    status,
    lastRun: last ? toKstString(last) : null,
    lastResult: status === 'unknown' ? '' : status,
    lastMessage: msg,
    lastDuration: typeof dur === 'number' ? `${Math.max(0, Math.round(dur / 1000))}s` : '',
    outputSummary: msg.slice(0, 300),
    nextRun: j.enabled && next ? toKstString(next) : null,
    team: team.label,
    teamEmoji: team.emoji,
    priority: 'normal',
    hasLLM: j.payload?.kind === 'agentTurn',
    hasScript: j.payload?.kind === 'command',
    disabled: !j.enabled,
    recentRuns: last && status !== 'unknown'
      ? [{ status, timestamp: toKstString(last), message: msg.slice(0, 200) }]
      : [],
  };
}
