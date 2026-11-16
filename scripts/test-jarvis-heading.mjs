import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('components/office/OfficeScene.tsx','utf8');
// Execute the actual frame's post-movement heading branch, not a copy of its logic.
const branch=source.slice(source.indexOf("if((call.owns('jarvis')"),source.indexOf('jarvis.document.visible='));
for(const phase of ['going','returning'])test(`summoned JARVIS preserves walking heading while ${phase}`,()=>{
 const jarvis={group:{position:{x:0,z:10},rotation:{y:0}}};
 vm.runInNewContext(branch,{jarvis,jarvisWalking:true,call:{owns:()=>true},meeting:{owns:()=>false},delivery:null,trip:null,player:{group:{position:{x:0,z:13}}},Math});
 assert.equal(jarvis.group.rotation.y,0,'movement toward -Z must not be overwritten by idle +Z facing');
});
