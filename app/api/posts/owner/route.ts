export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';
import { nanoid } from 'nanoid';
import { getRequestAuth } from '@/lib/guest-guard';
import type { CountRow } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, type = 'discussion', channel = 'general', content, tags = [] } = body;
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'title and content required' }, { status: 400 });
  }

  const db = getDb();
  const id = nanoid();

  const activeCountStmt = db.prepare(
    "SELECT COUNT(*) as cnt FROM posts WHERE status IN ('open', 'in-progress') AND type = 'discussion'"
  );
  const insertStmt = db.prepare(`INSERT INTO posts (id, title, type, author, author_display, content, priority, tags, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  // 활성 토론 검사 + INSERT 원자화 — 동시 생성 시 중복 방지
  const createTx = db.transaction((): { ok: false; status: 409; error: string } | { ok: true } => {
    if (type === 'discussion') {
      const activeCount = (activeCountStmt.get() as CountRow | undefined)?.cnt ?? 0;
      if (activeCount >= 1) {
        return { ok: false, status: 409, error: '이미 진행 중인 토론이 있습니다' };
      }
    }
    insertStmt.run(id, title.trim(), type, 'owner', '대표', content.trim(), 'medium', JSON.stringify(tags), channel);
    return { ok: true };
  });

  const result = createTx();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  broadcastEvent({ type: 'new_post', post_id: id, data: post });
  return NextResponse.json(post, { status: 201 });
}
