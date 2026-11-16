import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {load,hintKey} from './test-support.mjs';

// Exercise the real component's event handlers and effects without a browser or API.
const source=ts.transpileModule(fs.readFileSync('components/command-room/MeetingDesk.tsx','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
const {meetingActions}=load('lib/company/meeting-actions.ts');
const questions=meetingActions().filter(a=>a.kind==='question');
const direct=meetingActions().find(a=>a.kind==='instruction');
const repair=meetingActions({stage:'failed',goal:'버튼 수정',error:'검사 실패'}).find(a=>a.id==='repair');
function harness(storage=new Map(),initial={},respond,documentOverride){
 const draftModule={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/company/meeting-drafts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:draftModule,exports:draftModule.exports,require:()=>({pushDraft(){}}),window:{localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}}});
 const cells=[],effects=[],calls=[];let cursor=0,tree;
 const props={visible:true,request:{employeeId:'jarvis',name:'자비스',token:1},orders:[],motion:null,onClose(){},onGather(){},onReturn(){},onOrder(){},onResult(){}};
 Object.assign(props,initial);
 const react={
  useState(initial){const i=cursor++;if(!(i in cells))cells[i]=initial;return [cells[i],v=>{cells[i]=typeof v==='function'?v(cells[i]):v;}];},
  useRef(initial){const i=cursor++;return cells[i]??={current:initial};},
  useEffect(fn,deps){const i=cursor++,old=cells[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j]))){effects.push(()=>{old?.cleanup?.();cells[i]={deps,cleanup:fn()};});}}
 };
 const jsx=(type,props)=>({type,props});const mod={exports:{}};
 vm.runInNewContext(source,{module:mod,exports:mod.exports,require(name){
  if(name==='@/lib/company/meeting-drafts')return draftModule.exports;
  if(name==='@/lib/company/draft-sync-client')return {pullDraft:async()=>null,pushDraft(){},onDraftResume:()=>()=>{},unsentState:()=>'none',discardUnsent(){}};
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(name==='./DeploymentBadge')return {default:'DeploymentBadge'};
  if(name==='./textarea-hint')return load('components/command-room/textarea-hint.ts');
  if(name==='./MeetingActions')return {default:'MeetingActions'};
  if(name.endsWith('.css'))return {};
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  throw Error(`Unexpected import: ${name}`);
 },crypto:{randomUUID:()=>`request-${calls.length}`},fetch:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);if(respond)return respond(body);
  return {ok:true,json:async()=>({meeting:{id:'meeting',employeeId:body.employeeId||props.request.employeeId,projectId:body.projectId,messages:[],proposal:'',orderId:body.operation==='execute'?'order':body.orderId},order:{id:'order',stage:'received'}})};
 },requestAnimationFrame:fn=>fn(),document:documentOverride||{querySelector:()=>null},window:{addEventListener(){},removeEventListener(){}},setTimeout,clearTimeout});
 function render(){cursor=0;tree=mod.exports.default(props);while(effects.length)effects.shift()();cursor=0;tree=mod.exports.default(props);return tree;}
 function nodes(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(n=>nodes(n));return [node,...nodes(node.props?.children)];}
 const find=predicate=>{const node=nodes(tree).find(predicate);assert.ok(node,'Expected rendered control');return node.props;};
 const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
 const api={calls,props,render,
  choose(action){find(n=>n.type==='MeetingActions').onChoose(action);render();},
  edit(id,value){find(n=>n.props?.id===id).onChange({target:{value}});render();},
  value:id=>find(n=>n.props?.id===id).value,
  field:id=>find(n=>n.props?.id===id),
  control:label=>find(n=>n.type==='button'&&text(n)===label),
  preview:kind=>nodes(tree).find(n=>n.props?.['aria-label']===(kind==='question'?'질문 추천 미리보기':'실행 지시 추천 미리보기')),
  click(label,scope){const list=scope?nodes(scope):nodes(tree);const button=list.find(n=>n.type==='button'&&text(n)===label);assert.ok(button,`Expected button ${label}`);assert.ok(!button.props.disabled);const result=button.props.onClick();render();return result;},
  async settle(){await new Promise(resolve=>setImmediate(resolve));render();}
 };
 render();return api;
}

