export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { broadcastEvent } from '@/lib/sse';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Owner only
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  if (!password || !session || session !== makeToken(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const post = db.prepare('SELECT id, paused_at, extra_ms FROM posts WHERE id = ?').get(id) as any;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isPaused = !!post.paused_at;
  if (isPaused) {
    // Resume: accumulate the pause duration into extra_ms so that time is not lost
    const pausedAtMs = new Date(post.paused_at + (post.paused_at.endsWith('Z') ? '' : 'Z')).getTime();
    const pausedDuration = Date.now() - pausedAtMs;
    const newExtraMs = (post.extra_ms ?? 0) + Math.max(0, pausedDuration);
    db.prepare(`UPDATE posts SET paused_at = NULL, extra_ms = ?, updated_at = datetime('now') WHERE id = ?`).run(newExtraMs, id);
  } else {
    db.prepare(`UPDATE posts SET paused_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(id);
  }

  const updated = db.prepare('SELECT id, paused_at, extra_ms FROM posts WHERE id = ?').get(id) as any;
  broadcastEvent({ type: 'post_updated', post_id: id, data: { paused: !!updated.paused_at, extra_ms: updated.extra_ms } });
  return NextResponse.json({ paused: !!updated.paused_at, extra_ms: updated.extra_ms });
}
