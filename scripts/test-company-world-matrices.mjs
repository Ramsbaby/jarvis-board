import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {load} from './test-support.mjs';
const require=createRequire(import.meta.url),T=require('three'),{prepareCompanyWorld}=load('components/office/company-world-matrices.ts'),{batchActors}=load('components/office/actor-batches.ts');
test('static building and light matrices stay correct while actors, contact shadows and document poses keep updating',()=>{
 const scene=new T.Scene(),wall=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),sun=new T.DirectionalLight(),actor=new T.Group(),limb=new T.Group(),document=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),contact=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial());
 wall.position.set(3,4,5);sun.position.set(-24,38,22);scene.add(wall,sun,actor);actor.add(limb,contact);limb.add(document);const batch=batchActors(scene,[actor]);prepareCompanyWorld(scene);
 const wallMatrix=wall.matrixWorld.clone(),sunMatrix=sun.matrixWorld.clone();let staticUpdates=0;wall.updateMatrix=()=>staticUpdates++;
 for(let i=0;i<10;i++){actor.position.x=i/3;limb.rotation.x=i/10;document.visible=i%2===0;batch.update();assert.equal(contact.matrixWorld.elements[12],i/3);assert.ok(wall.matrixWorld.equals(wallMatrix));assert.ok(sun.matrixWorld.equals(sunMatrix));const inst=scene.children.find(o=>o.isInstancedMesh),m=new T.Matrix4();inst.getMatrixAt(0,m);if(document.visible)assert.ok(m.elements.every((n,j)=>Math.abs(n-document.matrixWorld.elements[j])<1e-6));else assert.equal(m.elements[0],0);}
 assert.equal(scene.matrixWorldAutoUpdate,false);assert.equal(staticUpdates,0);
});
