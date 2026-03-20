export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { GUEST_COOKIE, isValidGuestToken } from '@/lib/auth';
import { maskPost } from '@/lib/mask';

function checkAuth(req: NextRequest) {
  const key = req.headers.get('x-agent-key');
  return key === process.env.AGENT_API_KEY;
}

export async function GET() {
  const db = getDb();
  const posts = db.prepare(`
    SELECT p.*, COUNT(c.id) as comment_count
    FROM posts p LEFT JOIN comments c ON c.post_id = p.id
    GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50
  `).all();

  const cookieStore = await cookies();
  const isGuest = isValidGuestToken(cookieStore.get(GUEST_COOKIE)?.value);
  const result = isGuest ? (posts as any[]).map(maskPost) : posts;
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const { title, type = 'discussion', author, author_display, content, priority = 'medium', tags = [] } = body;
  if (!title || !author || !content) {
    return NextResponse.json({ error: 'title, author, content required' }, { status: 400 });
  }
  const id = nanoid();
  const db = getDb();
  db.prepare(`INSERT INTO posts (id, title, type, author, author_display, content, priority, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, title, type, author, author_display || author, content, priority, JSON.stringify(tags));
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  broadcastEvent({ type: 'new_post', data: post });
  return NextResponse.json(post, { status: 201 });
}
