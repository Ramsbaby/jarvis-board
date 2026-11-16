import { deriveEmployees } from './employees';
import { open, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { deriveCodex, deriveCurrentWork, deriveQa, deriveSecretary, entries, record, safeText } from './derive';
import type { CommandRoomSnapshot, InputSource, JsonRecord, ProcessObservation, Station } from './types';

const MAX_BYTES = 256 * 1024;
export function sourcePaths(env: NodeJS.ProcessEnv = process.env) {
  const home = homedir();
  return {
    qa: env.JARVIS_QA_DIR || join(home, '.openclaw-data/runtime/work/gostop-resume-20261108/functional/token-efficient-qa'),
    codex: env.JARVIS_CODEX_AUTOMATIONS_DIR || join(home, '.codex/automations'),
    secretary: env.JARVIS_SECRETARY_DIR || join(home, '.openclaw/workspace/state/secretary/briefings'),
    work: env.JARVIS_CURRENT_WORK_FILE || join(home, '.openclaw/workspace/state/command-room/current-work.json'),
  };
}
async function boundedText(path: string, maxBytes = MAX_BYTES): Promise<{ text: string; modifiedAt: number }> {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw new Error('invalid_source');
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes + 1, 0);
    if (bytesRead > maxBytes) throw new Error('invalid_source');
    return { text: buffer.subarray(0, bytesRead).toString('utf8'), modifiedAt: stat.mtimeMs };
  } finally { await handle.close(); }
}
export async function readJsonSource(path: string, id: string, label: string, now: number, ttl = 900): Promise<InputSource> {
  try {
    const { text, modifiedAt } = await boundedText(path, id === 'work' ? 64 * 1024 : id === 'qa-state' ? 2 * 1024 * 1024 : MAX_BYTES);
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_source');
    const timestamp = typeof value.checked_at === 'string' ? Date.parse(value.checked_at)
      : typeof value.observedAt === 'string' ? Date.parse(value.observedAt)
      : id === 'qa-state' && typeof record(value.usage).observed_at_epoch === 'number' ? Number(record(value.usage).observed_at_epoch) * 1000 : modifiedAt;
    return { value, source: { id, label, observedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
      freshness: Number.isFinite(timestamp) && now * 1000 >= timestamp && now * 1000 - timestamp <= ttl * 1000 ? 'fresh' : 'stale',
      detail: '원본 관측 시각 · 파일 갱신만으로 worker 생존을 판단하지 않음' } };
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    return { value: null, source: { id, label, freshness: missing ? 'missing' : 'error', observedAt: null,
      detail: missing ? '소스 파일 없음' : '원본 읽기/형식 오류 · 내용을 추정하지 않음' } };
  }
}
export function parseAutomationConfig(text: string): JsonRecord {
  const result: JsonRecord = {};
  let multiline: string | null = null;
  for (const line of text.split('\n')) {
    if (multiline) { if (line.includes(multiline)) multiline = null; continue; }
    const quoted = line.match(/=\s*("""|''')/);
    if (quoted) { if (!line.slice((quoted.index ?? 0) + quoted[0].length).includes(quoted[1])) multiline = quoted[1]; continue; }
    const match = line.match(/^(id|name|status|rrule|updated_at)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    try { result[match[1]] = JSON.parse(match[2]); } catch { throw new Error('invalid_config'); }
  }
  if (typeof result.id !== 'string' || typeof result.status !== 'string') throw new Error('invalid_config');
  return result;
}
async function readCodex(path: string, now: number): Promise<InputSource> {
  try {
    const dirs = (await readdir(path, { withFileTypes: true })).filter(d => d.isDirectory()).slice(0, 32);
    const jobs = await Promise.all(dirs.map(async d => parseAutomationConfig((await boundedText(join(path, d.name, 'automation.toml'), 64 * 1024)).text)));
    return { value: { jobs }, source: { id: 'codex', label: 'Codex 실제 예약 설정', observedAt: new Date(now * 1000).toISOString(), freshness: 'fresh', detail: '설정만 확인 · 실제 회차 실행/전달은 별도 증거 필요' } };
  } catch { return { value: null, source: { id: 'codex', label: 'Codex 예약 설정', observedAt: null, freshness: 'error', detail: '예약 설정 읽기 실패' } }; }
}
async function readSecretary(path: string, now: number): Promise<InputSource> {
  try {
    const names = (await readdir(path)).filter(n => /^\d{4}-\d{2}-\d{2}-sources\.json$/.test(n)).sort();
    const latest = names.at(-1);
    return readJsonSource(join(path, latest ?? 'missing-sources.json'), 'secretary', '비서 브리핑 원본 요약', now, 24 * 3600);
  } catch { return readJsonSource(join(path, 'missing-sources.json'), 'secretary', '비서 브리핑 원본 요약', now); }
}
export function processIdentity(pid: unknown, expected: unknown): Promise<ProcessObservation> {
  if (!Number.isInteger(pid) || Number(pid) <= 1 || typeof expected !== 'string' || !expected) return Promise.resolve({ live: false, identityMatched: false });
  return new Promise(resolve => {
    execFile('/bin/ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'stat='], { timeout: 1200, maxBuffer: 4096 }, (error, stdout) => {
      const line = stdout.trim();
      const matched = line.startsWith(expected) && !/\bZ/.test(line.slice(expected.length));
      resolve({ live: !error && !!line, identityMatched: !error && matched });
    });
  });
}
export interface OpenclawSnapshot { jobs: unknown[] | null; total?: number; hasMore?: boolean; freshness: 'fresh' | 'stale' | 'error'; observedAt: string | null }
export async function buildCommandRoom(openclaw: () => Promise<OpenclawSnapshot>, paths = sourcePaths(), now = Date.now() / 1000): Promise<CommandRoomSnapshot> {
  const [state, checkpoint, policy, codex, secretary, work, automations] = await Promise.all([
    readJsonSource(join(paths.qa, 'state.json'), 'qa-state', 'QA 실행/소유권 원본', now),
    readJsonSource(join(paths.qa, 'checkpoint.json'), 'qa-checkpoint', 'QA 다음 행동 체크포인트', now, 24 * 3600),
    readJsonSource(join(paths.qa, 'policy.json'), 'qa-policy', 'QA 예산·원본 범위 정책', now, 365 * 24 * 3600),
    readCodex(paths.codex, now), readSecretary(paths.secretary, now),
    readJsonSource(paths.work, 'work', '책임자의 현재 작업 보고', now),
    openclaw().catch(() => ({ jobs: null, freshness: 'error' as const, observedAt: null })),
  ]);
  const processes: Record<string, ProcessObservation> = {};
  await Promise.all(entries(state.value?.jobs).filter(([, job]) => String(job.state).startsWith('running')).slice(0, 8).map(async ([id, job]) => { processes[id] = await processIdentity(job.pid, job.process_identity); }));
  const scheduler = deriveCodex(codex);
  scheduler.title = '자동화 관제실'; scheduler.subtitle = 'Codex · OpenClaw';
  scheduler.sources.push({ id: 'openclaw', label: 'OpenClaw 실제 자동화 목록', freshness: automations.freshness, observedAt: automations.observedAt, detail: automations.freshness === 'stale' ? '조회 실패 · 마지막 성공값' : automations.freshness === 'error' ? '조회 실패 · 확인된 목록 없음' : '읽기 전용 CLI 조회 · 실행 생존 별도 확인' });
  if (automations.jobs) {
    const jobs = automations.jobs.map(record);
    const total = typeof automations.total === 'number' ? automations.total : jobs.length;
    scheduler.facts.push({ label: 'OpenClaw 등록', value: `${total}개${automations.hasMore ? ' · 일부 조회' : ''} · ${automations.freshness === 'fresh' ? '목록 확인' : '과거 캐시'}` });
    const failed = jobs.filter(j => record(j.state).lastRunStatus === 'error');
    if (failed.length) {
      scheduler.status = 'attention'; scheduler.statusLabel = `예약 중 · 최근 실패 ${failed.length}건`;
      scheduler.reason += ' OpenClaw 마지막 실행에 실패 기록이 있습니다.';
    }
    for (const job of failed.slice(0, 3)) scheduler.evidence.push({ label: safeText(job.displayName ?? job.name), detail: '마지막 실행 실패 기록 · 원인 원본 확인 필요', at: null });
  } else { scheduler.reason += ' OpenClaw 목록 조회에 실패했습니다.'; scheduler.status = 'unknown'; }
  const stations: Station[] = [deriveCurrentWork(work, now), deriveQa(state, checkpoint, policy, processes, now), scheduler, deriveSecretary(secretary)];
  return { generatedAt: new Date(now * 1000).toISOString(), stations, employees: deriveEmployees(stations, automations, now * 1000) };
}
// The authorization boundary comes before all filesystem/CLI reads.
export async function loadForOwner(isOwner: boolean, load: () => Promise<CommandRoomSnapshot>): Promise<CommandRoomSnapshot | null> {
  return isOwner ? load() : null;
}
