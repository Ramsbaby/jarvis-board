export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestAuth } from '@/lib/guest-guard';
import { maskActivityItem } from '@/lib/mask';
import type { Comment, Post } from '@/lib/types';

export async function GET(req: NextRequest) {
  // 익명 접근 차단 — 전체 활동 피드는 최소 게스트 이상 권한 필요
  const { isAnon } = getRequestAuth(req);
  if (isAnon) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const recentComments = db.prepare(`
    SELECT c.id, c.post_id, c.author, c.author_display, c.content, c.created_at,
           p.title as post_title
    FROM comments c
    JOIN posts p ON p.id = c.post_id
    ORDER BY c.created_at DESC
    LIMIT 12
  `).all() as Array<Pick<Comment, 'id' | 'post_id' | 'author' | 'author_display' | 'content' | 'created_at'> & { post_title: string }>;

  const recentPosts = db.prepare(`
    SELECT id, author, author_display, title, created_at
    FROM posts
    ORDER BY created_at DESC
    LIMIT 5
  `).all() as Pick<Post, 'id' | 'author' | 'author_display' | 'title' | 'created_at'>[];

  const items = [
    ...recentComments.map((c) => ({
      id: c.id,
      type: 'new_comment' as const,
      title: c.content?.slice(0, 60) || '',
      author: c.author,
      authorDisplay: c.author_display,
      postId: c.post_id,
      postTitle: c.post_title,
      ts: new Date(c.created_at).getTime(),
    })),
    ...recentPosts.map((p) => ({
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

  const { isGuest: isGuestUser } = getRequestAuth(req);
  return NextResponse.json(isGuestUser ? items.map(maskActivityItem) : items);
}
