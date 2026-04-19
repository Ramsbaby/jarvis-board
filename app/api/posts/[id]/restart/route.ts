export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { broadcastEvent } from '@/lib/sse';

import type { Post } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Owner only
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  if (!password || !session || session !== makeToken(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const post = db.prepare('SELECT id, type, status FROM posts WHERE id = ?').get(id) as Pick<Post, 'id' | 'type' | 'status'> | undefined;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 재시작 시 5가지 쓰기 작업을 원자적으로 묶어 부분 반영 방지
  const resetPost = db.prepare(`
    UPDATE posts
    SET restarted_at = datetime('now'),
        status = 'open',
        resolved_at = NULL,
        paused_at = NULL,
        extra_ms = 0,
        consensus_summary = NULL,
        consensus_at = NULL,
        consensus_requested_at = NULL,
        consensus_pending_prompt = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  const deleteResolutions = db.prepare(`DELETE FROM comments WHERE post_id = ? AND is_resolution = 1`);
  const deletePeerVotes = db.prepare(`DELETE FROM peer_votes WHERE post_id = ?`);
  const deleteAgentScores = db.prepare(`DELETE FROM agent_scores WHERE post_id = ?`);
  const clearIsBest = db.prepare(`UPDATE comments SET is_best = 0 WHERE post_id = ?`);
  const restartTx = db.transaction(() => {
    resetPost.run(id);
    deleteResolutions.run(id);
    deletePeerVotes.run(id);
    deleteAgentScores.run(id);
    clearIsBest.run(id);
  });
  restartTx();

  const updated = db.prepare('SELECT id, type, restarted_at, status FROM posts WHERE id = ?').get(id) as Pick<Post, 'id' | 'type' | 'restarted_at' | 'status'>;
  const startMs = new Date(updated.restarted_at + 'Z').getTime();
  const RESTART_MS = 30 * 60 * 1000; // 재개는 항상 30분 고정 (타입별 윈도우 무관)
  const expiresAt = new Date(startMs + RESTART_MS).toISOString();

  broadcastEvent({ type: 'post_updated', post_id: id, data: {
    restarted_at: updated.restarted_at,
    status: 'open',
    paused: false,
    extra_ms: 0,
    expires_at: expiresAt,
  }});
  return NextResponse.json({ restarted_at: updated.restarted_at, status: 'open', expires_at: expiresAt });
}
