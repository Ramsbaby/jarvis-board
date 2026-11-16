import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function render({blocked=false,writeFailure=false,path='/',ios=false}={}){
 const states=[],mod={exports:{}};const storage={getItem:()=>null,setItem:()=>{if(writeFailure)throw Error('quota');}};
 const navigator={userAgent:ios?'iPhone':'Desktop'};const window={navigator,matchMedia:()=>({matches:false})};
 const context={window,navigator,Date,module:mod,exports:mod.exports,require:n=>n==='react'?{useEffect:()=>{},useState:init=>{const i=states.length;states.push(typeof init==='function'?init():init);return [states[i],v=>{states[i]=v}];}}:n==='next/navigation'?{usePathname:()=>path}:{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'}};
 Object.defineProperty(context,'localStorage',{get:()=>{if(blocked)throw Error('SecurityError');return storage;}});
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/SwRegister.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {tree:mod.exports.default(),states};
}
test('blocked browser storage does not crash the company root during PWA initialization',()=>{assert.equal(render({blocked:true}).tree,null);});
test('dismissal still closes the install banner if storage writes fail',()=>{
 const {tree,states}=render({writeFailure:true,path:'/other',ios:true});
 const find=n=>!n?null:Array.isArray(n)?n.map(find).find(Boolean):n.props?.['aria-label']==='닫기'?n:find(n.props?.children);
 assert.doesNotThrow(()=>find(tree).props.onClick());assert.equal(states[2],true);
});
