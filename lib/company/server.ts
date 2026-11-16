import { DEV_TASK_RUNNER_JOB } from '../dev-queue';
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readJsonSource, sourcePaths, processIdentity, type OpenclawSnapshot } from '../command-room/server';
import type { CommandRoomSnapshot, JsonRecord, ProcessObservation } from '../command-room/types';
import { safeText, entries } from '../command-room/derive';
import { automationTasks, developmentTasks, stationTasks, qaTasks } from './derive';
import { attachReviews } from './reviews';
import { readCodex } from './codex';
import { readWorkReports } from './work-reports';
import { reconcileCompany } from './journal';
import { ownerPendingTasks } from './owner-pending';
import { readFile } from 'node:fs/promises';
import type { CompanySnapshot } from './types';
export async function loadCompany(base: CommandRoomSnapshot, source: OpenclawSnapshot): Promise<CompanySnapshot> {
  const now = Date.now(), observed = new Date(now).toISOString();
  const coverage: CompanySnapshot['coverage'] = [{ source: 'OpenClaw 자동화', status: source.freshness !== 'fresh' ? 'unavailable' : source.hasMore ? 'partial' : 'connected', detail: source.hasMore ? '목록 일부 조회 · 전체라고 집계하지 않음' : source.freshness === 'fresh' ? '예약별 최신 기록 연결 · 모든 과거 회차를 수집한 것은 아님' : '현재 조회 불가 · 과거 기록 보존' }];
  let development: JsonRecord[] = [];
  try {
    const db = new Database(process.env.JARVIS_OFFICE_SOURCE_DB || join(process.cwd(), 'data/board.db'), { readonly: true, fileMustExist: true });
    try {
      development = db.prepare('SELECT id,title,detail,status,priority,assignee,result_summary,created_at,started_at,completed_at FROM dev_tasks ORDER BY created_at DESC LIMIT 1001').all() as JsonRecord[];
      coverage.push({ source: '개발 업무', status: development.length > 1000 ? 'partial' : 'connected', detail: development.length > 1000 ? '최근 1,000개만 연결' : '원장 읽기 전용 연결 · 실행 생존 별도 확인' });
      development = development.slice(0, 1000);
    } finally { db.close(); }
  } catch { coverage.push({ source: '개발 업무', status: 'unavailable', detail: '원장 조회 실패 · 업무 없음으로 취급하지 않음' }); }
  const work = await readJsonSource(sourcePaths().work, 'work', '현재 작업 보고', now / 1000);
  coverage.push({ source: '현재 작업·QA·비서', status: base.stations.filter(s => s.id !== 'codex').some(s => s.status === 'unknown') ? 'partial' : 'connected', detail: '연결된 보고만 표시 · 다른 대화의 미등록 업무는 포함하지 못함' });
  const codex = readCodex(process.env.JARVIS_CODEX_HOME || join(homedir(), '.codex'), now);
  coverage.push(codex.coverage);
  const qa = await readJsonSource(join(sourcePaths().qa, 'state.json'), 'qa-state', 'QA 개별 실행 원장', now / 1000);
  const jobs = entries(qa.value?.jobs), processes: Record<string, ProcessObservation> = {};
  await Promise.all(jobs.filter(([,j]) => String(j.state).startsWith('running')).slice(0,8).map(async ([id,j]) => { processes[id] = await processIdentity(j.pid, j.process_identity); }));
  const individualQa = qaTasks(jobs, processes, qa.source.freshness === 'fresh', qa.source.observedAt);
  const summaries = stationTasks(base.stations, safeText(work.value?.id, 'unregistered', 100)).map(t => {
    if (t.id !== 'workflow:qa' || !individualQa.length) return t;
    // The area summary and its failed execution are one problem, not two.
    const { issue, ...rest } = t;
    return { ...rest, kind: 'overview' as const, ...(issue && !individualQa.some(j => j.issue) ? { issue } : {}) };
  });
  coverage.push({ source: 'QA 개별 실행', status: !qa.value ? 'unavailable' : qa.source.freshness !== 'fresh' ? 'partial' : 'connected', detail: '최근 최대 80개 실행 기록 · 진행 프로세스 최대 8개 정체성 확인 · 영역 요약은 중복 집계 제외' });
  const parallel = await readWorkReports(process.env.JARVIS_WORK_REPORTS_DIR || join(homedir(), '.openclaw/workspace/state/command-room/work-reports'), now);
  coverage.push(parallel.coverage);
  let ownerPending: CompanySnapshot['tasks'] = [];
  try {
    ownerPending = ownerPendingTasks(await readFile(process.env.JARVIS_OWNER_PENDING_FILE || join(homedir(), '.openclaw/workspace/state/duty/orders.md'), 'utf8'), observed);
    coverage.push({ source: '주인님 답 대기 항목', status: 'connected', detail: '당직 지시함의 답 대기 표시만 연결 · 대화에서만 나온 결정 거리는 포함하지 못함' });
  } catch { coverage.push({ source: '주인님 답 대기 항목', status: 'unavailable', detail: '지시함 조회 실패 · 결정할 일이 없다는 뜻이 아님' }); }
  const observedTasks = [
    ...ownerPending, ...summaries, ...individualQa, ...parallel.tasks, ...codex.tasks,
    ...automationTasks(source.jobs ?? [], source.freshness === 'fresh', source.observedAt, now),
    ...developmentTasks(development, observed, source.freshness === 'fresh' && !source.hasMore ? (source.jobs ?? []).some(j => { const row = j as JsonRecord; return row.name === DEV_TASK_RUNNER_JOB && row.enabled === true; }) : null),
  ];
  const tasks = [...new Map(observedTasks.sort((a,b) => Date.parse(a.observedAt || '') - Date.parse(b.observedAt || '')).map(t => [t.id,t])).values()];
  try {
    const data = reconcileCompany(process.env.JARVIS_OFFICE_JOURNAL || join(homedir(), '.openclaw-data/runtime/office/inbox.sqlite'), tasks, observed);
    try { return attachReviews(process.env.JARVIS_OFFICE_JOURNAL || join(homedir(), '.openclaw-data/runtime/office/inbox.sqlite'), { ...data, coverage }); }
    catch { return { ...data, coverage: [...coverage, { source: '자비스 보고 내용 검토', status: 'unavailable', detail: '검토 원장 조회 실패 · 접수와 업무 기록은 보존' }] }; }
  } catch {
    coverage.push({ source: '보고 접수 원장', status: 'unavailable', detail: '접수 저장 실패 · 직원의 새 보고 연출 중단' });
    return { tasks, issues: tasks.filter(t => t.issue).map(t => ({ id: `issue:${t.id}`, taskId: t.id, ownerId: t.ownerId, title: t.issue!, state: 'open', impact: '영향 미확인', next: t.next, firstSeenAt: observed, lastSeenAt: observed, recoveredAt: null })), reports: [], coverage, receiptAvailable: false };
  }
}