test('recommendations preserve drafts and offer explicit replacement or keep, independently per field',async()=>{
 const h=harness();await h.settle();const baseline=h.calls.length;
 h.edit('meeting-question','작성 중인 나의 질문');h.edit('meeting-instruction','작성 중인 실제 수정 지시와 완료 조건');
 h.choose(questions[0]);h.choose(repair);
 assert.equal(h.value('meeting-question'),'작성 중인 나의 질문');assert.equal(h.value('meeting-instruction'),'작성 중인 실제 수정 지시와 완료 조건');
 assert.ok(h.preview('question'));assert.ok(h.preview('instruction'));assert.equal(h.calls.length,baseline);
 h.click('기존 입력 유지',h.preview('question'));
 assert.equal(h.preview('question'),undefined);assert.equal(h.value('meeting-question'),'작성 중인 나의 질문');assert.ok(h.preview('instruction'));
 h.click('추천으로 바꾸기',h.preview('instruction'));
 assert.equal(h.value('meeting-instruction'),repair.text);assert.equal(h.value('meeting-question'),'작성 중인 나의 질문');assert.equal(h.preview('instruction'),undefined);assert.equal(h.calls.length,baseline);
 h.choose(questions[0]);h.edit('meeting-question','미리보기 이후에도 계속 작성');h.choose(questions[1]);
 h.click('추천으로 바꾸기',h.preview('question'));assert.equal(h.value('meeting-question'),questions[1].text);assert.equal(h.value('meeting-instruction'),repair.text);assert.equal(h.calls.length,baseline);
});

test('empty and identical inputs apply immediately; empty direct instructions require consent to erase a draft',async()=>{
 const h=harness();await h.settle();const baseline=h.calls.length;
 for(const action of [questions[0],repair]){const id=action.kind==='question'?'meeting-question':'meeting-instruction';h.choose(action);assert.equal(h.value(id),action.text);assert.equal(h.preview(action.kind),undefined);h.choose(action);assert.equal(h.value(id),action.text);assert.equal(h.preview(action.kind),undefined);}
 h.choose(direct);assert.equal(h.value('meeting-instruction'),repair.text);assert.ok(h.preview('instruction'));
 h.click('기존 입력 유지',h.preview('instruction'));assert.equal(h.value('meeting-instruction'),repair.text);
 h.choose(direct);h.click('추천으로 바꾸기',h.preview('instruction'));assert.equal(h.value('meeting-instruction'),'');
 h.choose(direct);assert.equal(h.preview('instruction'),undefined);assert.equal(h.value('meeting-question'),questions[0].text);assert.equal(h.calls.length,baseline);
 h.edit('meeting-question','  ');h.choose(questions[1]);assert.equal(h.value('meeting-question'),questions[1].text);assert.equal(h.preview('question'),undefined);
});

test('project and employee switches clear both pending replacements',async()=>{
 const h=harness();await h.settle();
 for(const context of ['project','employee']){
  h.edit('meeting-question','나의 질문');h.edit('meeting-instruction','나의 실행 지시');h.choose(questions[0]);h.choose(repair);
  assert.ok(h.preview('question'));assert.ok(h.preview('instruction'));
  if(context==='project'){
   // Locate the real project selector through its accessible label.
   const walk=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)];
   walk(h.render()).find(n=>n.props?.['aria-label']==='면담 프로젝트').props.onChange({target:{value:'gostop'}});
  }else h.props.request={employeeId:'reviewer',name:'검토 담당',token:1};
  h.render();await h.settle();assert.equal(h.preview('question'),undefined);assert.equal(h.preview('instruction'),undefined);
  assert.equal(h.calls.at(-1).operation,'open');assert.equal(h.calls.at(-1).projectId,'gostop');
 }
});

