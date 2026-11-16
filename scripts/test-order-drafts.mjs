import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {load,hintKey} from './test-support.mjs';

const { createOrderDraftStore, ORDER_DRAFTS_KEY, draftKey } = load('components/command-room/order-drafts.ts');
const blank = () => ({ projectId:'jarvis-board', kind:'development', instruction:'', projectManual:false });
const draft = (text, extra = {}) => ({ ...blank(), instruction:text, ...extra });
function storage() {
  const values = new Map();
  const access = () => ({getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value)});
  return {values, access};
}

test('project, kind, report and action drafts remain separate across fresh reads', () => {
  const {access} = storage();
  const store = createOrderDraftStore(access);
  const drafts = [draft('board'), draft('gostop',{projectId:'gostop'}), draft('verify',{kind:'office-render-verify'}),
    draft('report A',{parent:{parentId:'A',actionIndex:0}}), draft('report B',{parent:{parentId:'B',actionIndex:0}}),
    draft('action 1',{parent:{parentId:'A',actionIndex:1}})];
  for (const item of drafts) store.save(item);
  const reopened = createOrderDraftStore(access);
  for (const item of drafts) assert.equal(reopened.restore(item).instruction,item.instruction);
  assert.equal(reopened.restore().instruction,'action 1');
  assert.equal(reopened.restore(draft('',{projectId:'gostop',parent:{parentId:'A',actionIndex:0}})),undefined);
});

test('successful send removes only its context, including after refresh', () => {
  const {access} = storage(), store = createOrderDraftStore(access);
  const a = draft('A'), b = draft('B',{parent:{parentId:'report',actionIndex:0}});
  store.save(a); store.save(b); store.sent(b);
  const reopened = createOrderDraftStore(access);
  assert.equal(reopened.restore(b),undefined);
  assert.equal(reopened.restore(),undefined);
  assert.equal(reopened.restore(a).instruction,'A');
});

test('independent selection survives follow-up activity and clearing it does not resurrect another draft', () => {
 const {access}=storage(),store=createOrderDraftStore(access);
 const first=draft('첫 프로젝트 초안'),other=draft('다른 프로젝트 초안',{projectId:'gostop',projectManual:true});
 const followup=draft('별도 보고 초안',{parent:{parentId:'A',actionIndex:-2}});
 store.save(first);store.save(other);store.save(first);store.save(followup);
 let refreshed=createOrderDraftStore(access);
 assert.equal(refreshed.restoreIndependent().instruction,first.instruction);
 refreshed.sent(first);
 refreshed=createOrderDraftStore(access);
 assert.equal(refreshed.restoreIndependent(),undefined);
 assert.equal(refreshed.restore(other).instruction,other.instruction);
 assert.equal(refreshed.restore(followup).instruction,followup.instruction);
});

test('blocked storage access, read errors and quota errors retain a page memory draft', () => {
  for (const access of [()=>{throw Error('blocked');},()=>({getItem:()=>{throw Error('read');},setItem:()=>{throw Error('quota');}}),
    ()=>({getItem:()=>null,setItem:()=>{throw Error('quota');}})]) {
    const store = createOrderDraftStore(access), item = draft('unsent');
    assert.equal(store.restore(),undefined);
    assert.equal(store.save(item),false);
    assert.equal(store.restore().instruction,'unsent');
    store.sent(item);
    assert.equal(store.restore(item),undefined);
  }
});

test('invalid storage shapes and entries are ignored without blocking valid drafts', () => {
  for (const raw of ['{','null','true','[]','{}','{"drafts":{}}']) {
    const store = createOrderDraftStore(()=>({getItem:()=>raw,setItem:()=>{}}));
    assert.equal(store.restore(),undefined);
    assert.doesNotThrow(()=>store.save(draft('usable')));
  }
  const good = draft('valid',{parent:{parentId:'A',actionIndex:0}});
  const invalid = [null,{},draft(42),draft('x',{projectId:'unknown'}),draft('x',{kind:'unknown'}),draft('x'.repeat(1201)),
    draft('x',{parent:{parentId:'A',actionIndex:-1}}),draft('x',{parent:{parentId:'A',actionIndex:'0'}}),
    draft('x',{projectManual:'true'}),draft('x',{kind:'office-render-fix',projectId:'gostop'})];
  const store = createOrderDraftStore(()=>({getItem:()=>JSON.stringify({drafts:[...invalid,good],active:draftKey(good)}),setItem:()=>{}}));
  assert.equal(store.restore().instruction,'valid');
  assert.equal(store.restore(blank()),undefined);
});

