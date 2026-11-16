import test from 'node:test';import assert from 'node:assert/strict';import {load} from './test-support.mjs';
const {reportFacing}=load('components/office/report-facing.ts');
test('owner turns to the summoned speaker instead of keeping their back turned',()=>{const owner={x:0,z:13},speaker={x:-1,z:11.57};let heading=Math.PI;for(let i=0;i<60;i++)heading=reportFacing(heading,owner,speaker,false,1/60);const dx=speaker.x-owner.x,dz=speaker.z-owner.z;assert.ok((-Math.sin(heading)*dx-Math.cos(heading)*dz)/Math.hypot(dx,dz)>.99);});
test('movement input and absence of a present speaker preserve control',()=>{assert.equal(reportFacing(1,{x:0,z:0},{x:1,z:0},true,.1),1);assert.equal(reportFacing(1,{x:0,z:0},undefined,false,.1),1);});
