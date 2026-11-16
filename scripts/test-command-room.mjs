import test from 'node:test';
import {load} from './test-support.mjs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const temporary = mkdtempSync(join(tmpdir(), 'jarvis-command-room-test-'));
function compile(file, target) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  writeFileSync(join(temporary, target), code);
}
compile('lib/command-room/derive.ts', 'derive.cjs');
compile('lib/command-room/server.ts', 'server.cjs');
mkdirSync(join(temporary, 'map'));
compile('lib/map/team-registry.ts', 'map/team-registry.js');
compile('lib/map/cron-role.ts', 'map/cron-role.js');
compile('lib/cron-team.ts', 'cron-team.js');
writeFileSync(join(temporary, 'cron-team.js'), readFileSync(join(temporary, 'cron-team.js'), 'utf8').replace('@/lib/map/team-registry', './map/team-registry'));
compile('lib/command-room/employees.ts', 'employees.js');
writeFileSync(join(temporary, 'employees.js'), readFileSync(join(temporary, 'employees.js'), 'utf8').replace('../map/cron-role', './map/cron-role').replace('../map/team-registry', './map/team-registry').replace('../cron-team', './cron-team'));

// CommonJS extension resolution in the isolated test fixture.
writeFileSync(join(temporary, 'derive.js'), readFileSync(join(temporary, 'derive.cjs')));
const derive = require(join(temporary, 'derive.cjs'));
const server = require(join(temporary, 'server.cjs'));
const { deriveEmployees } = require(join(temporary, 'employees.js'));
const now = 1794568000;
const source = (value, freshness = 'fresh') => ({ value, source: { id: 'fixture', label: 'fixture', freshness, observedAt: new Date(now * 1000).toISOString(), detail: 'fixture' } });
const policy = source({ snapshot_max_age_seconds: 300, account_reserve_percent: 5, daily_qa_percentage_points: 3, weekly_qa_percentage_points: 25, scope_guard: { total_cases: 451 } });
const state = () => ({ jobs: {}, window_reset_anchor_epoch: now + 604800, accounting: { version: 1, entries: [], reconciliation_required: [] }, day: new Date((now + 32400) * 1000).toISOString().slice(0, 10), day_start_remaining: 100, window_start_remaining: 100, day_spent: 0, usage: { remaining_percent: 99, observed_at_epoch: now, resets_at_epoch: now + 604800 } });
function qa(value, freshness = 'fresh', processes = {}) { return derive.deriveQa(source(value, freshness), source({}), policy, processes, now); }

