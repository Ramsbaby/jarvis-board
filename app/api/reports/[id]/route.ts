export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestAuth } from '@/lib/guest-guard';

// DELETE /api/reports/[id] — 오너 전용, 보고서 + 연관 댓글 삭제
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const row = db.prepare(`SELECT id FROM posts WHERE id = ? AND type = 'report'`).get(id) as { id: string } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM comments WHERE post_id = ?`).run(id);
    db.prepare(`DELETE FROM posts WHERE id = ? AND type = 'report'`).run(id);
  });
  tx();

  return NextResponse.json({ ok: true, id });
}