test('stored extra parent fields cannot override the submission body; copies are isolated', () => {
  const item = draft('safe',{parent:{parentId:'A',actionIndex:0,projectId:'injected',instruction:'injected'}});
  const store = createOrderDraftStore(()=>({getItem:()=>JSON.stringify({drafts:[item],active:draftKey(item)}),setItem:()=>{}}));
  const restored = store.restore();
  assert.equal(JSON.stringify(restored.parent),JSON.stringify({parentId:'A',actionIndex:0}));
  restored.parent.parentId='changed';
  assert.equal(store.restore().parent.parentId,'A');
});

// Run the actual hook with a small state/effect driver; no browser or build is needed.
function hookHarness(store) {
  let states=[], cursor=0, effects=[], mounted=false;
  const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;
    return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useRef(initial){const i=cursor++;return states[i]??(states[i]={current:initial});},
    useEffect(fn){if(!mounted)effects.push(fn);}};
  const mod={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/command-room/use-order-draft.ts','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {module:mod,exports:mod.exports,require:name=>name==='react'?react:name==='@/lib/company/draft-sync-client'?{pullDraft:async()=>null,pushDraft(){}}:{orderDrafts:store,draftKey,ORDER_DRAFTS_KEY:'jarvis.order-drafts.v1'}});
  return {render(){cursor=0;let value=mod.exports.useOrderDraft();if(!mounted){mounted=true;for(const effect of effects)effect();cursor=0;value=mod.exports.useOrderDraft();}return value;}};
}

test('hook reopens independently and restores report drafts only when explicitly selected', () => {
  const {access}=storage(), store=createOrderDraftStore(access);
  let view=hookHarness(store).render();
  const a=draft('report A text',{projectId:'gostop',projectManual:true,parent:{parentId:'A',actionIndex:0}});
  view.save(a);
  const reopened=hookHarness(store);view=reopened.render();
  assert.equal(view.draft.instruction,'');
  assert.equal(view.draft.parent,undefined);
  view.switchTo(a);view=reopened.render();
  assert.equal(view.draft.instruction,a.instruction);
  assert.equal(view.draft.parent.parentId,'A');
  const b=draft('',{projectId:'gostop',projectManual:true,parent:{parentId:'B',actionIndex:0}});
  view.switchTo(b);view=reopened.render();assert.equal(view.draft.instruction,'');
  view.save({...b,instruction:'report B text'});
  view.switchTo(a);view=reopened.render();assert.equal(view.draft.instruction,a.instruction);
  view.switchTo(b);view=reopened.render();assert.equal(view.draft.instruction,'report B text');
});

test('failed send leaves draft available; success clears only submitted draft and resets form', () => {
  const {access}=storage(), store=createOrderDraftStore(access), harness=hookHarness(store);
  let view=harness.render();const a=draft('keep me'), b=draft('send me',{projectId:'gostop',projectManual:true});
  view.save(a);view.switchTo(b);view.save(b);
  // A failed request does not invoke sent(). Reopening still restores it.
  assert.equal(hookHarness(store).render().draft.instruction,b.instruction);
  view=harness.render();view.sent(b);view=harness.render();
  assert.equal(view.draft.instruction,'');
  assert.equal(store.restore(b),undefined);assert.equal(store.restore(a).instruction,a.instruction);
});

test('hook exposes storage failure without losing text, and explicit project choice stays manual', () => {
  const store=createOrderDraftStore(()=>{throw Error('blocked');}), harness=hookHarness(store);
  let view=harness.render();view.save(draft('local'));view=harness.render();
  assert.equal(view.durable,false);assert.equal(view.draft.instruction,'local');
  view.switchTo({...blank(),projectManual:true});view=harness.render();
  assert.equal(view.draft.projectManual,true);assert.equal(view.draft.instruction,'local');
});

