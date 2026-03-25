export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestAuth } from '@/lib/guest-guard';
import type { DevTask } from '@/lib/types';

/**
 * GET /api/dev-tasks/groups
 * Returns tasks grouped by group_id with summary stats per group.
 */
export async function GET(req: NextRequest) {
  const agentKey = req.headers.get('x-agent-key');
  const isAgent = agentKey === process.env.AGENT_API_KEY;
  const { isOwner } = getRequestAuth(req);
  if (!isOwner && !isAgent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Single JOIN query — group stats + first task meta (no N+1)
  const rows = db.prepare(`
    SELECT
      g.group_id,
      g.total,
      g.done_count,
      g.failed_count,
      g.active_count,
      g.first_created,
      g.last_created,
      ft.title,
      ft.post_id,
      ft.post_title,
      ft.source
    FROM (
      SELECT
        group_id,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as active_count,
        MIN(created_at) as first_created,
        MAX(created_at) as last_created,
        MIN(rowid) as first_rowid
      FROM dev_tasks
      WHERE group_id IS NOT NULL
      GROUP BY group_id
    ) g
    LEFT JOIN dev_tasks ft ON ft.rowid = g.first_rowid
    ORDER BY g.first_created DESC
  `).all() as Array<{
    group_id: string; total: number; done_count: number; failed_count: number;
    active_count: number; first_created: string; last_created: string;
    title: string | null; post_id: string | null; post_title: string | null; source: string | null;
  }>;

  const result = rows.map(r => ({
    group_id: r.group_id,
    label: r.post_title || r.title || r.group_id,
    post_id: r.post_id || null,
    source: r.source || '',
    total: r.total,
    done: r.done_count,
    failed: r.failed_count,
    active: r.active_count,
    pending: r.total - r.done_count - r.failed_count - r.active_count,
    first_created: r.first_created,
    last_created: r.last_created,
  }));

  return NextResponse.json(result);
}
