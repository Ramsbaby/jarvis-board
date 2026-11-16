import type { CompanyTask } from './types';
import type { OfficeEmployee } from '../command-room/employees';
const rank = (t: CompanyTask) => t.archived ? -1 : ({running:7,reported:6,blocked:5,decision:4,waiting:3,scheduled:2,completed:1,unknown:0}[t.state]);
export function compareTasks(a: CompanyTask, b: CompanyTask): number {
  return rank(b)-rank(a) || b.priority-a.priority || (Date.parse(b.eventAt||'')||0)-(Date.parse(a.eventAt||'')||0);
}
export function offlineEmployee(e: OfficeEmployee): OfficeEmployee {
  return {...e, mode:'unknown', hasActiveWork:false, activity:undefined, status:'연결 끊김 · 현재 업무 확인 불가'};
}
/** One current entry per Codex conversation; individual execution records remain accessible. */
export function currentTasks(tasks: CompanyTask[]):CompanyTask[]{
 const groups=new Map<string,CompanyTask>();
 for(const task of [...tasks].sort(compareTasks)){const key=task.execution?.threadId||task.id;const previous=groups.get(key);const time=(t:CompanyTask)=>Date.parse(t.execution?.lastEventAt||t.eventAt||'')||0;if(!previous||time(task)>time(previous))groups.set(key,task);}
 return [...groups.values()].sort(compareTasks);
}
