import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import type {ProjectId} from './projects';
export interface MeetingMessage {role:'owner'|'jarvis';text:string;at:string}
export interface CompanyMeeting {id:string;employeeId:string;projectId:ProjectId;messages:MeetingMessage[];proposal:string;orderId?:string;updatedAt:string;pending?:boolean;error?:string}
function open(file:string){mkdirSync(dirname(file),{recursive:true});const db=new Database(file);db.pragma('busy_timeout=3000');db.exec('CREATE TABLE IF NOT EXISTS company_meetings(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS company_interviews(id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL, at INTEGER NOT NULL, state TEXT NOT NULL, budget INTEGER NOT NULL, data TEXT NOT NULL)');return db;}
export function readMeetings(file:string){const db=open(file);try{return (db.prepare('SELECT data FROM company_meetings ORDER BY rowid DESC LIMIT 30').all() as {data:string}[]).map(r=>JSON.parse(r.data) as CompanyMeeting);}finally{db.close();}}
export function meeting(file:string,id:string){const db=open(file);try{const r=db.prepare('SELECT data FROM company_meetings WHERE id=?').get(id) as {data:string}|undefined;return r?JSON.parse(r.data) as CompanyMeeting:undefined;}finally{db.close();}}
export function saveMeeting(file:string,m:CompanyMeeting){const db=open(file);try{db.prepare('INSERT OR REPLACE INTO company_meetings VALUES(?,?)').run(m.id,JSON.stringify(m));}finally{db.close();}}
export function beginInterview(file:string,input:{id?:string;orderId?:string;employeeId:string;projectId:ProjectId;question:string;requestId:string},budget:number){const db=open(file);try{return db.transaction(()=>{
 const prior=db.prepare('SELECT data,state FROM company_interviews WHERE id=?').get(input.requestId) as {data:string;state:string}|undefined;
 if(prior){const p=JSON.parse(prior.data);if(JSON.stringify(p.input)!==JSON.stringify(input))throw Error('같은 요청 번호의 내용이 다릅니다.');return {id:p.meetingId as string,created:false,state:prior.state};}
 const now=Date.now();db.prepare("UPDATE company_interviews SET state='expired' WHERE state='pending' AND at<?").run(now-90000);
 if(db.prepare("SELECT id FROM company_interviews WHERE state='pending'").get())throw Error('앞선 면담 답변을 작성 중입니다. 잠시 후 다시 질문해주세요.');
 const usage=db.prepare('SELECT COALESCE(SUM(budget),0) AS total FROM company_interviews WHERE at>?').get(now-86400000) as {total:number};
 const count=db.prepare("SELECT COUNT(*) AS n FROM company_interviews WHERE at>? AND json_extract(data,'$.sourceOnly') IS NOT 1").get(now-3600000) as {n:number};
 if(budget>0&&(count.n>=20||usage.total+budget>20000))throw Error('면담 보호 한도에 도달했습니다. 자동 재시도하지 않습니다. 아래 직접 지시로 실제 개발 업무를 배정할 수 있습니다.');
 const r=input.id?db.prepare('SELECT data FROM company_meetings WHERE id=?').get(input.id) as {data:string}|undefined:undefined;
 if(input.id&&!r)throw Error('면담 기록을 찾을 수 없습니다.');
 const m:CompanyMeeting=r?JSON.parse(r.data):{id:randomUUID(),employeeId:input.employeeId,projectId:input.projectId,messages:[],proposal:'',updatedAt:new Date(now).toISOString()};
 if(m.employeeId!==input.employeeId||m.projectId!==input.projectId)throw Error('다른 직원·프로젝트의 면담입니다. 새 면담을 시작해주세요.');
 if(m.orderId!==input.orderId)throw Error('질문을 준비하는 동안 연결 업무가 바뀌었습니다. 기존 입력을 유지하고 보고를 다시 확인해주세요.');
 m.messages=[...m.messages,{role:'owner' as const,text:input.question,at:new Date(now).toISOString()}].slice(-24);m.pending=true;m.error=undefined;m.proposal='';m.updatedAt=new Date(now).toISOString();
 db.prepare('INSERT OR REPLACE INTO company_meetings VALUES(?,?)').run(m.id,JSON.stringify(m));db.prepare('INSERT INTO company_interviews VALUES(?,?,?,?,?,?)').run(input.requestId,m.id,now,'pending',budget,JSON.stringify({input,meetingId:m.id,sourceOnly:budget===0}));return {id:m.id,created:true,state:'pending'};
 })();}finally{db.close();}}
export function finishInterview(file:string,id:string,requestId:string,result:{answer:string;proposal:string}|{error:string},tokens?:number){const db=open(file);try{db.transaction(()=>{const run=db.prepare("SELECT state,meeting_id FROM company_interviews WHERE id=?").get(requestId) as {state:string;meeting_id:string}|undefined;if(run?.state!=='pending'||run.meeting_id!==id)return;const r=db.prepare('SELECT data FROM company_meetings WHERE id=?').get(id) as {data:string};const m:CompanyMeeting=JSON.parse(r.data);m.pending=false;m.updatedAt=new Date().toISOString();if('error'in result)m.error=result.error;else {m.messages=[...m.messages,{role:'jarvis' as const,text:result.answer,at:m.updatedAt}].slice(-24);m.proposal=result.proposal;m.error=undefined;}db.prepare('UPDATE company_meetings SET data=? WHERE id=?').run(JSON.stringify(m),id);db.prepare('UPDATE company_interviews SET state=?,budget=COALESCE(?,budget) WHERE id=?').run('error'in result?'failed':'done',tokens??null,requestId);})();}finally{db.close();}}
