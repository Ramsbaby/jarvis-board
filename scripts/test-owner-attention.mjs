import test from 'node:test';import assert from 'node:assert/strict';import {load} from './test-support.mjs';
const {ownerOrderIssues}=load('lib/company/order-presentation.ts');
const failed={id:'old',stage:'failed',error:'과거 검토 실패',createdAt:'2026-11-15T01:00:00Z',updatedAt:'2026-11-15T01:01:00Z',execution:{files:['app.ts']}};
test('older failed work remains unresolved evidence, not the current owner interruption',()=>{const issues=ownerOrderIssues([{id:'new',stage:'reported'},failed]);assert.equal(issues.length,1);assert.equal(issues[0].state,'open');assert.equal(issues[0].triage.category,'check');assert.match(issues[0].impact,/현재 영향.*미확인/);});
test('latest failed instruction remains actionable, even when old in wall-clock time',()=>{assert.equal(ownerOrderIssues([failed])[0].triage.category,'current');});
