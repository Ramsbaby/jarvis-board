import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// 기기 사이 초안 동기화 저장소. 글자만 담는다 — 중복 접수 방지 표식(askKey·executeKey)은 기기마다 따로 둔다.
// 규칙: 더 나중에 쓴 쪽(updatedAt 큰 쪽)만 저장한다. 같은 시각이면 기존 것을 유지한다.
export interface SyncedDraft { value: unknown; updatedAt: number }
export const DRAFT_KEY = /^jarvis\.(?:meeting-draft\.v1:\["[a-z0-9-]{1,80}","[a-z0-9-]{1,40}"\]|order-drafts\.v1)$/;
export const MAX_DRAFT_BYTES = 32 * 1024;

function open(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file); db.pragma('busy_timeout = 3000');
  db.exec('CREATE TABLE IF NOT EXISTS owner_drafts(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)');
  return db;
}
export function validDraftInput(key: unknown, value: unknown, updatedAt: unknown): string | null {
  if (typeof key !== 'string' || !DRAFT_KEY.test(key)) return '초안 이름 확인 필요';
  if (typeof updatedAt !== 'number' || !Number.isSafeInteger(updatedAt) || updatedAt <= 0 || updatedAt > Date.now() + 5 * 60_000) return '초안 시각 확인 필요';
  if (value === undefined || Buffer.byteLength(JSON.stringify(value)) > MAX_DRAFT_BYTES) return '초안 크기 확인 필요';
  return null;
}
export function readDraft(file: string, key: string): SyncedDraft | null {
  const db = open(file);
  try { const r = db.prepare('SELECT value, updated_at FROM owner_drafts WHERE key=?').get(key) as { value: string; updated_at: number } | undefined; return r ? { value: JSON.parse(r.value), updatedAt: r.updated_at } : null; }
  finally { db.close(); }
}
/** 더 새 초안만 반영하고, 반영 후 서버가 가진 최신 초안을 돌려준다. */
export function writeDraft(file: string, key: string, value: unknown, updatedAt: number): SyncedDraft & { stored: boolean } {
  const db = open(file);
  try {
    const stored = db.prepare(`INSERT INTO owner_drafts(key, value, updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at WHERE excluded.updated_at > owner_drafts.updated_at`).run(key, JSON.stringify(value), updatedAt).changes > 0;
    const r = db.prepare('SELECT value, updated_at FROM owner_drafts WHERE key=?').get(key) as { value: string; updated_at: number };
    return { value: JSON.parse(r.value), updatedAt: r.updated_at, stored };
  } finally { db.close(); }
}