test('only existing explicit send and dispatch controls invoke ask and execute',async()=>{
 const h=harness();await h.settle();h.choose(questions[0]);assert.deepEqual(h.calls.map(c=>c.operation),['open']);
 h.click('질문 보내기 · 자비스 답변');await h.settle();assert.deepEqual(h.calls.map(c=>c.operation),['open','ask']);assert.equal(h.calls[1].question,questions[0].text);
 h.choose(repair);assert.deepEqual(h.calls.map(c=>c.operation),['open','ask']);
 h.click('담당에게 배정 · 수정·검토 실행');await h.settle();assert.deepEqual(h.calls.map(c=>c.operation),['open','ask','execute']);assert.equal(h.calls[2].instruction,repair.text);
});

 test('unsent question and instruction survive a full reload without sending',async()=>{const storage=new Map(),a=harness(storage);await a.settle();a.edit('meeting-question','새로고침 뒤에도 남을 질문');a.edit('meeting-instruction','실제 수정 지시 초안은 아직 보내지 않음');const b=harness(storage);await b.settle();assert.equal(b.value('meeting-question'),'새로고침 뒤에도 남을 질문');assert.equal(b.value('meeting-instruction'),'실제 수정 지시 초안은 아직 보내지 않음');assert.deepEqual(b.calls.map(c=>c.operation),['open']);});
 test('dispatch clears only the submitted instruction and preserves unrelated question',async()=>{const h=harness();await h.settle();h.edit('meeting-question','다음 회의에서 물을 질문');h.edit('meeting-instruction','자비스보드의 보고 동작을 실제 수정해주세요');h.click('담당에게 배정 · 수정·검토 실행');await h.settle();assert.equal(h.value('meeting-question'),'다음 회의에서 물을 질문');assert.equal(h.value('meeting-instruction'),'');});

test('report opens its actual project and order, displays the work, and preserves unsent drafts',async()=>{
 const h=harness();await h.settle();h.edit('meeting-question','보내지 않은 질문');h.edit('meeting-instruction','보내지 않은 수정 지시를 유지해주세요');
 h.props.orders=[{id:'reported',projectId:'jarvis-board',goal:'보고 연결 개선',stage:'reported'}];
 h.props.request={employeeId:'jarvis',name:'자비스',token:2,orderId:'reported'};h.render();await h.settle();
 assert.equal(h.calls.at(-1).orderId,'reported');assert.equal(h.calls.at(-1).projectId,'jarvis-board');
 assert.equal(h.value('meeting-question'),'보내지 않은 질문');assert.equal(h.value('meeting-instruction'),'보내지 않은 수정 지시를 유지해주세요');
 assert.match(JSON.stringify(h.render()),/이 보고에 이어서/);assert.match(JSON.stringify(h.render()),/보고 연결 개선/);
 h.click('질문 보내기 · 자비스 답변');await h.settle();assert.equal(h.calls.at(-1).orderId,'reported');
 h.click('담당에게 배정 · 수정·검토 실행');await h.settle();assert.equal(h.calls.at(-1).orderId,'reported');
 const other=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:'game'},orders:[{id:'game',projectId:'gostop',goal:'게임 개선',stage:'reported'}]});await other.settle();
 assert.equal(other.calls[0].projectId,'gostop');assert.equal(other.calls[0].orderId,'game');
});
test('missing report work cannot silently open another interview or send a question',async()=>{
 const h=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:'missing'}});await h.settle();
 assert.equal(h.calls.length,0);assert.match(JSON.stringify(h.render()),/다른 업무로 연결하지 않았습니다/);
});