function deskHarness(store, request, orders=[], send=async()=>{throw Error('offline');}) {
  let states=[],cursor=0,mounted=false,effects=[];
  const react={
    useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;
      return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useRef(initial){const i=cursor++;return states[i]??(states[i]={current:initial});},
    useEffect(fn){if(!mounted)effects.push(fn);},
  };
  const jsx=(type,props)=>({type,props});
  const compile=(file,require)=>{
    const mod={exports:{}};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,
      target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:mod,exports:mod.exports,require,
      crypto:{randomUUID:()=> '00000000-0000-0000-0000-000000000001'},fetch:send,URL,
      window:{location:{href:'http://localhost/'},history:{replaceState(){}}},
      document:{activeElement:null,addEventListener(){},removeEventListener(){}}});
    return mod.exports;
  };
  const hook=compile('components/command-room/use-order-draft.ts',name=>name==='react'?react:name==='@/lib/company/draft-sync-client'?{pullDraft:async()=>null,pushDraft(){}}:{orderDrafts:store,draftKey,ORDER_DRAFTS_KEY:'jarvis.order-drafts.v1'});
  const Desk=compile('components/command-room/OrderDesk.tsx',name=>{
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
    if(name==='./textarea-hint')return load('components/command-room/textarea-hint.ts');
    if(name==='./use-order-draft')return hook;
    if(name==='./order-followup')return load('components/command-room/order-followup.ts');
    if(name.endsWith('/projects'))return load('lib/company/projects.ts');
    if(name.endsWith('/display'))return {readableText:value=>value};
    if(name.endsWith('/order-presentation'))return {ORDER_LABELS:{received:'지시 접수',reported:'결과 보고 도착',failed:'실행 확인 필요'}};
    return {};
  }).default;
  const owner={orders,projects:[],reports:[],loaded:true,error:'',setOrders(update){owner.orders=update(owner.orders);}};
  function render(){cursor=0;let tree=Desk({owner,request,onClose(){},onReplay(){}});
    if(!mounted){mounted=true;for(const effect of effects)effect();cursor=0;tree=Desk({owner,request,onClose(){},onReplay(){}});}return tree;}
  function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);if(!node||typeof node!=='object')return [];return [node,...nodes(node.props?.children)];}
  return {render,owner,find(predicate){return nodes(render()).find(predicate);},text(){return JSON.stringify(render());}};
}
const input=ui=>ui.find(node=>node.type==='textarea');
const button=(ui,text)=>ui.find(node=>node.type==='button'&&node.props.children===text);
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const textContent=node=>Array.isArray(node)?node.map(textContent).join(''):node&&typeof node==='object'?textContent(node.props?.children):node==null?'':String(node);
const instructionHelp=ui=>textContent(ui.find(node=>node.props?.id===input(ui).props['aria-describedby']));

test('actual OrderDesk guidance and button agree at the trimmed 10 character boundary', () => {
 const {access}=storage(),ui=deskHarness(createOrderDraftStore(access),{mode:'order'});
 for(const [value,eligible] of [['',false],['123456789',false],['1234567890',true],[' 123456789 ',false],[' \t1234567890\n ',true],['          ',false],['가'.repeat(1200),true]]){
  input(ui).props.onChange({target:{value}});
  assert.equal(input(ui).props.maxLength,1200);
  assert.equal(input(ui).props['aria-describedby'],'instruction-help');
  assert.equal(button(ui,'담당 배정하고 실행').props.disabled,!eligible);
  const help=instructionHelp(ui);
  assert.match(help,/앞뒤 공백을 뺀 10자 이상/);
  assert.ok(help.includes(`현재 입력 ${value.length}/1200자`));
  assert.ok(help.includes(`앞뒤 공백 제외 ${value.trim().length}자`));
  if(eligible){assert.match(help,/입력 조건 충족/);assert.doesNotMatch(help,/더 필요/);}
  else {assert.ok(help.includes(`${10-value.trim().length}자 더 필요`));assert.doesNotMatch(help,/입력 조건 충족/);}
 }
});

