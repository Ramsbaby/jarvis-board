import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {load} from './test-support.mjs';

const {readDraft,writeDraft,validDraftInput,DRAFT_KEY}=load('lib/company/draft-sync.ts');
const meetingKey='jarvis.meeting-draft.v1:["jarvis","jarvis-board"]';

test('server keeps only the newer draft and reports what it holds',()=>{
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'drafts-')),'drafts.sqlite');
 assert.equal(readDraft(file,meetingKey),null);
 assert.equal(writeDraft(file,meetingKey,{question:'폰에서 쓴 질문',instruction:''},2000).stored,true);
 const older=writeDraft(file,meetingKey,{question:'예전 PC 초안',instruction:''},1000);
 assert.equal(older.stored,false);assert.equal(older.value.question,'폰에서 쓴 질문');assert.equal(older.updatedAt,2000);
 assert.equal(writeDraft(file,meetingKey,{question:'같은 시각',instruction:''},2000).stored,false);
 assert.equal(writeDraft(file,meetingKey,{question:'',instruction:''},3000).stored,true);
 assert.equal(JSON.stringify(readDraft(file,meetingKey)),JSON.stringify({value:{question:'',instruction:''},updatedAt:3000}));
});
test('only known draft names, sane times and bounded sizes are accepted',()=>{
 assert.ok(DRAFT_KEY.test('jarvis.order-drafts.v1'));assert.ok(DRAFT_KEY.test(meetingKey));
 for(const bad of ['jarvis.order-drafts.v2','x','jarvis.meeting-draft.v1:["../etc","jarvis-board"]','jarvis.meeting-draft.v1:["a","b"] '])assert.equal(DRAFT_KEY.test(bad),false,bad);
 assert.equal(validDraftInput(meetingKey,{q:1},Date.now()),null);
 assert.ok(validDraftInput(meetingKey,{q:1},Date.now()+60*60_000));
 assert.ok(validDraftInput(meetingKey,{q:1},-1));
 assert.ok(validDraftInput(meetingKey,{q:'가'.repeat(20000)},Date.now()));
 assert.ok(validDraftInput(meetingKey,undefined,Date.now()));
});

function memoryStorage(){const m=new Map();return ()=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)});}
const {createOrderDraftStore}=load('components/command-room/order-drafts.ts');
const draft=(instruction)=>({projectId:'jarvis-board',kind:'development',instruction,projectManual:false});

test('order drafts: opening or switching never pushes; typing and sending do',()=>{
 const pushes=[];const store=createOrderDraftStore(memoryStorage(),(k,v,t)=>pushes.push({k,v,t}));
 store.save(draft(''));store.save(draft(''));
 assert.equal(pushes.length,0,'restoring/opening must not push');
 store.save(draft('지도 이름표 겹침 고쳐'),true);
 assert.equal(pushes.length,1);assert.equal(pushes[0].k,'jarvis.order-drafts.v1');assert.equal(pushes[0].v.drafts[0].instruction,'지도 이름표 겹침 고쳐');
 store.save(draft('지도 이름표 겹침 고쳐'),true);
 assert.equal(pushes.length,1,'unchanged text is not a new edit');
 store.sent(draft('지도 이름표 겹침 고쳐'));
 assert.equal(pushes.length,2);assert.equal(pushes[1].v.drafts.length,0,'sent draft is cleared on other devices too');
 assert.ok(pushes[1].t>pushes[0].t);
});
test('order drafts: newer remote is adopted, older or equal is ignored',()=>{
 const store=createOrderDraftStore(memoryStorage(),()=>{});
 store.save(draft('이 기기 초안'),true);const mine=store.updatedAt();
 assert.equal(store.adopt({value:{independentActive:null,drafts:[draft('옛 초안')]},updatedAt:mine-1}),false);
 assert.equal(store.restoreIndependent().instruction,'이 기기 초안');
 const remote={value:{active:JSON.stringify(['jarvis-board','development',null,null]),independentActive:JSON.stringify(['jarvis-board','development',null,null]),drafts:[draft('폰에서 이어 쓴 초안')]},updatedAt:mine+5000};
 assert.equal(store.adopt(remote),true);
 assert.equal(store.restoreIndependent().instruction,'폰에서 이어 쓴 초안');
 assert.equal(store.updatedAt(),mine+5000);
 assert.equal(store.adopt({value:{independentActive:null,drafts:[{...draft('x'),projectId:'evil'}]},updatedAt:mine+9000}),true);
 assert.equal(store.restoreIndependent(),undefined,'invalid remote drafts are dropped, not trusted');
});

test('meeting drafts: auto-filled proposal does not bump time or push; typing does',()=>{
 const pushes=[];const storage=new Map();
 const mod=load('lib/company/meeting-drafts.ts');
 // load() shares the module cache, so patch the client used by meeting-drafts through its exports object.
 const client=load('lib/company/draft-sync-client.ts');const original=client.pushDraft;
 globalThis.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},addEventListener(){}};
 client.pushDraft=(k,v,t)=>pushes.push({k,v,t});
 try{
  const key=mod.meetingDraftKey('jarvis','jarvis-board');
  mod.saveMeetingDraft(key,{question:'',instruction:'자동 추천 지시',askKey:null,executeKey:null});
  assert.equal(pushes.length,0);assert.equal(mod.readMeetingDraft(key).updatedAt,undefined);
  mod.saveMeetingDraft(key,{question:'진행 상황 알려줘',instruction:'자동 추천 지시',askKey:'k1',executeKey:null},true);
  assert.equal(pushes.length,1);assert.equal(JSON.stringify(pushes[0].v),JSON.stringify({question:'진행 상황 알려줘',instruction:'자동 추천 지시'}),'only text is synced, never request keys');
  const t=mod.readMeetingDraft(key).updatedAt;assert.ok(t>0);
  mod.saveMeetingDraft(key,{question:'진행 상황 알려줘',instruction:'자동 추천 지시',askKey:'k1',executeKey:null});
  assert.equal(mod.readMeetingDraft(key).updatedAt,t,'a later non-edit save keeps the edit time');
 }finally{client.pushDraft=original;delete globalThis.window;}
});