test('missing/error/stale sources are distinct and never read as an empty successful project', async () => {
  const missing = await server.readJsonSource(join(temporary, 'missing'), 's', 'fixture', now);
  assert.equal(missing.source.freshness, 'missing');
  const malformed = join(temporary, 'invalid.json'); writeFileSync(malformed, '{');
  assert.equal((await server.readJsonSource(malformed, 's', 'fixture', now)).source.freshness, 'error');
  const old = join(temporary, 'old.json'); writeFileSync(old, JSON.stringify({ checked_at: '2020-01-01T00:00:00Z' }));
  assert.equal((await server.readJsonSource(old, 's', 'fixture', now)).source.freshness, 'stale');
  assert.equal(qa(null).status, 'unknown');
  assert.equal(qa(state(), 'stale').status, 'unknown');
});
test('no live worker and completed work are never a completed project', () => {
  const value = state(); value.model_work_history = { previous: { state: 'closing', ended_at_epoch: now - 100 } };
  const result = qa(value);
  assert.equal(result.status, 'waiting'); assert.match(result.current, /진행 중인 검사는 없습니다/);
  assert.ok(result.evidence.some(item => item.detail.includes('프로젝트 완료를 뜻하지')));
});
test('reported active model is not process verified; local PID must match identity', async () => {
  const value = state(); value.model_work = { workers: { implementation: { state: 'active' } } };
  assert.notEqual(qa(value).status, 'running');
  value.jobs.run = { state: 'running_observation_timeout', pid: 33, process_identity: 'old' };
  assert.equal(qa(value, 'fresh', { run: { live: true, identityMatched: false } }).status, 'attention');
  assert.equal(qa(value, 'stale', { run: { live: true, identityMatched: true } }).status, 'running');
  assert.deepEqual(await server.processIdentity(process.pid, 'wrong-start'), { live: true, identityMatched: false });
});
test('needs_review yields concrete Astra next action, and source success never becomes native pass', () => {
  const value = state(); value.jobs['candidate-legal-red'] = { state: 'needs_review', exit_code: 1, evidence_kind: 'source' };
  const result = qa(value); assert.equal(result.status, 'attention'); assert.match(result.current, /법적 링크/); assert.match(result.nextOwner, /Astra/);
  value.jobs.ok = { state: 'passed_local', evidence_kind: 'source', ended_at_epoch: now };
  assert.ok(qa(value).evidence.some(item => item.detail.includes('소스 범위 실행 성공') && item.detail.includes('원본 전체 통과 아님')));
});
test('expired quota and yesterday daily baseline never assert a current budget block', () => {
  const value = state(); value.day = '2020-01-01'; value.day_spent = 100;
  assert.notEqual(qa(value).statusLabel, '예산 재개 대기');
  value.day = state().day; value.usage.observed_at_epoch = now - 301;
  assert.equal(qa(value).statusLabel, '사용량 확인 대기');
});
test('QA interval one plus outside three never becomes an account-wide QA budget block', () => {
  const value = state(); value.usage.remaining_percent = 96;
  value.accounting.entries = [
    { category: 'qa_interval_estimate', percentage_points: 1, day: value.day, window_reset_anchor_epoch: value.window_reset_anchor_epoch },
    { category: 'outside_qa_or_unattributed', percentage_points: 3 },
  ];
  const result = qa(value);
  assert.equal(result.statusLabel, '다음 작업 대기');
  assert.equal(result.facts.find(f => f.label === 'QA 구간 추정').value, '오늘 1%p / 주간 1%p');
  assert.match(result.facts.find(f => f.label === 'QA 외·미분류 누적').value, /3%p/);
  value.accounting.entries[0].percentage_points = 3;
  assert.equal(qa(value).statusLabel, '예산 재개 대기');
  value.accounting.entries[0].percentage_points = 1;value.usage.remaining_percent = 5;
  assert.equal(qa(value).statusLabel, '예산 재개 대기');
  value.jobs.failed = { state: 'needs_review' };
  assert.equal(qa(value).statusLabel, 'Astra 검토 대기');
});
test('missing ledger never labels legacy account decline QA; unknown intervals stay explicit', () => {
  const value = state();delete value.accounting;value.usage.remaining_percent = 96;
  const result = qa(value);
  assert.equal(result.statusLabel, 'QA 회계 확인 대기');
  assert.equal(result.facts.find(f => f.label === 'QA 구간 추정').value, '미확인');
  value.accounting = { version: 1, entries: [], reconciliation_required: [{ reason: 'active_qa_reset_unknown_consumption' }] };
  assert.equal(qa(value).statusLabel, 'QA 회계 정산 대기');
  assert.match(qa(value).facts.find(f => f.label === 'QA 구간 추정').value, /미정산/);
});
test('secretary network failures are not authentication demands; stale auth is historical', () => {
  const partial = { status: 'partial', sources: [{ kind: 'calendar', status: 'error' }], secretary_receipt: {} };
  assert.match(derive.deriveSecretary(source(partial)).nextOwner, /JARVIS/);
  partial.secretary_receipt = { gmail: { status: 'authentication_error' } };
  assert.match(derive.deriveSecretary(source(partial)).nextOwner, /주인님/);
  assert.match(derive.deriveSecretary(source(partial, 'stale')).nextOwner, /JARVIS/);
});
test('current work is a bounded timestamped report, not a liveness claim', () => {
  const value = { id: 'work', title: '현재 작업', objective: '목표', current: '구현', nextAction: '검증', nextOwner: 'Sol', status: 'reported_running', observedAt: new Date(now * 1000).toISOString() };
  const result = derive.deriveCurrentWork(source(value), now);
  assert.equal(result.statusLabel, '진행 보고 받음'); assert.notEqual(result.status, 'running');
  assert.equal(derive.deriveCurrentWork(source({ ...value, title: '' }), now).status, 'unknown');
  assert.equal(derive.deriveCurrentWork(source({ ...value, status: 'completed', completionEvidence: 'test passed', observedAt: new Date((now + 100) * 1000).toISOString() }), now).statusLabel, '진행 확인 필요');
  assert.equal(derive.deriveCurrentWork(source(value), now + 901).status, 'unknown');
  assert.equal(derive.deriveCurrentWork(source({ ...value, status: 'completed', completionEvidence: 'test passed' }), now + 901).statusLabel, '최근 작업 완료');
});
test('private projection masks local paths and credential assignments', () => {
  assert.ok(!derive.safeText('/Users/owner/private/path token=abc password:secret').includes('/Users'));
  assert.ok(!derive.safeText('token=abc').includes('abc'));
  const config = server.parseAutomationConfig('id = "qa"\nname = "QA"\nprompt = """\nname = "secret prompt text"\n"""\nstatus = "ACTIVE"');
  assert.equal(config.name, 'QA'); assert.equal(config.prompt, undefined);
});
test('unauthorized guest/anonymous fails before any private source or CLI is read', async () => {
  let called = false;
  assert.equal(await server.loadForOwner(false, async () => { called = true; throw Error('must never load'); }), null);
  assert.equal(called, false);
  assert.deepEqual(await server.loadForOwner(true, async () => ({ generatedAt: 'now', stations: [] })), { generatedAt: 'now', stations: [] });
});
test('actual local QA and secretary observations are adapted without paths or prompts', async () => {
  const snapshot = await server.buildCommandRoom(async () => ({ jobs: Array.from({ length: 161 }, (_, i) => ({ id: String(i), name: `automation-${i}`, enabled: true })), total: 161, hasMore: false, freshness: 'fresh', observedAt: new Date().toISOString() }));
  assert.equal(snapshot.stations.length, 4);
  assert.ok(!JSON.stringify(snapshot).includes('/Users/'));
  assert.ok(!JSON.stringify(snapshot).includes('target_thread_id'));
  assert.ok(snapshot.stations.find(s => s.id === 'codex').facts.some(f => f.value.includes('161개')));
  console.log('Actual QA:', snapshot.stations.find(s => s.id === 'qa').statusLabel);
});

