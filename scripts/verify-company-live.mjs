import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
const endpoint=process.env.COMPANY_PREVIEW_URL;
if(!endpoint?.startsWith('http://127.0.0.1:'))throw Error('Only loopback preview allowed');
const cookie=createHmac('sha256',process.env.SESSION_SECRET).update(process.env.VIEWER_PASSWORD).digest('hex');
async function snapshot(){const r=await fetch(endpoint+'/api/command-room',{headers:{cookie:`jarvis-session=${cookie}`}});assert.equal(r.status,200);return r.json();}
const anonymous=await fetch(endpoint+'/api/command-room');assert.equal(anonymous.status,401);
const a=await snapshot(),c=a.company;assert.ok(c.receiptAvailable);assert.ok(c.tasks.length>0);
const ids=new Set(c.tasks.map(t=>t.id)),owners=new Set(a.employees.map(e=>e.id));assert.equal(ids.size,c.tasks.length);
assert.ok(c.issues.every(i=>ids.has(i.taskId)));assert.ok(c.reports.every(r=>ids.has(r.taskId)));assert.ok(c.tasks.every(t=>owners.has(t.ownerId)));
assert.ok(c.tasks.every(t=>!t.parentId||ids.has(t.parentId)));assert.ok(c.reports.every(r=>r.receipt==='received'&&r.review==='not_reviewed'));
const sourceDb=new Database(process.env.JARVIS_OFFICE_SOURCE_DB,{readonly:true,fileMustExist:true});let sourceRows;try{sourceRows=sourceDb.prepare('SELECT id FROM dev_tasks ORDER BY created_at DESC LIMIT 1000').all();}finally{sourceDb.close();}
assert.ok(sourceRows.every(r=>ids.has(`development:${r.id}`)));
const scheduler=JSON.parse(execFileSync(path.join(os.homedir(),'bin/openclaw'),['automations','list','--all','--json'],{encoding:'utf8',timeout:25000,maxBuffer:32*1024*1024,env:{HOME:'/Users/ramsbaby',PATH:'/usr/bin:/bin'}}));
assert.ok(scheduler.jobs.every(j=>ids.has(`automation:${j.id}`)));
const b=await snapshot();const existingIds=new Set(c.reports.map(r=>r.id));const repeats=b.company.reports.filter(r=>existingIds.has(r.id));assert.ok(repeats.every(r=>c.reports.find(old=>old.id===r.id).receivedAt===r.receivedAt));
const evidence={checkedAt:new Date().toISOString(),anonymousStatus:anonymous.status,developmentSourceRows:sourceRows.length,automationSourceRows:scheduler.jobs.length,tasks:c.tasks.length,openIssueRecords:c.issues.filter(i=>i.state==='open').length,receiptRecords:c.reports.length,unlinkedTasks:0,unlinkedIssues:0,unlinkedReports:0,stableExistingReceipts:repeats.length,coverage:c.coverage};
fs.writeFileSync('work/company-v2/live-verification.json',JSON.stringify(evidence,null,2));fs.writeFileSync('work/company-v2/live-snapshot.json',JSON.stringify(a,null,2));console.log(JSON.stringify(evidence,null,2));