test('valid input guidance does not promise execution while connection, loading or active work blocks it', async () => {
 const {access}=storage(),ui=deskHarness(createOrderDraftStore(access),{mode:'order'});
 input(ui).props.onChange({target:{value:'1234567890'}});
 for(const state of [{error:'연결 오류'},{loaded:false},{orders:[{stage:'running'}]}]){
  Object.assign(ui.owner,{error:'',loaded:true,orders:[]},state);
  assert.equal(button(ui,'담당 배정하고 실행').props.disabled,true);
  assert.match(instructionHelp(ui),/입력 조건 충족/);
  assert.match(instructionHelp(ui),/연결 상태와 진행 중인 업무 등에 따라 제한/);
  assert.doesNotMatch(instructionHelp(ui),/실행 가능/);
 }
 let resolve;
 const response=new Promise(done=>{resolve=done;});
 const busy=deskHarness(createOrderDraftStore(storage().access),{mode:'order'},[],()=>response);
 input(busy).props.onChange({target:{value:' 1234567890 '}});
 button(busy,'담당 배정하고 실행').props.onClick();
 assert.equal(button(busy,'접수 중…').props.disabled,true);
 assert.match(instructionHelp(busy),/입력 조건 충족/);
 assert.match(instructionHelp(busy),/실행은.*제한/);
 resolve({ok:false,json:async()=>({error:'접수 실패'})});await settle();
});

test('actual order desk preserves failed submission and only clears on server success, keeping assignment payload', async () => {
  const {access}=storage(),store=createOrderDraftStore(access),other=draft('other project',{projectId:'gostop',projectManual:true});
  store.save(other);store.save(draft(''));
  const calls=[];let ok=false;
  const item={id:'created',projectId:'jarvis-board',kind:'development',stage:'received',goal:'test',instruction:'실제 지시문을 전송하고 검사를 진행해줘',assignee:'본사 개발 담당',events:[]};
  const ui=deskHarness(store,{mode:'order'},[],async(_url,options)=>{
    calls.push(JSON.parse(options.body));return {ok,json:async()=>ok?{item}:{error:'접수 실패'}};
  });
  input(ui).props.onChange({target:{value:item.instruction}});
  button(ui,'담당 배정하고 실행').props.onClick();await settle();
  assert.equal(input(ui).props.value,item.instruction);
  assert.match(ui.text(),/접수 실패/);
  assert.equal(deskHarness(store,{mode:'order'}).find(node=>node.type==='textarea').props.value,item.instruction);
  ok=true;button(ui,'담당 배정하고 실행').props.onClick();await settle();
  assert.equal(calls[0].requestId,calls[1].requestId);
  assert.equal(calls[1].instruction,item.instruction);
  assert.equal(calls[1].projectId,'jarvis-board');assert.equal(calls[1].kind,'development');
  assert.equal(store.restore(blank()),undefined);
  assert.equal(store.restore(other).instruction,other.instruction);
  assert.equal(ui.owner.orders[0].id,item.id);
  assert.match(ui.text(),/본사에서 직원 보기/);
});

test('actual report follow-up restores its draft and parent after returning from headquarters', () => {
  const {access}=storage(),store=createOrderDraftStore(access);
  const independent=draft('본사에서 보관한 별도 업무 지시문',{projectManual:true});
  store.save(independent);
  const report=id=>({id,projectId:'gostop',kind:'development',stage:'reported',goal:id,assignee:'개발 담당',events:[],
    review:{summary:'검토 결과',verdict:'accepted',actions:[],findings:[],evidence:[],limitations:[]}});
  const reports=[report('A'),report('B')];
  let ui=deskHarness(store,{mode:'result',id:'A'},reports);
  button(ui,'이 업무에 추가 개발 지시').props.onClick();
  input(ui).props.onChange({target:{value:'A 보고에서 이어서 작성하던 지시문'}});
  ui=deskHarness(store,{mode:'order'},reports);
  assert.equal(input(ui).props.value,independent.instruction);
  assert.doesNotMatch(ui.text(),/이전 보고:/);assert.match(ui.text(),/미전송 초안 보관/);
  assert.equal(ui.find(node=>node.props?.['aria-label']==='개발 프로젝트').props.disabled,false);
  ui=deskHarness(store,{mode:'result',id:'B'},reports);
  button(ui,'이 업무에 추가 개발 지시').props.onClick();assert.equal(input(ui).props.value,'');
  input(ui).props.onChange({target:{value:'B 보고의 독립된 지시문'}});
  ui=deskHarness(store,{mode:'result',id:'A'},reports);
  button(ui,'이 업무에 추가 개발 지시').props.onClick();assert.equal(input(ui).props.value,'A 보고에서 이어서 작성하던 지시문');
  assert.equal(store.restore().parent.parentId,'A');assert.equal(store.restore().projectId,'gostop');
  button(ui,'별도 새 업무 작성').props.onClick();
  assert.equal(input(ui).props.value,independent.instruction);
  assert.doesNotMatch(ui.text(),/이전 보고:/);
  assert.equal(store.restore({...blank(),projectId:'gostop',parent:{parentId:'A',actionIndex:-2}}).instruction,'A 보고에서 이어서 작성하던 지시문');
});

