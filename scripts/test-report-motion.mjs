import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './test-support.mjs';

const {qaTasks}=load('lib/company/derive.ts');
const {collectReportMotions,automaticReportIsRecent,internalHeartbeat,reviewDeliveryIsRecent,enqueueReportMotion,reportMotionReason}=load('lib/company/motion.ts');
const now=Date.parse('2026-11-15T09:00:00+09:00'),at=new Date(now).toISOString();
// The QA source uses seconds since epoch; receipt time is the later collection time.
function qaReports(age,count=13){
  return qaTasks(Array.from({length:count},(_,i)=>[`candidate-wallet-settings-v${i}-20261115`,{state:'needs_review',ended_at_epoch:(now-age-i*1000)/1000}]),{},true,at)
    .map(t=>({id:'receipt:'+t.id,taskId:t.id,ownerId:t.ownerId,title:t.title,summary:t.summary,eventAt:t.eventAt,receivedAt:at,state:t.state,receipt:'received',review:'not_reviewed',context:{body:t.summary,issue:t.issue,next:t.next,evidence:t.evidence,executionStatus:'failed',eventIds:[]},assessment:{status:'source_ready',reviewedAt:null}}));
}
const collect=(reports)=>collectReportMotions(reports,new Set(),new Map(),now);

test('13 historical QA failures collected now remain intact and trigger neither employee nor Jarvis walks',()=>{
  const reports=qaReports(3*3600000),original=JSON.stringify(reports),seen=new Set(),latest=new Map();
  assert.equal(collectReportMotions(reports,seen,latest,now).length,0);
  assert.equal(reports.filter(r=>reviewDeliveryIsRecent(r,now)).length,0);
  assert.equal(seen.size,13);assert.equal(latest.size,13);
  assert.equal(reports.filter(r=>r.state==='blocked'&&r.context.issue).length,13);
  assert.equal(JSON.stringify(reports),original);
});
test('simultaneous fresh QA reports yield the newest representative once per employee',()=>{
  const reports=qaReports(1000),other={...reports[0],id:'dev',taskId:'development:42',ownerId:'work',state:'completed'};
  const motions=collect([...reports,other]);
  assert.equal(motions.length,2);assert.equal(motions.find(r=>r.ownerId==='qa').id,reports[0].id);
});
test('heartbeat DONT_NOTIFY source XML excludes both paths even when marked completed or blocked',()=>{
  for(const xml of ['<heartbeat decision="DONT_NOTIFY"><summary>내부 점검</summary></heartbeat>',"<heartbeat decision='DONT_NOTIFY' />",'<heartbeat><decision> DONT_NOTIFY </decision><summary>내부 점검</summary></heartbeat>']){
    const r={...qaReports(1000,1)[0],state:'completed',context:{body:xml},assessment:{status:'reviewed',reviewedAt:at}};
    assert.equal(internalHeartbeat(r),true);assert.equal(reportMotionReason(r),null);
    assert.equal(collect([r]).length,0);assert.equal(reviewDeliveryIsRecent(r,now),false);
    assert.equal(r.context.body,xml);
  }
  assert.equal(internalHeartbeat({...qaReports(1000,1)[0],summary:'DONT_NOTIFY 단어 설명'}),false);
});
test('a genuine new development completion still moves and repeated observation stays still',()=>{
  const r={...qaReports(1000,1)[0],id:'owner-report:42',taskId:'order:42',ownerId:'owner-order-worker',title:'검색 개선',state:'completed',summary:'검색 개선 구현 및 독립 검사 완료',context:{body:'구현 및 검사 완료',executionStatus:'completed'},assessment:{status:'reviewed',reviewedAt:at}};
  const seen=new Set(),latest=new Map();
  assert.equal(collectReportMotions([r],seen,latest,now).length,1);
  assert.equal(collectReportMotions([{...r,id:'reobserved'}],seen,latest,now).length,0);
  assert.equal(reviewDeliveryIsRecent(r,now),true);
});
test('old, invalid, future event times and stale receipts cannot start automatic walks',()=>{
  const r=qaReports(1000,1)[0];
  for(const eventAt of [new Date(now-120000).toISOString(),'invalid',new Date(now+1000).toISOString()]){
    assert.equal(automaticReportIsRecent({...r,eventAt},now),false);
    assert.equal(reviewDeliveryIsRecent({...r,eventAt},now),false);
  }
  assert.equal(automaticReportIsRecent({...r,receivedAt:new Date(now-120000).toISOString()},now),false);
  assert.equal(automaticReportIsRecent({...r,eventAt:null},now),true);
});
test('employee and delivery queues replace pending automatic work by owner while retaining other owners',()=>{
  const reports=qaReports(1000),queue=[];
  for(const report of [...reports].reverse())enqueueReportMotion(queue,{report,replay:false});
  assert.equal(queue.length,1);assert.equal(queue[0].report.id,reports[0].id);
  enqueueReportMotion(queue,{report:{...reports[0],ownerId:'work',id:'dev'},replay:false});
  assert.equal(queue.length,2);
  const active=queue.shift();
  enqueueReportMotion(queue,{report:{...active.report,id:'duplicate-receipt'},replay:false},active);
  assert.equal(queue.length,1);
  enqueueReportMotion(queue,{report:{...active.report,id:'new',summary:'새 결과'},replay:false},active);
  assert.equal(queue.length,2);
});
test('explicit historical and internal report replays bypass automatic queue coalescing',()=>{
  const report=qaReports(3600000,1)[0],queue=[];
  enqueueReportMotion(queue,{report,replay:false});
  enqueueReportMotion(queue,{report,replay:true});
  enqueueReportMotion(queue,{report:{...report,context:{body:'<heartbeat decision="DONT_NOTIFY" />'}},replay:true});
  assert.equal(queue.length,3);assert.equal(queue[0].replay,true);assert.equal(queue[1].report,report);
});

test("staff and secretary share one newest pending review per employee",()=>{const {retainLatestReview}=load("lib/company/motion.ts");const reports=qaReports(0,13);const pending=new Map();for(const report of reports)retainLatestReview(pending,report);assert.equal(pending.size,1);const representative=pending.get("qa");assert.ok(representative);pending.delete(representative.ownerId);assert.equal(pending.size,0);});

test("historical replay cannot consume or relabel a current automatic report",()=>{const {takeHandoffReview}=load("lib/company/motion.ts");const [old,current]=qaReports(0,2);const pending=new Map([[current.ownerId,current]]);assert.equal(takeHandoffReview({report:old,replay:true},pending,true),old);assert.equal(pending.get(current.ownerId),current);assert.equal(takeHandoffReview({report:old,replay:false},pending,true),current);assert.equal(pending.size,0);});
