// 브라우저 쪽 초안 동기화. 실패해도 이 기기의 초안(브라우저 저장소)은 그대로 남는다.
export interface RemoteDraft<T> { value: T; updatedAt: number }
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingBodies = new Map<string, string>();
const endpoint = '/api/command-room/drafts';
function send(key: string) {
  const body = pendingBodies.get(key); pendingBodies.delete(key); timers.delete(key);
  if (body && typeof fetch === 'function') void fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
}
/** 입력이 잠시 멈추면(0.7초) 서버에 올린다. 화면을 떠나면 남은 것을 즉시 올린다. */
export function pushDraft(key: string, value: unknown, updatedAt: number, delay = 700) {
  pendingBodies.set(key, JSON.stringify({ key, value, updatedAt }));
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => send(key), delay));
}
export function flushDrafts() { for (const key of [...pendingBodies.keys()]) { clearTimeout(timers.get(key)); send(key); } }
if (typeof window !== 'undefined') window.addEventListener('pagehide', flushDrafts);
export async function pullDraft<T>(key: string): Promise<RemoteDraft<T> | null> {
  try {
    const r = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json() as { draft?: RemoteDraft<T> | null };
    return d.draft && typeof d.draft.updatedAt === 'number' ? d.draft : null;
  } catch { return null; }
}