test('open conflicts and mismatched server records preserve drafts and block sending',async()=>{
 for(const mismatch of [false,true]){
  const storage=new Map(),original=harness(storage);await original.settle();original.edit('meeting-question','기존 미전송 질문');original.edit('meeting-instruction','기존 미전송 수정 지시');
  const h=harness(storage,{request:{employeeId:'jarvis',name:'자비스',token:2,orderId:'target'},orders:[{id:'target',projectId:'jarvis-board',goal:'보고 대상',stage:'reported'}]},body=>({ok:mismatch,json:async()=>mismatch?{meeting:{id:'wrong',employeeId:'jarvis',projectId:body.projectId,orderId:'other',messages:[],proposal:'덮어쓸 제안'}}:{error:'다른 업무의 면담이 진행 중입니다.'}}));
  await h.settle();assert.equal(h.value('meeting-question'),'기존 미전송 질문');assert.equal(JSON.parse([...storage.values()][0]).instruction,'기존 미전송 수정 지시');assert.equal(h.control('질문 보내기 · 자비스 답변').disabled,true);
  assert.equal(h.calls.length,1);assert.match(JSON.stringify(h.render()),mismatch?/연결을 중단했습니다/:/다른 업무의 면담이 진행 중/);
 }
});

test('lost dispatch response reload restores receipt without another execute or clearing the separate question',async()=>{
 const storage=new Map(),parent={id:'parent',projectId:'jarvis-board',stage:'reported',goal:'원래 보고'},request={employeeId:'jarvis',name:'자비스',token:1,orderId:'parent'};
 let receipt,dispatches=0,recovered;
 const reply=async b=>{if(b.operation==='execute'){dispatches++;receipt={id:'child',projectId:'jarvis-board',requestId:b.requestId,instruction:b.instruction,stage:'running',parent:{id:'parent'}};throw Error('response lost after server commit');}return {ok:true,json:async()=>({meeting:{id:'meeting',employeeId:'jarvis',projectId:'jarvis-board',messages:[],proposal:'',orderId:receipt?'child':'parent'},...(receipt?{recoveredOrder:receipt}:{})})};};
 const a=harness(storage,{request,orders:[parent]},reply);await a.settle();a.edit('meeting-question','별도로 남겨둔 질문');a.edit('meeting-instruction','원래 보고의 수정사항을 이어서 실행해주세요');a.click('담당에게 배정 · 수정·검토 실행');await a.settle();
 const b=harness(storage,{request,orders:[parent],onOrder:o=>{recovered=o;}},reply);await b.settle();assert.equal(dispatches,1);assert.equal(b.calls[0].resumeRequestId,receipt.requestId);assert.equal(b.calls[0].id,'meeting');assert.equal(recovered.id,'child');assert.equal(b.value('meeting-instruction'),'');assert.equal(b.value('meeting-question'),'별도로 남겨둔 질문');assert.ok(b.calls.every(c=>c.operation==='open'));
});
test('bound report retries opening after asynchronous orders load',async()=>{const h=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:'late'},orders:[]});await h.settle();assert.equal(h.calls.length,0);h.props.orders=[{id:'late',projectId:'jarvis-board',stage:'reported',goal:'늦게 조회된 보고'}];h.render();await h.settle();assert.equal(h.calls.at(-1).orderId,'late');assert.equal(h.calls.at(-1).operation,'open');});
test('HTTP200 model failure keeps question available for an explicit retry',async()=>{
 const h=harness(new Map(),{},b=>({ok:true,json:async()=>({meeting:{id:'meeting',employeeId:'jarvis',projectId:'jarvis-board',messages:[],proposal:'',...(b.operation==='ask'?{error:'제공자 연결 실패'}:{})}})}));await h.settle();h.edit('meeting-question','응답 실패해도 보존할 질문');h.click('질문 보내기 · 자비스 답변');await h.settle();assert.equal(h.value('meeting-question'),'응답 실패해도 보존할 질문');assert.match(JSON.stringify(h.render()),/제공자 연결 실패/);assert.equal(h.calls.filter(c=>c.operation==='ask').length,1);
});
test('storage failure warns without discarding the live unsent text',async()=>{const storage={get(){return null},set(){throw Error('quota')}};const h=harness(storage);await h.settle();h.edit('meeting-question','저장 불가 시에도 작성 중인 문장');assert.equal(h.value('meeting-question'),'저장 불가 시에도 작성 중인 문장');assert.match(JSON.stringify(h.render()),/브라우저 저장 실패/);});
test('employee contexts restore their own drafts on return',async()=>{const h=harness();await h.settle();h.edit('meeting-question','자비스에게 묻던 질문');h.props.request={employeeId:'infra-lead',name:'운영 담당',token:2};h.render();await h.settle();h.edit('meeting-question','운영 담당에게 묻던 질문');h.props.request={employeeId:'jarvis',name:'자비스',token:3};h.render();await h.settle();assert.equal(h.value('meeting-question'),'자비스에게 묻던 질문');});
test('last chosen project and its unsent instruction restore after reload',async()=>{const storage=new Map(),a=harness(storage);await a.settle();const walk=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)];walk(a.render()).find(n=>n.props?.['aria-label']==='면담 프로젝트').props.onChange({target:{value:'gostop'}});a.render();await a.settle();a.edit('meeting-instruction','고스톱 프로젝트에 남겨둔 미전송 지시');const b=harness(storage);await b.settle();await b.settle();assert.equal(b.calls.at(-1).projectId,'gostop');assert.equal(b.value('meeting-instruction'),'고스톱 프로젝트에 남겨둔 미전송 지시');});

