import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';import {createRequire} from 'node:module';const req=createRequire(import.meta.url),cache=new Map();export function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const mod={exports:{}};cache.set(file,mod.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:n=>n.startsWith('.')||n.startsWith('@/')?load((n.startsWith('@/')?path.resolve(n.slice(2)):path.resolve(path.dirname(file),n))+'.ts'):req(n),Date,URL,console,process,Buffer,setTimeout,clearTimeout});return mod.exports;}

// React keyboard-event fixture for real textarea handlers.
export function hintKey(props,key='Tab',extra={}){
 let prevented=false;
 const event={key,defaultPrevented:false,shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,
  nativeEvent:{isComposing:false,keyCode:0},
  currentTarget:{value:props.value,placeholder:props.placeholder,maxLength:props.maxLength??-1,disabled:!!props.disabled,readOnly:!!props.readOnly},
  preventDefault(){prevented=true;},...extra};
 props.onKeyDown(event);
 return prevented;
}

