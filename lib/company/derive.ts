import { classifyCronTeam } from '../cron-team';
import { inferCronRole } from '../map/cron-role';
import { record, safeText } from '../command-room/derive';
import type { Station, JsonRecord, ProcessObservation } from '../command-room/types';
import type { CompanyTask } from './types';
const displayOwner = (id: string | null) => id === 'president' || id === 'standup' ? 'secretary' : id === 'dev-queue' ? 'work' : id ?? 'codex';
const dateText = (value: unknown): string | null => { if (typeof value !== 'string' || !value) return null; const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:/.test(value) ? value.replace(' ', 'T') + 'Z' : value; return Number.isFinite(Date.parse(normalized)) ? new Date(normalized).toISOString() : null; };
const stamp = (ms: unknown) => typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
export function automationTasks(jobs: unknown[], fresh: boolean, observedAt: string | null, now: number): CompanyTask[] {
  return jobs.map(record).filter(j => typeof j.id === 'string' && typeof j.name === 'string').map(j => {
    const s = record(j.state), running = Number(s.runningAtMs || 0), last = Number(s.lastRunAtMs || j.lastRunAtMs || 0);
    const validRunning = running > 0 && running <= now && running > last;
    const failed = ['error', 'failed'].includes(String(s.lastRunStatus ?? j.lastRunStatus));
    const title = safeText(j.displayName || inferCronRole(String(j.name).replace(/^(jarvis|openclaw)-/, '')) || j.name);
    const state = !fresh ? 'unknown' : validRunning ? now - running <= 15 * 60_000 ? 'reported' : 'unknown' : running > now ? 'unknown' : failed ? 'blocked' : j.enabled ? 'scheduled' : 'waiting';
    return { id: `automation:${j.id}`, title, kind: 'automation', ownerId: displayOwner(classifyCronTeam(String(j.name)).id), state, automationEnabled:j.enabled===true,
      summary: validRunning ? '스케줄러 실행 시작 보고' : failed ? '마지막 회차 실패 기록 · 현재 영향 확인 필요' : last ? '이전 회차 기록 있음 · 현재 실행으로 세지 않음' : '예약 설정만 확인됨',
      next: state === 'unknown' ? '최신 실행·종료 기록 재확인' : failed ? '담당자가 실패 원인과 영향 확인' : validRunning ? '회차 결과와 완료 근거 확인' : j.enabled ? '다음 예정 회차 대기' : '비활성 예약 · 재개 지시 대기',
      source: 'OpenClaw 예약 원본', observedAt, eventAt: stamp(validRunning ? running : last),
      evidence: validRunning ? '시작 보고이며 프로세스 생존 검증이 아닙니다.' : '이 자동화의 마지막 회차 결과입니다. 다른 업무의 성공으로 문제를 닫지 않습니다.',
      priority: failed ? 2 : 1,
      ...(failed ? { issue: '마지막 실행 실패 · 미해결 여부 확인 필요' } : {}),
      ...(!validRunning && ['ok', 'success'].includes(String(s.lastRunStatus ?? j.lastRunStatus)) && last > 0 ? { result: '동일 자동화의 후속 성공 기록 · 근본 원인 해결은 별도 확인' } : {}),
    };
  });
}
export function developmentTasks(rows: JsonRecord[], observedAt: string, queueActive: boolean | null = true): CompanyTask[] {
  return rows.map(r => {
    const started = Date.parse(dateText(r.started_at) ?? ''), observed = Date.parse(observedAt);
    const recentStart = Number.isFinite(started) && observed >= started && observed - started <= 15 * 60_000;
    const archived = queueActive !== true && ['awaiting_approval', 'approved', 'in-progress'].includes(String(r.status));
    const state = archived ? 'waiting' : r.status === 'awaiting_approval' ? 'decision' : r.status === 'in-progress' ? recentStart ? 'reported' : 'unknown' : r.status === 'done' ? 'completed' : r.status === 'approved' ? 'waiting' : 'unknown';
    return { id: `development:${r.id}`, title: safeText(r.title), kind: 'development', ownerId: 'work', state, archived,
      summary: safeText(r.result_summary || r.detail, '개발 업무 등록 기록', 260),
      next: archived ? '개발 큐 비활성 또는 조회 불가 · 보관 기록이며 현재 승인 요청이 아닙니다.' : state === 'decision' ? '원장 승인 요청의 현재 유효성·범위·기대 효과를 재확인한 뒤 결정' : state === 'completed' ? '결과 요약과 실제 산출물 검증' : '담당자의 최신 진행 및 다음 행동 확인',
      source: '개발 업무 원장', observedAt, eventAt: dateText(r.completed_at || r.started_at || r.created_at),
      evidence: `원장의 ${safeText(r.status)} 상태 · 실행 생존과 결과 품질은 별도 확인`,
      href: `/dev-tasks/${encodeURIComponent(String(r.id))}`, priority: r.priority === 'urgent' ? 3 : r.priority === 'high' ? 2 : 1,
      ...(state === 'completed' && r.result_summary ? { result: safeText(r.result_summary) } : {}),
    };
  });
}
export function stationTasks(stations: Station[], currentId: string): CompanyTask[] {
  // Scheduler is represented by individual jobs, never also counted as a problem/task aggregate.
  return stations.filter(s => s.id !== 'codex' && s.id !== 'openclaw').map(s => ({
    id: s.id === 'work' ? `work:${currentId}` : `workflow:${s.id}`, title: s.title, kind: 'work', ownerId: s.id,
    state: s.status === 'running' ? 'running' : s.status === 'unknown' ? 'unknown' : s.status === 'attention' ? 'blocked' : s.statusLabel.includes('완료') ? 'completed' : s.statusLabel.includes('진행 보고') ? 'reported' : 'waiting',
    summary: s.current, next: s.nextAction, source: s.sources.map(o => o.label).join(' · '), observedAt: s.observedAt, eventAt: s.observedAt,
    evidence: s.reason, priority: s.status === 'attention' ? 2 : 1,
    ...(s.status === 'attention' ? { issue: s.current } : {}),
    ...(s.statusLabel.includes('완료') && s.evidence.length ? { result: s.evidence[0].detail } : {}),
  }));
}