test('lost response in report A cannot silently redirect a newly selected report B',async()=>{const storage=new Map(),aOrder={id:'A',projectId:'jarvis-board',stage:'reported',goal:'A'},bOrder={id:'B',projectId:'jarvis-board',stage:'reported',goal:'B'};let moved,selected;
 const a=harness(storage,{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:'A'},orders:[aOrder]},async b=>{if(b.operation==='execute')throw Error('lost response');return {ok:true,json:async()=>({meeting:{id:'A-meeting',employeeId:'jarvis',projectId:'jarvis-board',orderId:'A',messages:[],proposal:''}})};});await a.settle();a.edit('meeting-instruction','A 보고의 후속 수정 지시입니다');a.click('담당에게 배정 · 수정·검토 실행');await a.settle();
 const b=harness(storage,{request:{employeeId:'jarvis',name:'자비스',token:2,orderId:'B'},orders:[aOrder,bOrder],onOrder:o=>{moved=o},onResumeDraft:id=>{selected=id}});await b.settle();assert.equal(b.calls.length,0);assert.equal(moved,undefined);assert.match(JSON.stringify(b.render()),/다른 보고에 미확인 접수/);assert.equal(JSON.parse([...storage.values()][0]).instruction,'A 보고의 후속 수정 지시입니다');assert.equal(JSON.parse([...storage.values()][0]).orderId,'A');b.click('미확인 접수의 원래 면담 열기');assert.equal(selected,'A');
});

const reportNodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(reportNodes):[node,...reportNodes(node.props?.children)];
const reportText=node=>typeof node==='string'?node:Array.isArray(node)?node.map(reportText).join(''):node?.props?reportText(node.props.children):'';
const reportOrder=(stage='reported')=>({id:'report',projectId:'jarvis-board',stage,goal:'면담 보고 개선',worker:{summary:'결과 카드가 수정되었습니다. 추가 구현 설명입니다.',findings:[],actions:[],limitations:[],evidence:[]},review:{verdict:'accepted',summary:'첫 줄\n둘째 줄\n셋째 줄\n마지막 결론까지 읽어야 합니다.',findings:['검토 근거 전체'],actions:['화면에서 결과를 확인해주세요.'],limitations:['운영 배포는 확인하지 않았습니다.'],evidence:[]}});

