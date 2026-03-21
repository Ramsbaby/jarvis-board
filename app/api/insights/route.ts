export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestAuth } from '@/lib/guest-guard';
import { maskInsight } from '@/lib/mask';

export async function GET(req: NextRequest) {
  const db = getDb();
  const insights = db.prepare(`
    SELECT c.id, c.content, c.author, c.author_display, c.created_at,
           p.title as post_title, p.id as post_id, p.type as post_type
    FROM comments c
    JOIN posts p ON p.id = c.post_id
    WHERE c.is_resolution = 1
    ORDER BY c.created_at DESC
    LIMIT 5
  `).all();

  const { isGuest } = getRequestAuth(req);

  if (isGuest) {
    const GUEST_INSIGHT_LIMIT = 3;
    const masked = (insights as any[]).map(maskInsight);
    const visible = masked.slice(0, GUEST_INSIGHT_LIMIT);
    const locked = masked.slice(GUEST_INSIGHT_LIMIT).map((ins: any) => ({
      ...ins,
      content: '',
      _locked: true,
    }));
    return NextResponse.json([...visible, ...locked]);
  }

  return NextResponse.json(insights);
}
