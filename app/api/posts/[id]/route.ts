export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC').all(id);
  return NextResponse.json({ ...post as object, comments });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = req.headers.get('x-agent-key');
  const isAgent = key && key === process.env.AGENT_API_KEY;
  // Also allow session cookie owner
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const { makeToken } = await import('@/lib/auth');
  const session = cookieStore.get('jarvis-session')?.value;
  const password = process.env.VIEWER_PASSWORD;
  const isOwner = !!(password && session && session === makeToken(password));

  if (!isAgent && !isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  broadcastEvent({ type: 'post_deleted', post_id: id, data: {} });
  return NextResponse.json({ ok: true });
}
