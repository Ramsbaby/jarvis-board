/**
 * dev-queue.ts — 개발 태스크 큐가 지금 실제로 돌고 있는지 판단
 *
 * dev_tasks 의 '검토 요청됨(awaiting_approval)' 항목은 OpenClaw 자동화
 * `jarvis-dev-task-runner` 가 승인 건을 집어 가야 의미가 있다. 이 러너는 2026-09-10 부터 꺼져 있어,
 * 보드에서 '승인하고 작업 시작'을 눌러도 아무 일도 일어나지 않는다.
 * 러너가 켜져 있는지(=큐가 살아 있는지)는 OpenClaw 에서 직접 읽는다 — 다시 켜면 보드도 자동으로 돌아온다.
 */

import { listAutomations, lastRunAtMs, toKstString } from '@/lib/openclaw-automations';

export const DEV_TASK_RUNNER_JOB = process.env.DEV_TASK_RUNNER_JOB || 'jarvis-dev-task-runner';

export interface DevQueueState {
  /** 러너가 켜져 있음이 확인됐을 때만 true */
  active: boolean;
  runner: string;
  /** enabled: 켜짐 · disabled: 꺼짐 · missing: 자동화 없음 · unknown: OpenClaw 조회 실패 */
  reason: 'enabled' | 'disabled' | 'missing' | 'unknown';
  /** 러너 마지막 실행 (KST "YYYY-MM-DD HH:mm:ss") */
  lastRunAt: string | null;
}

export async function getDevQueueState(): Promise<DevQueueState> {
  const jobs = await listAutomations();
  if (!jobs) return { active: false, runner: DEV_TASK_RUNNER_JOB, reason: 'unknown', lastRunAt: null };
  const job = jobs.find(j => j.name === DEV_TASK_RUNNER_JOB);
  if (!job) return { active: false, runner: DEV_TASK_RUNNER_JOB, reason: 'missing', lastRunAt: null };
  const last = lastRunAtMs(job);
  return {
    active: job.enabled,
    runner: DEV_TASK_RUNNER_JOB,
    reason: job.enabled ? 'enabled' : 'disabled',
    lastRunAt: last ? toKstString(last) : null,
  };
}