test('new desk restores the last independent project/kind/manual choice across refresh and blocked storage', () => {
 for(const blocked of [false,true]){
  const {access}=storage();
  let store=createOrderDraftStore(blocked?()=>{throw Error('blocked');}:access);
  const independent=draft('따로 보관한 읽기 전용 조사 지시문',{kind:'qa-source-readonly',projectManual:true});
  store.save(independent);
  const report={id:'A',projectId:'gostop',kind:'development',stage:'reported',goal:'보고',events:[],
   review:{summary:'결과',actions:[],findings:[],evidence:[],limitations:[]}};
  let ui=deskHarness(store,{mode:'result',id:'A'},[report]);
  button(ui,'이 업무에 추가 개발 지시').props.onClick();
  input(ui).props.onChange({target:{value:'새로고침 후에도 남겨야 할 후속 초안'}});
  if(!blocked)store=createOrderDraftStore(access);
  ui=deskHarness(store,{mode:'order'},[report]);
  assert.equal(input(ui).props.value,independent.instruction);
  assert.equal(store.restore().kind,independent.kind);
  assert.equal(store.restore().projectManual,true);
  assert.equal(ui.find(node=>node.type==='select').props.disabled,false);
  assert.doesNotMatch(ui.text(),/이전 보고:/);
  ui=deskHarness(store,{mode:'result',id:'A'},[report]);
  button(ui,'이 업무에 추가 개발 지시').props.onClick();
  assert.equal(input(ui).props.value,'새로고침 후에도 남겨야 할 후속 초안');
  assert.equal(store.restore().parent.actionIndex,-2);
  assert.equal(store.restore().projectId,'gostop');
 }
});

test('new desk without an independent draft starts unlocked and retains the report draft after refresh', () => {
 const {access}=storage(),store=createOrderDraftStore(access);
 const followup=draft('기존 보고 후속 초안',{projectId:'gostop',parent:{parentId:'A',actionIndex:-2},projectManual:true});
 store.save(followup);
 const refreshed=createOrderDraftStore(access),ui=deskHarness(refreshed,{mode:'order'});
 assert.equal(input(ui).props.value,'');
 assert.equal(ui.find(node=>node.props?.['aria-label']==='개발 프로젝트').props.disabled,false);
 assert.equal(ui.find(node=>node.props?.['aria-label']==='개발 프로젝트').props.value,'jarvis-board');
 assert.doesNotMatch(ui.text(),/이전 보고:/);
 assert.equal(refreshed.restore(followup).instruction,followup.instruction);
});

test('legacy storage recovers independent drafts without treating the active report as a new order', () => {
 const {access,values}=storage(),independent=draft('예전 형식으로 보관한 고스톱 지시',{projectId:'gostop',projectManual:true});
 const followup=draft('보고의 후속 지시',{parent:{parentId:'A',actionIndex:-2}});
 values.set(ORDER_DRAFTS_KEY,JSON.stringify({active:draftKey(followup),drafts:[independent,followup]}));
 const store=createOrderDraftStore(access),ui=deskHarness(store,{mode:'order'});
 assert.equal(input(ui).props.value,independent.instruction);
 assert.equal(ui.find(node=>node.props?.['aria-label']==='개발 프로젝트').props.value,'gostop');
 assert.equal(store.restore().projectManual,true);
 assert.equal(store.restore().parent,undefined);
 assert.equal(store.restore(followup).instruction,followup.instruction);
});