test('report leads with result and next action and exposes complete unmodified review through explicit disclosure',async()=>{
 const order=reportOrder(),h=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:order.id},orders:[order]});await h.settle();
 const nodes=reportNodes(h.render()),card=nodes.find(n=>n.props?.['aria-label']==='면담 업무 결과 보고');
 const details=reportNodes(card).find(n=>n.props?.className==='meeting-report-original');
 assert.ok(details);assert.equal(details.props.open,undefined);assert.match(reportText(details),/실행·검토 원문 전체 펼치기/);assert.ok(reportText(details).includes(order.review.summary));assert.match(reportText(details),/검토 근거 전체/);assert.match(reportText(details),/운영 배포는 확인하지 않았습니다/);
 const text=reportText(card);assert.ok(text.indexOf('현재 결과')<text.indexOf('지금 할 일'));assert.ok(text.indexOf('지금 할 일')<text.indexOf('실행·검토 원문 전체 펼치기'));assert.ok(reportText(details).includes('화면에서 결과를 확인해주세요'));assert.match(text,/현재 결과첫 줄/);
 const css=fs.readFileSync('components/command-room/meeting.css','utf8');assert.doesNotMatch(css,/meeting-progress[^{}]*\{[^}]*line-clamp/);
});

test('report followup opens and focuses the same instruction editor, scrolls and preserves both drafts without sending',async()=>{
 const order=reportOrder(),details={open:false},events=[],panel={scrollTop:20,getBoundingClientRect:()=>({top:10}),scrollTo:v=>events.push(['scroll',v])};
 const editor={closest:selector=>selector==='details'?details:panel,focus:v=>events.push(['focus',v]),getBoundingClientRect:()=>({top:300})};
 const h=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:order.id},orders:[order]},undefined,{querySelector:selector=>selector==='#meeting-instruction'?editor:null});await h.settle();
 h.edit('meeting-question','보존할 미전송 질문');h.edit('meeting-instruction','보존할 후속 수정 초안입니다');const before=h.calls.length;
 h.click('다음 지시');assert.equal(h.render().props['data-view'],'instruction');assert.equal(events[0][0],'focus');assert.equal(h.value('meeting-instruction'),'보존할 후속 수정 초안입니다');assert.equal(h.value('meeting-question'),'보존할 미전송 질문');assert.equal(h.calls.length,before);assert.equal(h.control('다음 지시')['aria-controls'],'meeting-instruction');
});

test('report distinguishes failed, cancelled and all active stages; active work blocks dispatch but allows drafting',async()=>{
 for(const stage of ['failed','cancelled','received','assigned','running','reviewing','building']){
  const order={...reportOrder(stage),error:stage==='failed'?'실제 검사 실패':undefined},h=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:order.id},orders:[order]});await h.settle();
  const card=reportNodes(h.render()).find(n=>n.props?.['aria-label']==='면담 업무 결과 보고'),label=reportNodes(card).find(n=>n.type==='strong');
  assert.doesNotMatch(reportText(label),/^완료/);
  if(stage==='failed')assert.match(reportText(card),/실패 · 실행 미완료.*실제 검사 실패/s);
  else if(stage==='cancelled')assert.match(reportText(label),/중단/);
  else {assert.match(reportText(label),/진행 중/);h.click('다음 지시');h.edit('meeting-instruction','진행 중에도 후속 지시 초안을 보존합니다');assert.equal(h.control('진행 중인 업무 완료 후 다음 지시 가능').disabled,true);assert.equal(h.calls.filter(c=>c.operation==='execute').length,0);}
 }
});

test('followup-needed report and unapplied candidate are not presented as applied success',async()=>{
 const order=reportOrder();order.review.verdict='needs_followup';order.execution={files:['component.tsx'],applied:false};
 const h=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:order.id},orders:[order]});await h.settle();assert.match(reportText(h.render()),/검토 완료 · 후속 조치 필요/);assert.match(reportText(h.render()),/로컬 적용 완료 기록 없음/);
});

