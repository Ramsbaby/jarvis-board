import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import * as T from 'three';
const file=path.resolve(process.argv[2]||'components/office/actor-batches.ts');
const source=fs.readFileSync(file,'utf8');assert.ok(source.length<30000);
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
for(const stmt of ast.statements)if(ts.isImportDeclaration(stmt))assert.equal(stmt.moduleSpecifier.text,'three','Only Three.js imports permitted');
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>{assert.equal(n,'three');return T;}},{timeout:2000});
const {batchActors}=module.exports,scene=new T.Scene(),root=new T.Group();scene.add(root);root.position.set(3,0,4);
const parts=[];
for(let i=0;i<12;i++){const mat=new T.MeshStandardMaterial({color:new T.Color().setHSL(i/12,.5,.5),roughness:.82});for(const geometry of [new T.BoxGeometry(.2,.4,.6),new T.SphereGeometry(.12,16,12)]){const mesh=new T.Mesh(geometry,mat);mesh.position.set(i*.2,1,0);root.add(mesh);parts.push(mesh);}}
const batched=batchActors(scene,[root]);batched.update();const instances=scene.children.filter(x=>x.isInstancedMesh);
assert.equal(batched.partCount,24,'All parts retained');assert.ok(batched.batchCount<=2,`Expected at most2 compatible batches, got ${batched.batchCount}`);
const m=new T.Matrix4(),color=new T.Color();let seen=0;
for(const inst of instances){assert.ok(inst.instanceColor,'Per-instance colors required');for(let i=0;i<inst.count;i++){inst.getMatrixAt(i,m);inst.getColorAt(i,color);assert.ok(m.elements.every(Number.isFinite));const p=parts.find(p=>Math.abs(p.position.x+3-m.elements[12])<1e-5&&p.geometry.type===inst.geometry.type);assert.ok(p);assert.ok(color.distanceTo?color.distanceTo(p.material.color)<1e-5:Math.abs(color.r-p.material.color.r)+Math.abs(color.g-p.material.color.g)+Math.abs(color.b-p.material.color.b)<1e-5);seen++;}}
assert.equal(seen,24);parts[0].rotation.x=.6;parts[1].visible=false;batched.update();let hidden=0,rotated=0;
for(const inst of instances)for(let i=0;i<inst.count;i++){inst.getMatrixAt(i,m);if(m.elements[0]===0&&m.elements[5]===0)hidden++;if(Math.abs(m.elements[6])>.01)rotated++;}
assert.equal(hidden,1);assert.ok(rotated>0);batched.setShadows(true);assert.ok(instances.every(x=>x.castShadow));batched.setShadows(false);assert.ok(instances.every(x=>!x.castShadow));
// Different shading/alpha must not be collapsed into a white opaque material.
const s2=new T.Scene(),r2=new T.Group();s2.add(r2);for(const opacity of [1,.3])r2.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0x123456,opacity,transparent:opacity<1})));const mixed=batchActors(s2,[r2]);assert.equal(mixed.batchCount,2);
console.log(JSON.stringify({checks:8,parts:24,batches:batched.batchCount,passed:true}));