test('actual new order submission excludes report ancestry and preserves its follow-up draft', async () => {
 const {access}=storage(),store=createOrderDraftStore(access),calls=[];
 const independent=draft('본사의 새 독립 개발 지시를 처리해줘');
 const followup=draft('보고에 다시 돌아와 이어 쓸 내용',{projectId:'gostop',parent:{parentId:'A',actionIndex:-2},projectManual:true});
 store.save(independent);store.save(followup);
 const ui=deskHarness(store,{mode:'order'},[],async(_url,options)=>{
  calls.push(JSON.parse(options.body));
  return {ok:true,json:async()=>({item:{id:'new',stage:'received',projectId:'jarvis-board',events:[]}})};
 });
 button(ui,'담당 배정하고 실행').props.onClick();await settle();
 assert.equal(calls.length,1);
 assert.equal(calls[0].instruction,independent.instruction);
 assert.equal(calls[0].projectId,'jarvis-board');
 assert.equal(calls[0].kind,'development');
 assert.equal(Object.hasOwn(calls[0],'parentId'),false);
 assert.equal(Object.hasOwn(calls[0],'actionIndex'),false);
 assert.equal(store.restore(independent),undefined);
 assert.equal(createOrderDraftStore(access).restore(followup).instruction,followup.instruction);
});

test('storage failure warning survives closing and reopening the actual desk', () => {
  const store=createOrderDraftStore(()=>{throw Error('blocked');});
  let ui=deskHarness(store,{mode:'order'});
  input(ui).props.onChange({target:{value:'저장소 차단 상태에서도 보관할 지시문'}});
  ui=deskHarness(store,{mode:'order'});
  assert.equal(input(ui).props.value,'저장소 차단 상태에서도 보관할 지시문');
  assert.match(ui.text(),/현재 페이지에만 보관/);
});

test('late success cannot remove text edited after reopening the actual desk', async () => {
  const {access}=storage(),store=createOrderDraftStore(access);
  let resolve;
  const response=new Promise(done=>{resolve=done;});
  const first=deskHarness(store,{mode:'order'},[],()=>response);
  input(first).props.onChange({target:{value:'전송 당시 작성한 원래 지시문'}});
  button(first,'담당 배정하고 실행').props.onClick();
  const reopened=deskHarness(store,{mode:'order'});
  input(reopened).props.onChange({target:{value:'본사에서 돌아와 새로 보완한 지시문'}});
  resolve({ok:true,json:async()=>({item:{id:'sent',stage:'received',events:[],projectId:'jarvis-board',assignee:'개발 담당'}})});
  await settle();
  assert.equal(createOrderDraftStore(access).restore().instruction,'본사에서 돌아와 새로 보완한 지시문');
});

test('automatic project inference preserves current input and an existing target project draft', () => {
  const {access}=storage(),store=createOrderDraftStore(access);
  const gostop=draft('고스톱의 기존 미전송 내용',{projectId:'gostop',projectManual:true});
  store.save(gostop);store.save(draft('본사 지시 초안'));
  const ui=deskHarness(store,{mode:'order'});
  const text='본사와 고스톱 연동 화면을 확인해줘';
  input(ui).props.onChange({target:{value:text}});
  assert.equal(input(ui).props.value,text);
  assert.equal(store.restore(gostop).instruction,gostop.instruction);
  assert.match(ui.text(),/대상 프로젝트를 선택란에서 확인/);
  assert.equal(ui.find(node=>node.props?.['aria-label']==='개발 프로젝트').props.value,'jarvis-board');
  ui.find(node=>node.props?.['aria-label']==='개발 프로젝트').props.onChange({target:{value:'gostop'}});
  assert.equal(input(ui).props.value,gostop.instruction);
  ui.find(node=>node.props?.['aria-label']==='개발 프로젝트').props.onChange({target:{value:'jarvis-board'}});
  assert.equal(input(ui).props.value,text);
});

