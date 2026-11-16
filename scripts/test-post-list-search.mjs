import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real component with deterministic hooks, timers and deferred fetches.
const source = ts.transpileModule(fs.readFileSync('components/PostList.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

function mount(initialPosts = [], params = '') {
  const slots = [], effects = [], timers = new Map(), requests = [];
  let index = 0, dirty = false, tree, timerId = 0;
  let intersect;
  const subscribe = () => () => {};
  const searchParams = new URLSearchParams(params);
  const react = {
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => {
        const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; }
      }];
    },
    useRef(value) { const i = index++; return slots[i] ??= { current: value }; },
    useMemo(fn) { index++; return fn(); },
    useEffect(fn, deps) {
      const i = index++, old = slots[i];
      if (!old || deps.some((dep, j) => !Object.is(dep, old.deps[j]))) {
        slots[i] = { deps, cleanup: old?.cleanup };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
    Suspense: ({ children }) => children,
  };
  const jsx = (type, props) => {
    if (props?.ref && typeof props.ref === 'object') props.ref.current = {};
    return typeof type === 'function' ? type(props) : { type, props };
  };
  const constants = { AUTHOR_META: {}, TYPE_LABELS: {}, TYPE_ICON: {}, PRIORITY_BADGE: {}, STATUS_DOT: {}, getDiscussionWindow: () => 3600000 };
  const exports = {};
  vm.runInNewContext(source, {
    exports, AbortController, URLSearchParams, Date,
    window: {}, localStorage: { getItem: () => null },
    setInterval: () => 0, clearInterval: () => {},
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id),
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { intersect = this.callback; }
      disconnect() { if (intersect === this.callback) intersect = undefined; }
    },
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { useSearchParams: () => searchParams, useRouter: () => ({ replace() {} }) };
      if (name === 'next/link') return { default: ({ children, ...props }) => jsx('a', { ...props, children }) };
      if (name === '@/lib/constants') return constants;
      if (name === '@/lib/utils') return { timeAgo: () => '', truncate: value => value };
      if (name === '@/contexts/EventContext') return { useEvent: () => ({ subscribe }) };
      return { default: () => null };
    },
  });
  function render() {
    do {
      dirty = false; index = 0;
      tree = exports.default({ initialPosts, authorMeta: {}, stats: { open: 0, inProgress: 0, resolved: 0 } });
      effects.splice(0).forEach(fn => fn());
    } while (dirty);
  }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(child => nodes(child));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children ?? null)];
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(child => text(child)).join('');
    if (!node || typeof node === 'boolean') return '';
    return typeof node === 'object' ? text(node.props?.children ?? null) : String(node);
  }
  render();
  return {
    requests, text: () => text(tree),
    intersect() { intersect?.([{ isIntersecting: true }]); render(); },
    query(value) { nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value } }); render(); },
    debounce() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    click(label) { const button = nodes(tree).find(node => node.type === 'button' && text(node) === label); assert.ok(button, label); button.props.onClick(); render(); },
    async settle() { for (let i = 0; i < 6; i++) await Promise.resolve(); render(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

const response = posts => ({ ok: true, json: async () => ({ posts }) });

test('HTTP failure shows an error and retry, never a successful empty result', async () => {
  const ui = mount();
  ui.query('검색'); ui.debounce();
  ui.requests[0].resolve({ ok: false, status: 500 }); await ui.settle();
  assert.match(ui.text(), /검색에 실패했습니다/);
  assert.doesNotMatch(ui.text(), /검색 결과가 없습니다|검색 결과 0개/);
  ui.click('다시 시도');
  assert.match(ui.text(), /검색 중/);
  ui.debounce();
  assert.equal(ui.requests[1].url, ui.requests[0].url);
  ui.requests[1].resolve(response([])); await ui.settle();
  assert.match(ui.text(), /검색 결과가 없습니다/);
  ui.unmount();
});

test('an older response cannot end loading or overwrite the newest result', async () => {
  const ui = mount();
  ui.query('old'); ui.debounce();
  ui.query('new'); ui.debounce();
  ui.requests[0].resolve(response([])); await ui.settle();
  assert.match(ui.text(), /검색 중/);
  assert.doesNotMatch(ui.text(), /검색 결과가 없습니다/);
  ui.requests[1].resolve(response([])); await ui.settle();
  assert.match(ui.text(), /"new" 검색 결과 0개/);
  ui.unmount();
});

for (const failure of ['network', 'json', 'shape']) {
  test(`${failure} failure is recoverable and distinct from empty results`, async () => {
    const ui = mount();
    ui.query('실패'); ui.debounce();
    if (failure === 'network') ui.requests[0].reject(new TypeError('Offline'));
    else ui.requests[0].resolve({ ok: true, json: async () => {
      if (failure === 'json') throw new SyntaxError('Invalid JSON');
      return { error: 'unexpected payload' };
    } });
    await ui.settle();
    assert.match(ui.text(), /검색에 실패했습니다/);
    assert.doesNotMatch(ui.text(), /검색 결과가 없습니다/);
    ui.click('다시 시도'); ui.debounce();
    ui.requests[1].resolve(response([])); await ui.settle();
    assert.match(ui.text(), /검색 결과가 없습니다/);
    ui.unmount();
  });
}

const post = (id, type = 'tech') => ({
  id, title: `제목-${id}`, type, status: 'resolved', priority: 'medium',
  author: 'owner', content: '', tags: '[]', channel: 'general',
  created_at: '2026-01-01 00:00:00', comment_count: 0,
});

test('late success or failure cannot replace a newer successful result', async () => {
  for (const staleFailure of [false, true]) {
    const ui = mount();
    ui.query('old'); ui.debounce();
    ui.query('new'); ui.debounce();
    assert.equal(ui.requests[0].options.signal.aborted, true);
    ui.requests[1].resolve(response([post('new')])); await ui.settle();
    if (staleFailure) ui.requests[0].reject(new Error('late failure'));
    else ui.requests[0].resolve(response([post('old')]));
    await ui.settle();
    assert.match(ui.text(), /제목-new/);
    assert.doesNotMatch(ui.text(), /제목-old|검색에 실패했습니다/);
    ui.unmount();
  }
});

test('clearing search restores existing filters and ignores late responses', async () => {
  const ui = mount([post('tech'), post('ops', 'ops')], 'type=tech');
  assert.match(ui.text(), /제목-tech/);
  assert.doesNotMatch(ui.text(), /제목-ops/);
  ui.query('  a & b  ');
  assert.match(ui.text(), /검색 중/);
  assert.doesNotMatch(ui.text(), /제목-tech|검색 결과가 없습니다/);
  ui.debounce();
  assert.equal(ui.requests[0].url, '/api/posts?search=a%20%26%20b');
  ui.query('   ');
  assert.equal(ui.requests[0].options.signal.aborted, true);
  ui.requests[0].resolve(response([post('late')])); await ui.settle();
  assert.match(ui.text(), /제목-tech/);
  assert.doesNotMatch(ui.text(), /제목-ops|제목-late|검색 중/);
  ui.unmount();
});

test('debouncing cancels unsent requests and unmount aborts pending requests', async () => {
  const ui = mount();
  ui.query('first'); ui.query('second'); ui.debounce();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].url, '/api/posts?search=second');
  ui.unmount();
  assert.equal(ui.requests[0].options.signal.aborted, true);
  ui.requests[0].reject(new Error('aborted')); await ui.settle();
  assert.doesNotMatch(ui.text(), /검색에 실패했습니다/);
});