test('server remembers which drafts it accepted, so a device that lost the reply can tell delivered from never-arrived',()=>{
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'drafts-')),'drafts.sqlite');
 assert.equal(writeDraft(file,meetingKey,{question:'PC',instruction:''},1000).accepted,true);
 assert.equal(writeDraft(file,meetingKey,{question:'폰',instruction:''},2000).accepted,true);
 const again=writeDraft(file,meetingKey,{question:'PC',instruction:''},1000);
 assert.equal(again.stored,false);assert.equal(again.accepted,true,'re-sent copy of an already delivered draft is not a conflict');
 const lost=writeDraft(file,meetingKey,{question:'끊긴 PC',instruction:''},1500);
 assert.equal(lost.stored,false);assert.equal(lost.accepted,false,'never-arrived older draft is a conflict');
 assert.equal(readDraft(file,meetingKey,1000).mineAccepted,true);assert.equal(readDraft(file,meetingKey,1500).mineAccepted,false);
 assert.equal(readDraft(file,meetingKey).mineAccepted,undefined);
});

// 브라우저 쪽 보낼 함: fetch·저장소를 갈아 끼운 새 인스턴스로 끊김·새로고침을 흉내 낸다.
import ts from 'typescript';import vm from 'node:vm';
const clientSource=ts.transpileModule(fs.readFileSync('lib/company/draft-sync-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function client(net,storage){const mod={exports:{}};const timers=[];const ctx={module:mod,exports:mod.exports,JSON,Math,Map,Set,Object,Promise,encodeURIComponent,
 localStorage:storage,fetch:(...a)=>net(...a),setTimeout:(f)=>{timers.push(f);return timers.length;},clearTimeout:()=>{}};ctx.globalThis=ctx;vm.runInNewContext(clientSource,ctx);
 return {...mod.exports,runTimers(){const t=timers.splice(0);for(const f of t)f();}};}
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),m};};
const tick=()=>new Promise(r=>setImmediate(r));
const okJson=(body)=>Promise.resolve({ok:true,status:200,json:async()=>body});

test('offline push stays in the outbox, survives reload and is re-sent when the network returns',async()=>{
 const disk=store();let online=false;const sent=[];
 const net=(url,opt)=>{if(!online)return Promise.reject(new TypeError('offline'));if(opt?.method==='PUT'){sent.push(JSON.parse(opt.body));return okJson({draft:{accepted:true}});}return okJson({draft:null});};
 const a=client(net,disk);a.pushDraft('jarvis.order-drafts.v1',{drafts:[]},1000);a.runTimers();await tick();await tick();
 assert.equal(a.unsentState('jarvis.order-drafts.v1'),'pending');assert.ok(disk.m.get('jarvis.draft-sync.outbox.v1').includes('1000'));
 const reopened=client(net,disk);assert.equal(reopened.unsentState('jarvis.order-drafts.v1'),'pending','closing the window does not lose it');
 online=true;await reopened.pullDraft('jarvis.order-drafts.v1');await tick();await tick();
 assert.equal(sent.length,1);assert.equal(sent[0].updatedAt,1000);assert.equal(reopened.unsentState('jarvis.order-drafts.v1'),'none');
});
test('a reply lost after delivery is recognised; a draft overtaken while offline becomes a conflict, not a silent loss',async()=>{
 const disk=store();const key='jarvis.order-drafts.v1';
 let remote={value:{drafts:[]},updatedAt:1000,mineAccepted:true};
 const net=(url)=>String(url).includes('?')?okJson({draft:remote}):Promise.reject(new TypeError('lost'));
 const a=client(net,disk);a.pushDraft(key,{drafts:[]},1000);a.runTimers();await tick();await tick();
 assert.equal(a.unsentState(key),'pending');await a.pullDraft(key);assert.equal(a.unsentState(key),'none','delivered before the reply was lost');
 a.pushDraft(key,{drafts:[]},1500);remote={value:{drafts:[]},updatedAt:2000,mineAccepted:false};await a.pullDraft(key);
 assert.equal(a.unsentState(key),'conflict');
 a.pushDraft(key,{drafts:[]},2500);assert.equal(a.unsentState(key),'pending','typing again resolves the conflict in favour of this device');
 a.discardUnsent(key);assert.equal(a.unsentState(key),'none');
});
test('server refusing an older never-delivered draft marks a conflict and wakes the screens',async()=>{
 const disk=store();let woke=0;
 const net=()=>okJson({draft:{accepted:false,stored:false,updatedAt:9000}});
 const a=client(net,disk);a.onDraftResume(()=>woke++);a.pushDraft('jarvis.order-drafts.v1',{drafts:[]},1000);a.runTimers();await tick();await tick();
 assert.equal(a.unsentState('jarvis.order-drafts.v1'),'conflict');assert.equal(woke,1);
});
