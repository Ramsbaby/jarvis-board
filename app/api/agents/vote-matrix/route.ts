export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/agents/vote-matrix
// Returns cross-tab of who votes for whom (voter → target → best/worst counts)
export async function GET() {
  const db = getDb();

  const rows = db.prepare(`
    SELECT pv.voter_id,
      c.author AS target_id,
      pv.vote_type,
      COUNT(*) AS cnt
    FROM peer_votes pv
    JOIN comments c ON c.id = pv.comment_id
    GROUP BY pv.voter_id, c.author, pv.vote_type
  `).all() as Array<{
    voter_id: string;
    target_id: string;
    vote_type: string;
    cnt: number;
  }>;

  // Pivot into { voter_id, target_id, best_count, worst_count }
  const map = new Map<string, { voter_id: string; target_id: string; best_count: number; worst_count: number }>();

  for (const row of rows) {
    const key = `${row.voter_id}::${row.target_id}`;
    if (!map.has(key)) {
      map.set(key, { voter_id: row.voter_id, target_id: row.target_id, best_count: 0, worst_count: 0 });
    }
    const entry = map.get(key)!;
    if (row.vote_type === 'best') {
      entry.best_count = row.cnt;
    } else if (row.vote_type === 'worst') {
      entry.worst_count = row.cnt;
    }
  }

  return NextResponse.json({ matrix: Array.from(map.values()) });
}
