// 브라우저 쪽 초안 동기화. 실패해도 이 기기의 초안(브라우저 저장소)은 그대로 남는다.
// 올리지 못한 초안은 "보낼 함"(브라우저 저장소)에 남겨 두고, 인터넷이 돌아오거나 화면으로 돌아오면 다시 보낸다.
// 보낼 함에 남은 초안이 있는 동안에는 다른 기기 초안으로 이 기기 글을 덮지 않는다(못 올린 글이 소리 없이 사라지지 않게).
export interface RemoteDraft<T> { value: T; updatedAt: number; mineAccepted?: boolean }
/** none=다 올라감 · pending=아직 못 올림(곧 다시 보냄) · conflict=못 올린 사이 다른 기기가 더 나중에 씀 */
export type UnsentState = 'none' | 'pending' | 'conflict';
interface Outgoing { body: string; updatedAt: number; conflict?: boolean }
const endpoint = '/api/command-room/drafts';
const OUTBOX = 'jarvis.draft-sync.outbox.v1';
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let outbox: Map<string, Outgoing> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined, failures = 0;

function box() {
  if (outbox) return outbox;
  outbox = new Map();
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(OUTBOX) || '{}') as Record<string, Outgoing>;
    for (const [k, v] of Object.entries(saved)) if (v && typeof v.body === 'string' && typeof v.updatedAt === 'number') outbox.set(k, { body: v.body, updatedAt: v.updatedAt, conflict: !!v.conflict });
  } catch { /* 저장소를 못 쓰면 이 화면 메모리에만 둔다 */ }
  return outbox;
}
function save() { try { globalThis.localStorage?.setItem(OUTBOX, JSON.stringify(Object.fromEntries(box()))); } catch { /* 메모리 사본은 유지 */ } }
function emit() { for (const l of [...listeners]) try { l(); } catch { /* 한 화면 오류가 다른 화면 동기화를 막지 않게 */ } }
function retryLater() {
  if (retryTimer || typeof setTimeout !== 'function') return;
  const wait = Math.min(60_000, 2000 * 2 ** failures++);
  retryTimer = setTimeout(() => { retryTimer = undefined; flushDrafts(); }, wait);
}
function send(key: string) {
  timers.delete(key);
  const entry = box().get(key);
  if (!entry || entry.conflict || inflight.has(key) || typeof fetch !== 'function') return;
  inflight.add(key);
  const settle = () => { inflight.delete(key); const now = box().get(key); if (now && now.updatedAt !== entry.updatedAt && !now.conflict && !timers.has(key)) send(key); };
  void fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: entry.body, keepalive: true })
    .then(async r => {
      if (r.status >= 500) { retryLater(); return; }
      const current = box().get(key);
      if (r.status === 400) { if (current?.updatedAt === entry.updatedAt) { box().delete(key); save(); } return; }
      if (!r.ok) return; // 로그인 풀림·출처 거절: 보낼 함에 둔 채 다음 접속 때 다시 보낸다.
      failures = 0;
      const d = await r.json().catch(() => null) as { draft?: { accepted?: boolean } } | null;
      if (current?.updatedAt !== entry.updatedAt) return; // 그사이 더 새 글이 생겼다 — 그것을 보낸다.
      if (d?.draft?.accepted) box().delete(key); else { current.conflict = true; emit(); }
      save();
    })
    .catch(() => retryLater())
    .finally(settle);
}
/** 입력이 잠시 멈추면(0.7초) 서버에 올린다. 못 올리면 보낼 함에 남아 다시 보낸다. */
export function pushDraft(key: string, value: unknown, updatedAt: number, delay = 700) {
  box().set(key, { body: JSON.stringify({ key, value, updatedAt }), updatedAt });
  save();
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => send(key), delay));
}
export function unsentState(key: string): UnsentState { const e = box().get(key); return !e ? 'none' : e.conflict ? 'conflict' : 'pending'; }
/** 주인님이 다른 기기 초안을 고른 경우: 이 기기의 못 올린 초안을 버린다. */
export function discardUnsent(key: string) { clearTimeout(timers.get(key)); timers.delete(key); if (box().delete(key)) save(); }
export function flushDrafts() { for (const key of [...box().keys()]) { clearTimeout(timers.get(key)); send(key); } }
/** 인터넷이 돌아오거나 이 화면으로 돌아왔을 때(휴대폰 잠금 해제·탭 전환) 다시 맞춘다. */
export function onDraftResume(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
let resumeTimer: ReturnType<typeof setTimeout> | undefined;
function resume() { clearTimeout(resumeTimer); resumeTimer = setTimeout(() => { failures = 0; flushDrafts(); emit(); }, 250); }
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushDrafts);
  window.addEventListener('online', resume);
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resume(); });
}
/** 서버 최신 초안. 이 기기에 못 올린 초안이 있으면 그것이 도착했었는지도 함께 판정해 보낼 함을 정리한다. */
export async function pullDraft<T>(key: string): Promise<RemoteDraft<T> | null> {
  const mine = box().get(key);
  try {
    const r = await fetch(`${endpoint}?key=${encodeURIComponent(key)}${mine ? `&mine=${mine.updatedAt}` : ''}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json() as { draft?: RemoteDraft<T> | null };
    const draft = d.draft && typeof d.draft.updatedAt === 'number' ? d.draft : null;
    const now = box().get(key);
    if (mine && now?.updatedAt === mine.updatedAt) {
      if (draft && (draft.mineAccepted || draft.updatedAt === mine.updatedAt)) { box().delete(key); save(); }
      else if (draft && draft.updatedAt > mine.updatedAt) { if (!now.conflict) { now.conflict = true; save(); } }
      else send(key);
    }
    return draft;
  } catch { return null; }
}
