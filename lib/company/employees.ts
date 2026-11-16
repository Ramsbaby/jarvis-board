import { compareTasks } from './presentation';
import type { OfficeEmployee } from '../command-room/employees';
import type { CompanySnapshot } from './types';
export function companyEmployees(roster: OfficeEmployee[], company: CompanySnapshot): OfficeEmployee[] {
  return roster.map(e => {
    const tasks = company.tasks.filter(t => t.ownerId === e.id && t.kind !== 'overview');
    const issues = company.issues.filter(i => i.ownerId === e.id && i.state === 'open');
    const active = tasks.filter(t => t.state === 'running' || t.state === 'reported');
    const unknown = tasks.filter(t => t.state === 'unknown');
    const top = [...tasks].sort(compareTasks)[0];
    return { ...e, name: e.id === 'work' ? '실행 담당' : e.name,
      mode: issues.length ? 'attention' : active.some(t => t.state === 'running') ? 'working' : active.length ? 'reported' : unknown.length || !tasks.length ? 'unknown' : 'waiting',
      activity: active[0] ? `${active[0].title} · ${active[0].execution?.activity || '진행 보고'}` : undefined, hasActiveWork: active.length>0,
      status: `${active.length} 진행 · ${issues.length} 확인 필요${unknown.length ? ` · ${unknown.length} 미확인` : ''}`,
      task: top?.title ?? '연결된 업무 없음', next: top?.next ?? '담당 업무 원본 연결',
      evidence: '가상 부서 대표입니다. 실제 실행 작업자 수가 아닙니다. 업무별 원본과 확인 수준을 상세에서 확인하세요.',
    };
  });
}
