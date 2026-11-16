import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import type { CompanyReport, CompanyTask } from './types';
export interface FollowUp { id:string; reportId:string; ownerId:string; title:string; acknowledgedAt:string; state:'assigned'|'linked'|'verified'; executionTaskId:string|null; verification:string|null; updatedAt:string; version:number }
function open(path:string){const db=new Database(path);db.pragma('busy_timeout = 3000');db.exec('CREATE TABLE IF NOT EXISTS office_followups(id TEXT PRIMARY KEY, report_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL)');return db;}
export function followUps(path:string):FollowUp[]{const db=open(path);try{return (db.prepare('SELECT data FROM office_followups').all() as {data:string}[]).map(r=>JSON.parse(r.data));}finally{db.close();}}
export function updateFollowUp(path:string, input:{reportId:string; operation:'acknowledge'|'link'|'verify'; version?:number; executionTaskId?:string; verification?:string}):FollowUp {
 const db=open(path);try{return db.transaction(()=>{
  const row=db.prepare('SELECT data FROM office_reports WHERE id=?').get(input.reportId) as {data:string}|undefined;if(!row)throw Error('보고 없음');const report=JSON.parse(row.data) as CompanyReport;
  const oldRow=db.prepare('SELECT data FROM office_followups WHERE report_id=?').get(report.id) as {data:string}|undefined;const old=oldRow?JSON.parse(oldRow.data) as FollowUp:null;
  if(input.operation==='acknowledge'&&old)return old;
  if(input.operation!=='acknowledge'&&(!old||input.version!==old.version))throw Error('다른 변경이 있습니다. 새로고침 후 다시 확인하세요.');
  const now=new Date().toISOString();let value:FollowUp=old??{id:createHash('sha256').update(report.id).digest('hex'),reportId:report.id,ownerId:report.ownerId,title:report.context?.next||'원본 보고의 다음 행동 확인',acknowledgedAt:now,state:'assigned',executionTaskId:null,verification:null,updatedAt:now,version:0};
  if(input.operation==='link'){
   const row=db.prepare('SELECT data FROM office_tasks WHERE id=?').get(input.executionTaskId) as {data:string}|undefined;if(!row)throw Error('연결할 실행 기록 없음');const task=JSON.parse(row.data) as CompanyTask;
   if(task.ownerId!==report.ownerId)throw Error('보고 담당자의 실행 기록만 연결할 수 있습니다.');
   value={...value,state:'linked',executionTaskId:task.id,verification:null};
  }
  if(input.operation==='verify'){
   if(value.state!=='linked'||!value.executionTaskId)throw Error('실행 기록을 먼저 연결하세요.');
   const row=db.prepare('SELECT data FROM office_tasks WHERE id=?').get(value.executionTaskId) as {data:string}|undefined;const task=row?JSON.parse(row.data) as CompanyTask:null;
   if(!task||task.state==='unknown'||task.state==='blocked'||(!task.result&&!(task.execution?.status==='completed'&&task.execution.reportText)))throw Error('완료 결과 근거가 있는 실행만 검증 확인할 수 있습니다.');
   const note=input.verification?.trim();if(!note||note.length<10||note.length>600)throw Error('직접 대조한 검증 근거를 10~600자로 입력하세요.');
   value={...value,state:'verified',verification:note};
  }
  value={...value,updatedAt:now,version:value.version+1};db.prepare('INSERT OR REPLACE INTO office_followups VALUES(?,?,?)').run(value.id,report.id,JSON.stringify(value));return value;
 })();}finally{db.close();}
}