export function qaTasks(jobs: [string, JsonRecord][], processes: Record<string, ProcessObservation>, fresh: boolean, observedAt: string | null): CompanyTask[] {
  return jobs.map(([id,j]) => {
    const active = String(j.state).startsWith('running');
    const verified = active && processes[id]?.live && processes[id]?.identityMatched;
    const failed = j.state === 'needs_review';
    const passed = j.state === 'passed_local';
    const state = verified ? 'running' : active || !fresh ? 'unknown' : failed ? 'blocked' : passed ? 'completed' : 'waiting';
    return { id: `qa:${id}`, parentId: 'workflow:qa', kind: 'work', ownerId: 'qa', title: safeText(id), state,
      summary: failed ? '검사 실패 · 책임자 판정 대기' : passed ? '해당 검사 실행 성공 기록 · 제품 전체 검증 완료가 아님' : verified ? 'PID와 시작 정체성이 일치하는 검사 실행' : active ? '실행 기록은 있으나 현재 프로세스 확인 불가' : safeText(j.state),
      next: failed ? '검사 원인·후속 조치를 판정하고 기록' : passed ? '검사 증거와 원본 범위 대조' : '해당 작업의 최신 실행·종료 기록 확인',
      source: 'QA 개별 실행 원장', observedAt, eventAt: stamp(Number(j.ended_at_epoch || j.started_at_epoch || 0) * 1000), priority: failed ? 2 : 1,
      evidence: verified ? '현재 프로세스 정체성 확인. 실행 성공·품질 검증과 구분.' : '개별 검사 상태. 완료와 실패는 해당 실행 범위에만 적용.',
      ...(failed ? { issue: '검사 실패 · 원인과 후속 조치 미판정' } : {}),
      ...(passed ? { result: '로컬 검사 실행 성공 · 산출물 품질과 원본 전수 검증은 별도' } : {}),
    };
  });
}
