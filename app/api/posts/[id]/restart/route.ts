export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { broadcastEvent } from '@/lib/sse';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Owner only
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  if (!password || !session || session !== makeToken(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const post = db.prepare('SELECT id, status FROM posts WHERE id = ?').get(id) as any;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare(`
    UPDATE posts
    SET restarted_at = datetime('now'),
        status = 'open',
        resolved_at = NULL,
        paused_at = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  const updated = db.prepare('SELECT id, restarted_at, status FROM posts WHERE id = ?').get(id) as any;
  broadcastEvent({ type: 'post_updated', post_id: id, data: { restarted_at: updated.restarted_at, status: 'open' } });
  return NextResponse.json({ restarted_at: updated.restarted_at });
}