test('dispatch handler also rejects overlapping execution when invoked directly',async()=>{
 const order=reportOrder('running'),h=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:order.id},orders:[order]});await h.settle();h.edit('meeting-instruction','진행 중인 업무와 중복 배정하면 안 됩니다');
 await h.control('진행 중인 업무 완료 후 다음 지시 가능').onClick();await h.settle();assert.equal(h.calls.filter(c=>c.operation==='execute').length,0);assert.equal(h.value('meeting-instruction'),'진행 중인 업무와 중복 배정하면 안 됩니다');
});


test('keyboard accepts both meeting hints into durable drafts without ask or execute; next Tab moves normally',async()=>{
 for(const key of ['ArrowRight','Tab']){
  const storage=new Map(),h=harness(storage);await h.settle();
  for(const id of ['meeting-question','meeting-instruction']){
   const field=h.field(id),hint=field.placeholder;
   assert.equal(hintKey(field,key),true);h.render();
   assert.equal(h.value(id),hint);
   assert.equal(hintKey(h.field(id),'Tab'),false);
   assert.equal(hintKey(h.field(id),'ArrowRight'),false);
  }
  assert.deepEqual(h.calls.map(c=>c.operation),['open']);
  const reloaded=harness(storage);await reloaded.settle();
  for(const id of ['meeting-question','meeting-instruction'])assert.equal(reloaded.value(id),h.field(id).placeholder);
  assert.deepEqual(reloaded.calls.map(c=>c.operation),['open']);
 }
});

test('meeting hint keys preserve IME, modifiers and existing input',async()=>{
 const h=harness();await h.settle();
 for(const id of ['meeting-question','meeting-instruction']){
  for(const extra of [{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true},{nativeEvent:{isComposing:true}},{nativeEvent:{keyCode:229}}]){
   assert.equal(hintKey(h.field(id),'Tab',extra),false);h.render();assert.equal(h.value(id),'');
  }
  h.edit(id,'작성 중인 한글');assert.equal(hintKey(h.field(id)),false);assert.equal(h.value(id),'작성 중인 한글');
 }
 assert.deepEqual(h.calls.map(c=>c.operation),['open']);
});

test('one fixed navigation switches report, question and instruction without sending or losing drafts',async()=>{
 const order=reportOrder(),h=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:order.id},orders:[order]});await h.settle();
 const count=h.calls.length;assert.equal(h.render().props['data-view'],'report');
 h.click('질문하기');assert.equal(h.render().props['data-view'],'question');h.edit('meeting-question','남겨둘 질문');
 h.click('다음 지시');assert.equal(h.render().props['data-view'],'instruction');h.edit('meeting-instruction','담당에게 내릴 실제 후속 지시 초안');
 h.click('보고 보기');assert.equal(h.render().props['data-view'],'report');
 h.click('다음 지시');assert.equal(h.value('meeting-instruction'),'담당에게 내릴 실제 후속 지시 초안');assert.equal(h.value('meeting-question'),'남겨둘 질문');assert.equal(h.calls.length,count);
 const nav=reportNodes(h.render()).find(n=>n.props?.className==='meeting-navigation');assert.equal(reportNodes(nav).filter(n=>n.type==='button').length,3);
});

test('returning to questions after a long conversation exposes the composer, while report starts at the result',async()=>{
 const order=reportOrder(),h=harness(new Map(),{request:{employeeId:'jarvis',name:'자비스',token:1,orderId:order.id},orders:[order]});await h.settle();
 const body={scrollTop:0,scrollHeight:1800};reportNodes(h.render()).find(n=>n.props?.className==='meeting-body').props.ref.current=body;
 h.click('질문하기');assert.equal(body.scrollTop,1800);
 h.click('보고 보기');assert.equal(body.scrollTop,0);
 h.click('다음 지시');assert.equal(body.scrollTop,0);
});