test('OpenClaw shape failures preserve stale metadata and never become a fresh zero', async () => {
  const code = ts.transpileModule(readFileSync('lib/openclaw-automations.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  let payload = { jobs: [{ id: 'a', name: 'job', enabled: true, schedule: { kind: 'every', everyMs: 120000 } }], total: 161, hasMore: true };
  let clock = 0;
  const calls = [];
  function adapter() {
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, process: { env: {} }, console: { error() {} }, Date: class extends Date { static now() { return clock; } }, require(name) {
      if (name === 'child_process') return { execFile(bin, args, options, callback) { calls.push(args); callback(null, JSON.stringify(payload)); } };
      if (name === '@/lib/map/cron-human') return { cronToHuman: value => value };
      return require(name);
    } });
    return module.exports;
  }
  const api = adapter();
  const first = await api.listAutomationsSnapshot(); assert.equal(first.freshness, 'fresh'); assert.equal(first.total, 161); assert.equal(first.hasMore, true);
  assert.equal(calls[0][0], 'automations');
  clock = 31000; payload = { notJobs: [] };
  const stale = await api.listAutomationsSnapshot(); assert.equal(stale.freshness, 'stale'); assert.equal(stale.jobs.length, 1);
  const unknown = await adapter().listAutomationsSnapshot(); assert.equal(unknown.freshness, 'error'); assert.equal(unknown.jobs, null);
});

test('service worker command-room requests never write or restore cached private snapshots', async () => {
  const code = ts.transpileModule(readFileSync('app/sw.js/route.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require:n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n), process, Response });
  const script = await (await module.exports.GET()).text();
  let handler, offline = false, cacheCalls = 0;
  const self = { location: { origin: 'https://board.example' }, addEventListener(name, fn) { if (name === 'fetch') handler = fn; } };
  vm.runInNewContext(script, { self, URL, Response, fetch: async () => { if (offline) throw Error('offline'); const response=new Response('actual network', { status: 200 }); Object.defineProperty(response,'type',{value:'basic'}); return response; }, caches: { match() { cacheCalls++; return Promise.resolve(new Response('stale private snapshot')); }, open() { cacheCalls++; throw Error('cache must not open'); } } });
  for (const endpoint of ['/api/command-room?refresh=1', '/api/command-room/orders', '/api/command-room/review', '/api/events']) {
  offline = false;
  const request = new Request('https://board.example' + endpoint);
  let result;
  handler({ request, respondWith(value) { result = value; } });
  assert.equal((await result).status, 200);
  offline = true;
  handler({ request, respondWith(value) { result = value; } });
  assert.equal((await result).status, 503);
  assert.equal(cacheCalls, 0);
  }
});

test.after(() => rmSync(temporary, { recursive: true, force: true }));

test('employee motion uses fresh execution reports, never stale or future starts', () => {
 const jobs = [{ name: 'jarvis-infra-daily', enabled: true, state: { runningAtMs: now * 1000 - 1000 } }];
 const staff = freshness => deriveEmployees([], { jobs, freshness, observedAt: new Date(now * 1000).toISOString() }, now * 1000).find(e => e.id === 'infra-lead');
 assert.equal(staff('fresh').mode, 'reported');
 assert.equal(staff('stale').mode, 'unknown');
 jobs[0].state.runningAtMs = now * 1000 + 1000;
 assert.equal(staff('fresh').mode, 'waiting');
 jobs[0].state.runningAtMs = now * 1000 - 901000;
 assert.equal(staff('fresh').mode, 'waiting');
});