test('automatic inference still assigns a new Gostop instruction when that project has no draft', () => {
  const {access}=storage(),store=createOrderDraftStore(access),ui=deskHarness(store,{mode:'order'});
  input(ui).props.onChange({target:{value:'고스톱 화면의 문제를 수정하고 검사해줘'}});
  assert.equal(store.restore().projectId,'gostop');
  assert.equal(input(ui).props.value,'고스톱 화면의 문제를 수정하고 검사해줘');
});

test('Gostop follow-up keeps both project and development assignment locked to its report', () => {
  const {access}=storage(),store=createOrderDraftStore(access);
  const report={id:'gostop-report',projectId:'gostop',kind:'development',stage:'reported',goal:'보고',events:[],
    review:{summary:'결과',actions:[],findings:[],evidence:[],limitations:[]}};
  const ui=deskHarness(store,{mode:'result',id:report.id},[report]);
  button(ui,'이 업무에 추가 개발 지시').props.onClick();
  assert.equal(ui.find(node=>node.props?.['aria-label']==='개발 프로젝트').props.disabled,true);
  assert.equal(ui.find(node=>node.type==='select'&&node.props.value==='development').props.disabled,true);
  input(ui).props.onChange({target:{value:'자비스보드라는 단어가 있어도 보고 프로젝트 유지'}});
  assert.equal(store.restore().projectId,'gostop');
  assert.equal(store.restore().parent.parentId,report.id);
});

test('late success clears the reopened desk input and unsent notice together', async () => {
 const {access}=storage(),store=createOrderDraftStore(access);
 let resolve;
 const response=new Promise(done=>{resolve=done;});
 const first=deskHarness(store,{mode:'order'},[],()=>response);
 input(first).props.onChange({target:{value:'접수 응답을 기다리는 실제 지시문'}});
 button(first,'담당 배정하고 실행').props.onClick();
 const reopened=deskHarness(store,{mode:'order'});
 assert.match(reopened.text(),/미전송 초안 보관/);
 resolve({ok:true,json:async()=>({item:{id:'sent',stage:'received',events:[],projectId:'jarvis-board',assignee:'개발 담당'}})});
 await settle();
 assert.equal(input(reopened).props.value,'');
 assert.doesNotMatch(reopened.text(),/미전송 초안 보관/);
});


const followupReport=(overrides={})=>({id:'source',projectId:'gostop',kind:'development',stage:'reported',goal:'안내 수정',instruction:'안내 문구를 수정해줘',assignee:'개발 담당',events:[],
  review:{summary:'코드 검토 결과',verdict:'accepted',actions:['실제 브라우저에서 게임 화면과 동작을 확인해줘'],findings:[],evidence:[],limitations:[]},...overrides});

test('legacy report prose never automatically starts development; explicit instruction keeps project and parent', async () => {
 for(const action of ['브라우저에서 확인해줘','수정 필요 여부만 확인해줘','화면 오류 수정 및 브라우저 확인','오류를 수정한 뒤 확인하세요','삭제 후 확인','테스트를 추가 실행하세요']){
  const {access}=storage(),store=createOrderDraftStore(access),calls=[];
  const source=followupReport({review:{summary:'검토',verdict:'accepted',actions:[action],findings:[],evidence:[],limitations:[]}});
  const ui=deskHarness(store,{mode:'result',id:source.id},[source],async(_url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({item:followupReport({id:'child',stage:'received'})})};});
  assert.equal(button(ui,'이 조치 실행'),undefined);
  button(ui,'본사로 돌아가기').props.onClick();assert.equal(calls.length,0);
  button(ui,'수정할 내용 지시').props.onClick();assert.equal(input(ui).props.value,'');
  assert.equal(button(ui,'담당 배정하고 실행').props.disabled,true);
  input(ui).props.onChange({target:{value:'고스톱 안내 버튼의 잘못된 줄바꿈 코드를 수정해줘'}});
  button(ui,'담당 배정하고 실행').props.onClick();await settle();
  assert.equal(calls.length,1);assert.equal(calls[0].kind,'development');assert.equal(calls[0].projectId,'gostop');assert.equal(calls[0].parentId,source.id);assert.equal(calls[0].actionIndex,0);
 }
});

