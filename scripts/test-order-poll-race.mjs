import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=fs.readFileSync('lib/company/use-owner-orders.ts','utf8');
test('a delayed poll cannot erase a successfully submitted order',async()=>{
 let cursor=0,mounted=false,poll;const cells=[],effects=[],requests=[];
 const react={startTransition:f=>f(),useState(v){const i=cursor++;if(!(i in cells))cells[i]=v;return [cells[i],v=>cells[i]=typeof v==='function'?v(cells[i]):v]},useRef(v){const i=cursor++;return cells[i]??=( {current:v})},useEffect(f){if(!mounted)effects.push(f)},useMemo:f=>f(),useCallback:f=>f};
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:n=>n==='react'?react:n.includes('poll-snapshot')?{retainSnapshot:(a,b)=>JSON.stringify(a)===JSON.stringify(b)?a:b}:{ownerOrdersProjection:()=>({}),orderDisplayGoal:o=>o.goal},document:{hidden:false,addEventListener(){},removeEventListener(){}},AbortController,setTimeout:()=>1,clearTimeout(){},setInterval:f=>{poll=f;return 1},clearInterval(){},fetch:()=>new Promise(resolve=>requests.push(resolve))});
 const render=()=>{cursor=0;const r=mod.exports.useOwnerOrders();if(!mounted){mounted=true;effects.forEach(f=>f())}return r};
 const order={id:'new',stage:'received',goal:'실제 제출된 업무'};render().setOrders(()=>[order]);
 requests.shift()({ok:true,json:async()=>({items:[],projects:[]})});await new Promise(r=>setImmediate(r));
 assert.equal(render().orders[0]?.id,'new','pre-submit GET must not overwrite accepted POST result');
 poll();requests.shift()({ok:true,json:async()=>({items:[{...order,stage:'reported'}],projects:[]})});await new Promise(r=>setImmediate(r));assert.equal(render().orders[0].stage,'reported','fresh polls must still advance status');
});
