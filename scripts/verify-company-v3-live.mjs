import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {createHmac} from 'node:crypto';
import Database from 'better-sqlite3';
const url=process.env.COMPANY_PREVIEW_URL;if(!url||new URL(url).hostname!=='127.0.0.1')throw Error('Loopback required');
const cookie=createHmac('sha256',process.env.SESSION_SECRET).update(process.env.VIEWER_PASSWORD).digest('hex');
const headers={cookie:`jarvis-session=${cookie}`};
assert.equal((await fetch(url+'/api/command-room')).status,401);
const c=(await(await fetch(url+'/api/command-room',{headers})).json()).company;
const native=c.tasks.filter(t=>t.kind==='codex');assert.ok(native.length>0);
const db=new Database(path.join(os.homedir(),'.codex/thread_history_1.sqlite'),{readonly:true,fileMustExist:true});
let matchedEvents=0;
for(const task of native){const e=task.execution;assert.ok(db.prepare('SELECT 1 FROM thread_turns WHERE thread_id=? AND turn_id=?').get(e.threadId,e.turnId));for(const event of e.events){assert.ok(db.prepare('SELECT 1 FROM thread_items WHERE thread_id=? AND turn_id=? AND item_id=?').get(e.threadId,e.turnId,event.id));matchedEvents++;}}
db.close();
const reviewed=c.reports.filter(r=>r.review==='reviewed');assert.ok(reviewed.some(r=>r.taskId.startsWith('codex:')));
for(const r of reviewed){assert.equal(r.assessment.status,'reviewed');assert.equal(r.assessment.policyVersion,2);assert.ok(r.assessment.nextActions.length>0);assert.ok(r.assessment.reviewedAt);const allowed=new Set([r.id,...(r.context?.events?.map(e=>e.id)||[])]);assert.ok(r.assessment.evidenceIds.every(id=>allowed.has(id)));if(r.state!=='decision')assert.ok(r.assessment.ownerDecision.includes('새 승인 요청이 아닙니다'));}
const sample=reviewed.find(r=>r.taskId.startsWith('codex:'));
assert.equal((await fetch(url+'/api/command-room/review',{method:'POST',headers:{'Content-Type':'application/json',origin:url},body:JSON.stringify({reportId:sample.id})})).status,401);
assert.equal((await fetch(url+'/api/command-room/review',{method:'POST',headers:{...headers,'Content-Type':'application/json',origin:'https://foreign.invalid'},body:JSON.stringify({reportId:sample.id})})).status,403);
assert.equal((await fetch(url+'/api/command-room/review',{method:'POST',headers:{...headers,'Content-Type':'application/json',origin:url},body:JSON.stringify({reportId:'0'.repeat(64)})})).status,404);
const c2=(await(await fetch(url+'/api/command-room',{headers})).json()).company;
assert.equal(c2.reports.find(r=>r.id===sample.id).assessment.reviewedAt,sample.assessment.reviewedAt);
const evidence={checkedAt:new Date().toISOString(),codexTurnsMatched:native.length,codexItemsMatched:matchedEvents,reviewedReports:reviewed.length,reviewedCodexReports:reviewed.filter(r=>r.taskId.startsWith('codex:')).length,authorization:'401 / foreign origin 403 / missing report 404',stableReview:true,coverage:c.coverage.filter(v=>v.source.includes('Codex'))};
fs.writeFileSync('work/company-v3/verification.json',JSON.stringify(evidence,null,2));console.log(evidence);