test('empty failed candidate cannot be resumed or described as preserved; original record remains',()=>{
 const {access}=storage(),store=createOrderDraftStore(access);
 const source=followupReport({stage:'failed',error:'수정 파일 없음',parent:{id:'p',actionIndex:0,action:'브라우저 확인'},execution:{files:[],beforeHash:'snapshot',modelCalls:1,applied:false}});
 const original=JSON.stringify(source),ui=deskHarness(store,{mode:'result',id:source.id},[source]);
 assert.match(ui.text(),/수정 파일 없음 · 보존된 수정안 없음/);
 assert.equal(button(ui,'보존된 수정안 검토·검사 이어가기'),undefined);assert.equal(JSON.stringify(source),original);
});

test('actual preserved changes can resume; prose never bypasses the instruction boundary',async()=>{
 const {canAssignFollowup}=load('components/command-room/order-followup.ts');
 const source=followupReport({stage:'failed',execution:{files:['lib/widget.dart'],beforeHash:'snapshot',applied:false,modelCalls:1}});
 assert.equal(canAssignFollowup(source,-1),true);assert.equal(canAssignFollowup({...source,execution:{...source.execution,files:[]}},-1),false);assert.equal(canAssignFollowup(source,0),false);
 const {access}=storage(),store=createOrderDraftStore(access),calls=[];
 const ui=deskHarness(store,{mode:'result',id:source.id},[source],async(_url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({item:followupReport({id:'retry',stage:'received'})})};});
 button(ui,'보존된 수정안 검토·검사 이어가기').props.onClick();await settle();assert.equal(calls[0].actionIndex,-1);
});
test('typed actions preserve their execution capability, including identical labels',()=>{
 const {followupAction,canAssignFollowup}=load('components/command-room/order-followup.ts');
 const source=followupReport({review:{actions:['후속 조치','후속 조치'],actionKinds:['browser-check','development']}});
 assert.equal(followupAction(source,'후속 조치',0),'browser');assert.equal(followupAction(source,'후속 조치',1),'development');
 assert.equal(canAssignFollowup(source,0),false);assert.equal(canAssignFollowup(source,1),true);
});


test('new and report-follow-up hint acceptance saves real drafts without assignment and releases the next Tab',()=>{
 for(const followup of [false,true])for(const key of ['ArrowRight','Tab']){
  const {access}=storage(),store=createOrderDraftStore(access),calls=[];
  const report=followupReport();
  const ui=deskHarness(store,followup?{mode:'result',id:report.id}:{mode:'order'},[report],(...args)=>{calls.push(args);throw Error('unexpected send');});
  if(followup)button(ui,'이 업무에 추가 개발 지시').props.onClick();
  const props=input(ui).props;
  for(const extra of [{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true},{nativeEvent:{isComposing:true}},{nativeEvent:{keyCode:229}}]){
   assert.equal(hintKey(props,key,extra),false);assert.equal(input(ui).props.value,'');
  }
  assert.equal(hintKey(props,key),true);
  // 예시 표지('예:')는 채우지 않는다 — 지시 제목이 예시처럼 남지 않게.
  assert.equal(input(ui).props.value,props.placeholder.replace(/^예:\s*/,''));assert.ok(!input(ui).props.value.startsWith('예'));
  assert.equal(hintKey(input(ui).props,'Tab'),false);
  assert.equal(hintKey(input(ui).props,'ArrowRight'),false);
  assert.equal(calls.length,0);
  const restored=createOrderDraftStore(access).restore();
  assert.equal(restored.instruction,props.placeholder.replace(/^예:\s*/,''));
  assert.equal(restored.parent?.parentId,followup?report.id:undefined);
  const reloaded=deskHarness(createOrderDraftStore(access),followup?{mode:'result',id:report.id}:{mode:'order'},[report]);
  if(followup)button(reloaded,'이 업무에 추가 개발 지시').props.onClick();
  assert.equal(input(reloaded).props.value,props.placeholder.replace(/^예:\s*/,''));
  input(ui).props.onChange({target:{value:'작성 중인 지시'}});
  assert.equal(hintKey(input(ui).props,key),false);assert.equal(input(ui).props.value,'작성 중인 지시');
 }
});
