import test from 'node:test';import assert from 'node:assert/strict';import {load} from './test-support.mjs';
const {orderDisplayGoal}=load('lib/company/order-presentation.ts');
test('repeated candidate retries retain the original user goal',()=>{const instruction='보존된 수정안의 검토·검사를 이어가줘. 원래 지시: 보존된 수정안의 검토·검사를 이어가줘. 원래 지시: QA 반복 보고를 수정해줘. 추가 조건';assert.equal(orderDisplayGoal({goal:'보존 후보 검토',instruction,parent:{action:'보존된 개발 수정안 검토·검사 다시 실행',instruction}}),'QA 반복 보고를 수정해줘');});