for (const failure of ['http', 'network', 'json', 'shape']) {
  test(`pagination ${failure} failure preserves posts and cursor until manual retry`, async () => {
    const ui = mount(Array.from({ length: 50 }, (_, i) => post(String(i))));
    ui.intersect();
    assert.match(ui.text(), /더 불러오는 중/);
    ui.intersect();
    assert.equal(ui.requests.length, 1, 'duplicate observer callbacks must not send duplicate requests');
    if (failure === 'network') ui.requests[0].reject(new Error('offline'));
    else ui.requests[0].resolve({ ok: failure !== 'http', json: async () => {
      if (failure === 'json') throw new SyntaxError('invalid json');
      return { error: 'invalid response' };
    } });
    await ui.settle();
    assert.match(ui.text(), /더 불러오지 못했습니다/);
    assert.match(ui.text(), /제목-0/);
    assert.doesNotMatch(ui.text(), /모든 포스트를 불러왔습니다|해당 조건의 포스트가 없습니다/);
    ui.intersect();
    assert.equal(ui.requests.length, 1, 'failure must wait for manual retry');
    ui.click('다시 시도');
    assert.equal(ui.requests[1].url, ui.requests[0].url);
    assert.match(ui.text(), /더 불러오는 중/);
    ui.requests[1].resolve(response([post('next')]));
    await ui.settle();
    assert.match(ui.text(), /전체 51개/);
    assert.doesNotMatch(ui.text(), /더 불러오지 못했습니다/);
    ui.unmount();
  });
}
