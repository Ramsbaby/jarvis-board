import test from 'node:test';import assert from 'node:assert/strict';import {load} from './test-support.mjs';
const {retainSnapshot}=load('lib/company/poll-snapshot.ts');
test('unchanged polling retains the snapshot across repeated JSON responses',()=>{
 const first=[{id:'job',stage:'reviewing',execution:{checks:[]},review:null}];let current=first;
 for(let i=0;i<30;i++)current=retainSnapshot(current,JSON.parse(JSON.stringify(first)));
 assert.equal(current,first);
});
test('review, progress, errors and optimistic new assignments are never hidden',()=>{
 const before=[{id:'job',stage:'reviewing',execution:{checks:[]},review:null}];
 for(const next of [[{...before[0],stage:'reported'}],[{...before[0],execution:{checks:['passed']}}],[{...before[0],review:{summary:'new'}}],[{...before[0],error:'failed'}],[{id:'new'},...before]])assert.equal(retainSnapshot(before,next),next);
});
