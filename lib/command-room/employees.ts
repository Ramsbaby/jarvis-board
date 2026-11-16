import { inferCronRole } from '../map/cron-role';
import { TEAM_REGISTRY } from '../map/team-registry';
import { classifyCronTeam } from '../cron-team';
import { record, safeText } from './derive';
import type { Station } from './types';

export interface OfficeEmployee {
  id: string; name: string; department: string; role: string;
  mode: 'working' | 'reported' | 'waiting' | 'attention' | 'unknown';
  status: string; task: string; next: string; observedAt: string | null;
  activity?: string; hasActiveWork?: boolean; evidence: string; stationId?: Station['id'];
}
export function deriveEmployees(stations: Station[], snapshot: { jobs: unknown[] | null; freshness: string; observedAt: string | null }, now: number): OfficeEmployee[] {
  const staff: OfficeEmployee[] = stations.map(s => ({
    id: s.id, name: ({ work: 'JARVIS', qa: 'QA 담당', secretary: '비서 담당', codex: '예약 감독', openclaw: '자동화 담당' })[s.id],
    department: ({ work: '작업 스튜디오', qa: '검증 연구실', secretary: '비서실', codex: '자동화 관제실', openclaw: '자동화 관제실' })[s.id],
    role: s.subtitle, mode: s.status === 'running' ? 'working' : s.status === 'attention' ? 'attention' : s.status === 'unknown' ? 'unknown' : s.statusLabel.includes('진행 보고') ? 'reported' : 'waiting',
    status: s.statusLabel, task: s.current, next: s.nextAction, observedAt: s.observedAt, evidence: s.reason, stationId: s.id,
  }));
  const jobs = (snapshot.jobs ?? []).map(record);
  for (const team of Object.values(TEAM_REGISTRY).filter(t => t.type === 'team-lead' && !['president', 'standup', 'secretary'].includes(t.id))) {
    const assigned = jobs.filter(j => classifyCronTeam(String(j.name ?? '')).id === team.id);
    const latest = [...assigned].sort((a, b) => Number(record(b.state).lastRunAtMs ?? 0) - Number(record(a.state).lastRunAtMs ?? 0))[0];
    const active = assigned.find(j => {
      const at = Number(record(j.state).runningAtMs);
      return j.enabled === true && at > 0 && now >= at && now - at < 15 * 60_000;
    });
    const fresh = snapshot.freshness === 'fresh';
    const job = active ?? latest;
    const state = record(job?.state);
    const failed = ['error', 'failed'].includes(String(state.lastRunStatus));
    const [department, name] = team.name.split(' · ');
    staff.push({ id: team.id, name: name ?? department, department, role: team.title ?? '',
      mode: !fresh || !job ? 'unknown' : active ? 'reported' : failed ? 'attention' : 'waiting',
      status: !fresh ? '현재 상태 미확인' : active ? '스케줄러 실행 보고' : failed ? '최근 실행 실패' : latest ? '최근 기록 확인 · 대기' : '연결된 업무 미확인',
      task: job ? safeText(job.displayName ?? (inferCronRole(String(job.name ?? '').replace(/^(jarvis|openclaw)-/, '')) || job.name)) : '담당 업무의 실행 기록을 아직 찾지 못했습니다.',
      next: active && fresh ? '진행 중인 회차의 결과 확인' : failed ? '실패 원본과 후속 조치 확인' : '다음 담당 업무 대기',
      observedAt: snapshot.observedAt,
      evidence: !fresh ? '목록이 오래되었거나 조회에 실패했습니다.' : active ? '스케줄러가 실행 시작을 보고했습니다. 프로세스 생존 확인과는 구분합니다.' : '자동화 이름을 기존 담당 분류에 연결한 최근 기록입니다. 현재 작업 중이라는 뜻은 아닙니다.',
    });
  }
  return staff;
}
