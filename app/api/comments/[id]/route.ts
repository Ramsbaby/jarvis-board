export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';
import { getRequestAuth } from '@/lib/guest-guard';
import type { CommentMinimal, CommentIsBest } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = req.headers.get('x-agent-key');
  const isAgent = !!(key && key === process.env.AGENT_API_KEY);
  const { isOwner } = getRequestAuth(req);
  if (!isOwner && !isAgent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const db = getDb();

  // Content edit mode — triggered when `content` field is present in body
  if (body.content !== undefined) {
    const { content } = body;
    if (!content || content.trim().length < 5) {
      return NextResponse.json({ error: 'Too short' }, { status: 400 });
    }
    const comment = db.prepare('SELECT id, post_id FROM comments WHERE id = ?').get(id) as CommentMinimal | undefined;
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    db.prepare('UPDATE comments SET content = ? WHERE id = ?').run(content.trim(), id);
    broadcastEvent({
      type: 'comment_updated',
      post_id: comment.post_id,
      data: { id, content: content.trim() },
    });
    return NextResponse.json({ ok: true });
  }

  // is_resolution update (agent only)
  if (body.is_resolution !== undefined && isAgent) {
    const val = body.is_resolution ? 1 : 0;
    db.prepare('UPDATE comments SET is_resolution = ? WHERE id = ?').run(val, id);
    return NextResponse.json({ ok: true, is_resolution: val });
  }

  // is_best toggle — 원자적 토글 (SELECT+UPDATE race 제거)
  const toggled = db.prepare(
    'UPDATE comments SET is_best = 1 - COALESCE(is_best, 0) WHERE id = ? RETURNING is_best'
  ).get(id) as CommentIsBest | undefined;
  if (!toggled) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ is_best: toggled.is_best });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = req.headers.get('x-agent-key');
  const isAgent = !!(key && key === process.env.AGENT_API_KEY);
  const { isOwner } = getRequestAuth(req);

  if (!isAgent && !isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const comment = db.prepare('SELECT post_id FROM comments WHERE id = ?').get(id) as CommentMinimal | undefined;
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 리액션 + 대댓글 정리 + 댓글 삭제를 원자적으로 처리
  const deleteReactions = db.prepare('DELETE FROM reactions WHERE target_id = ?');
  const detachChildren = db.prepare('UPDATE comments SET parent_id = NULL WHERE parent_id = ?');
  const deleteComment = db.prepare('DELETE FROM comments WHERE id = ?');
  const deleteCommentTx = db.transaction(() => {
    deleteReactions.run(id);
    detachChildren.run(id);
    deleteComment.run(id);
  });
  deleteCommentTx();

  broadcastEvent({ type: 'comment_deleted', post_id: comment.post_id, data: { id } });
  return NextResponse.json({ ok: true });
}
