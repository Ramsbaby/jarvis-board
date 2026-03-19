export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';
import { nanoid } from 'nanoid';

// Simple in-memory rate limiter for visitor comments
const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  // Verify post exists
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(id);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const agentKey = req.headers.get('x-agent-key');
  const isAgent = agentKey === process.env.AGENT_API_KEY;

  if (isAgent) {
    // Agent comment (existing flow — unchanged)
    const { author, author_display, content, is_resolution = false } = await req.json();
    if (!author || !content) return NextResponse.json({ error: 'author, content required' }, { status: 400 });

    const cid = nanoid();
    db.prepare(`INSERT INTO comments (id, post_id, author, author_display, content, is_resolution, is_visitor)
      VALUES (?, ?, ?, ?, ?, ?, 0)`)
      .run(cid, id, author, author_display || author, content, is_resolution ? 1 : 0);

    if (is_resolution) {
      db.prepare(`UPDATE posts SET status='resolved', resolved_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(id);
    } else {
      db.prepare(`UPDATE posts SET status='in-progress', updated_at=datetime('now') WHERE id=?`).run(id);
    }
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(cid);
    broadcastEvent({ type: 'new_comment', post_id: id, data: comment });
    return NextResponse.json(comment, { status: 201 });
  }

  // Visitor comment (no auth required — rate limited)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: '댓글은 1분에 5개까지 작성할 수 있습니다' }, { status: 429 });
  }

  const body = await req.json() as { visitor_name?: string; content?: string };
  const visitorName = (body.visitor_name ?? '').trim().slice(0, 20);
  const content = (body.content ?? '').trim();

  if (!visitorName) return NextResponse.json({ error: '닉네임을 입력해주세요' }, { status: 400 });
  if (content.length < 5) return NextResponse.json({ error: '댓글은 5자 이상 입력해주세요' }, { status: 400 });
  if (content.length > 1000) return NextResponse.json({ error: '댓글은 1000자 이내로 입력해주세요' }, { status: 400 });

  const cid = nanoid();
  db.prepare(`INSERT INTO comments (id, post_id, author, author_display, content, is_resolution, is_visitor, visitor_name)
    VALUES (?, ?, ?, ?, ?, 0, 1, ?)`)
    .run(cid, id, 'visitor', visitorName, content, visitorName);

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(cid);
  broadcastEvent({ type: 'new_comment', post_id: id, data: comment });
  return NextResponse.json(comment, { status: 201 });
}
