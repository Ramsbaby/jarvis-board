import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './test-support.mjs';
const {parseOwnerPending,ownerPendingTasks}=load('lib/company/owner-pending.ts');
const {needsDeepReview}=load('lib/company/review-policy.ts');
const text=[
 '- [ ] 끝나지 않은 일반 지시',
 '- [!] (10-22 순찰) **위키 백업을 매일로 바꾼 것의 사후 승인:** 바뀐 건 주기뿐이다. 권고: 예(유지). — 재판정 S7 참조.',
 '- [!] **코치 기준 개선 — 주인님 승인 대기:** 열끗추천28/36. **권고: 동률에서 득점 임박도를 반영한다(무조건 피 우선 금지).** 위험: 회귀.',
 '- [!] **v99 를 주인님이 폰에서 확인해 보시면 마감**',
 '- [x] 끝난 것',
].join('\n');
test('only owner-waiting lines become decisions, with the recorded recommendation',()=>{
 const items=parseOwnerPending(text);
 assert.equal(items.length,2);
 assert.equal(items[0].title,'위키 백업을 매일로 바꾼 것의 사후 승인');
 assert.equal(items[0].advice,'예(유지)');
 assert.equal(items[0].detail,'바뀐 건 주기뿐이다.');
 assert.match(items[1].advice,/^동률에서 득점 임박도를 반영한다/);
 assert.doesNotMatch(items[1].advice,/28\/36/);
});
test('tasks are stable owner decisions and never spend AI review budget',()=>{
 const a=ownerPendingTasks(text,'2026-11-16T14:00:00.000Z'),b=ownerPendingTasks(text,'2026-11-16T15:00:00.000Z');
 assert.deepEqual(a.map(t=>t.id),b.map(t=>t.id));
 assert.ok(a.every(t=>t.state==='decision'&&t.ownerId==='secretary'&&t.id.startsWith('owner-pending:')));
 assert.match(a[0].next,/자비스 권고: 예\(유지\)/);
 assert.equal(needsDeepReview({id:'r',taskId:a[0].id,state:'decision',summary:a[0].summary,title:a[0].title,ownerId:'secretary'}),false);
 assert.equal(ownerPendingTasks('- [ ] 없음','2026-11-16T14:00:00.000Z').length,0);
});
