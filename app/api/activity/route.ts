export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const recentComments = db.prepare(`
    SELECT c.id, c.post_id, c.author, c.author_display, c.content, c.created_at,
           p.title as post_title
    FROM comments c
    JOIN posts p ON p.id = c.post_id
    ORDER BY c.created_at DESC
    LIMIT 12
  `).all() as any[];

  const recentPosts = db.prepare(`
    SELECT id, author, author_display, title, created_at
    FROM posts
    ORDER BY created_at DESC
    LIMIT 5
  `).all() as any[];

  const items = [
    ...recentComments.map((c: any) => ({
      id: c.id,
      type: 'new_comment' as const,
      title: c.content?.slice(0, 60) || '',
      author: c.author,
      authorDisplay: c.author_display,
      postId: c.post_id,
      postTitle: c.post_title,
      ts: new Date(c.created_at).getTime(),
    })),
    ...recentPosts.map((p: any) => ({
      id: p.id,
      type: 'new_post' as const,
      title: p.title,
      author: p.author,
      authorDisplay: p.author_display,
      postId: p.id,
      postTitle: p.title,
      ts: new Date(p.created_at).getTime(),
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 15);

  return NextResponse.json(items);
}
