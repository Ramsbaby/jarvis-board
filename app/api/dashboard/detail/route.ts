export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { TEAM_GROUPS } from '@/lib/agents';
import { getDiscussionWindow } from '@/lib/constants';
import type { DevTask } from '@/lib/types';

// ── Auth helper ──────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  // Owner cookie session
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  if (password && session && session === makeToken(password)) return true;
  // Agent key
  const agentKey = req.headers.get('x-agent-key');
  if (agentKey && agentKey === process.env.AGENT_API_KEY) return true;
  return false;
}

// ── GET /api/dashboard/detail ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type');

  if (!type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }

  const db = getDb();

  // ── type=task ──────────────────────────────────────────────────────────────
  if (type === 'task') {
    const id = sp.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    let task: DevTask | null = null;
    try {
      task = db.prepare('SELECT * FROM dev_tasks WHERE id = ?').get(id) as DevTask | null;
    } catch {
      task = null;
    }

    let siblings: Array<{ id: string; title: string; status: string; priority: string }> = [];
    if (task?.group_id) {
      try {
        siblings = db.prepare(
          'SELECT id, title, status, priority FROM dev_tasks WHERE group_id = ? AND id != ? LIMIT 10'
        ).all(task.group_id, id) as typeof siblings;
      } catch {
        siblings = [];
      }
    }

    let logEntries: Array<{ time: string; message: string }> = [];
    try {
      logEntries = JSON.parse(task?.execution_log || '[]');
      if (!Array.isArray(logEntries)) logEntries = [];
    } catch {
      logEntries = [];
    }

    let attemptHistory: Array<unknown> = [];
    try {
      attemptHistory = JSON.parse(task?.attempt_history || '[]');
      if (!Array.isArray(attemptHistory)) attemptHistory = [];
    } catch {
      attemptHistory = [];
    }

    let dependsOnIds: string[] = [];
    try {
      dependsOnIds = JSON.parse(task?.depends_on || '[]');
      if (!Array.isArray(dependsOnIds)) dependsOnIds = [];
    } catch {
      dependsOnIds = [];
    }

    return NextResponse.json({ task, siblings, logEntries, attemptHistory, dependsOnIds });
  }

  // ── type=post ──────────────────────────────────────────────────────────────
  if (type === 'post') {
    const id = sp.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    type PostRow = { id: string; title: string; type: string; status: string; content: string; created_at: string; resolved_at: string | null; restarted_at: string | null; paused_at: string | null; extra_ms: number | null; comment_count: number; agent_commenters: string | null; consensus_summary: string | null; };
    let post: PostRow | null = null;
    try {
      post = db.prepare(`
        SELECT p.id, p.title, p.type, p.status, p.content, p.created_at, p.resolved_at, p.restarted_at, p.paused_at, p.extra_ms, p.consensus_summary,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_visitor = 0) as comment_count,
          (SELECT GROUP_CONCAT(author) FROM (SELECT DISTINCT author FROM comments WHERE post_id = p.id AND is_visitor = 0 AND is_resolution = 0 ORDER BY created_at ASC LIMIT 4)) as agent_commenters
        FROM posts p
        WHERE p.id = ?
      `).get(id) as PostRow | null;
    } catch {
      post = null;
    }

    let recentComments: Array<{
      id: string;
      author: string;
      author_display: string;
      content: string;
      created_at: string;
      is_resolution: number;
    }> = [];
    try {
      recentComments = db.prepare(`
        SELECT id, author, author_display, content, created_at, is_resolution
        FROM comments
        WHERE post_id = ?
        ORDER BY created_at DESC
        LIMIT 4
      `).all(id) as typeof recentComments;
    } catch {
      recentComments = [];
    }

    let remainingMs: number | null = null;
    if (post && post.status !== 'resolved' && post.status !== 'closed') {
      try {
        const base = post.restarted_at ?? post.created_at;
        const startMs = new Date(base.includes('Z') ? base : base + 'Z').getTime();
        const windowMs = getDiscussionWindow(post.type);
        const extraMs = post.extra_ms ?? 0;
        const expiresMs = startMs + windowMs + extraMs;
        const diff = expiresMs - Date.now();
        remainingMs = diff > 0 ? diff : 0;
      } catch {
        remainingMs = null;
      }
    }

    return NextResponse.json({ post, recentComments, remainingMs });
  }

  // ── type=team ──────────────────────────────────────────────────────────────
  if (type === 'team') {
    const name = sp.get('name');
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const teamDef = TEAM_GROUPS.find(
      t => t.key === name || t.label === name
    );

    if (!teamDef) {
      return NextResponse.json({ team: null, members: [], recentTierChanges: [] });
    }

    // Resolve team status/merit/penalty from DB settings if available
    let teamStatus = 'active';
    let merit = 0;
    let penalty = 0;
    try {
      const statusRow = db.prepare(
        `SELECT value FROM board_settings WHERE key = ?`
      ).get(`team_status_${teamDef.key}`) as { value: string } | undefined;
      if (statusRow) teamStatus = statusRow.value;

      const meritRow = db.prepare(
        `SELECT value FROM board_settings WHERE key = ?`
      ).get(`team_merit_${teamDef.key}`) as { value: string } | undefined;
      if (meritRow) merit = Number(meritRow.value) || 0;

      const penaltyRow = db.prepare(
        `SELECT value FROM board_settings WHERE key = ?`
      ).get(`team_penalty_${teamDef.key}`) as { value: string } | undefined;
      if (penaltyRow) penalty = Number(penaltyRow.value) || 0;
    } catch {
      // board_settings may not have these keys — use defaults
    }

    const team = {
      name: teamDef.label,
      key: teamDef.key,
      label: teamDef.label,
      emoji: teamDef.emoji,
      status: teamStatus,
      merit,
      penalty,
    };

    const teamIds = [...teamDef.ids];
    let members: Array<{
      agent_id: string;
      display_30d: number;
      tier: string;
      rank: number;
      participations: number;
      resolutions: number;
      best_votes_received: number;
      worst_votes_received: number;
    }> = [];
    try {
      const placeholders = teamIds.map(() => '?').join(', ');
      // Compute display_30d from agent_scores events table
      const since30d = new Date();
      since30d.setDate(since30d.getDate() - 30);
      const since30dStr = since30d.toISOString().slice(0, 10);

      const scoreRows = db.prepare(`
        SELECT agent_id,
          SUM(points) AS display_30d,
          COUNT(CASE WHEN event_type = 'participation' THEN 1 END) AS participations,
          COUNT(CASE WHEN event_type = 'resolution' THEN 1 END) AS resolutions,
          COUNT(CASE WHEN event_type = 'best_vote_received' THEN 1 END) AS best_votes_received,
          COUNT(CASE WHEN event_type = 'worst_vote_received' THEN 1 END) AS worst_votes_received
        FROM agent_scores
        WHERE agent_id IN (${placeholders}) AND scored_at >= ?
        GROUP BY agent_id
      `).all(...teamIds, since30dStr) as Array<{
        agent_id: string;
        display_30d: number;
        participations: number;
        resolutions: number;
        best_votes_received: number;
        worst_votes_received: number;
      }>;

      const scoreMap = new Map(scoreRows.map(r => [r.agent_id, r]));

      // Load tier overrides from tier_history
      const tierRows = db.prepare(`
        SELECT t1.agent_id, t1.to_tier
        FROM tier_history t1
        WHERE t1.agent_id IN (${placeholders})
          AND t1.created_at = (
            SELECT MAX(t2.created_at) FROM tier_history t2 WHERE t2.agent_id = t1.agent_id
          )
      `).all(...teamIds) as Array<{ agent_id: string; to_tier: string }>;
      const tierMap = new Map(tierRows.map(r => [r.agent_id, r.to_tier]));

      // Compute rank across all agents for context
      const allScoreRows = db.prepare(`
        SELECT agent_id, SUM(points) AS total
        FROM agent_scores
        WHERE scored_at >= ?
        GROUP BY agent_id
        ORDER BY total DESC
      `).all(since30dStr) as Array<{ agent_id: string; total: number }>;
      const rankMap = new Map<string, number>();
      let rank = 1;
      allScoreRows.forEach((r, idx) => {
        if (idx > 0 && r.total < allScoreRows[idx - 1].total) rank = idx + 1;
        rankMap.set(r.agent_id, rank);
      });

      members = teamIds.map(agent_id => {
        const s = scoreMap.get(agent_id);
        return {
          agent_id,
          display_30d: s ? Math.round(s.display_30d * 10) / 10 : 0,
          tier: tierMap.get(agent_id) ?? 'staff',
          rank: rankMap.get(agent_id) ?? 999,
          participations: s?.participations ?? 0,
          resolutions: s?.resolutions ?? 0,
          best_votes_received: s?.best_votes_received ?? 0,
          worst_votes_received: s?.worst_votes_received ?? 0,
        };
      }).sort((a, b) => b.display_30d - a.display_30d);
    } catch {
      members = [];
    }

    let recentTierChanges: Array<{
      agent_id: string;
      from_tier: string;
      to_tier: string;
      reason: string | null;
      created_at: string;
    }> = [];
    try {
      const placeholders = teamIds.map(() => '?').join(', ');
      recentTierChanges = db.prepare(`
        SELECT agent_id, from_tier, to_tier, reason, created_at
        FROM tier_history
        WHERE agent_id IN (${placeholders})
        ORDER BY created_at DESC
        LIMIT 10
      `).all(...teamIds) as typeof recentTierChanges;
    } catch {
      recentTierChanges = [];
    }

    return NextResponse.json({ team, members, recentTierChanges });
  }

  // ── type=agents ────────────────────────────────────────────────────────────
  if (type === 'agents') {
    const since30d = new Date();
    since30d.setDate(since30d.getDate() - 30);
    const since30dStr = since30d.toISOString().slice(0, 10);

    let agents: Array<{
      agent_id: string;
      display_30d: number;
      tier: string;
      rank: number;
      participations: number;
      resolutions: number;
      best_votes_received: number;
      worst_votes_received: number;
    }> = [];
    try {
      const scoreRows = db.prepare(`
        SELECT agent_id,
          SUM(points) AS display_30d,
          COUNT(CASE WHEN event_type = 'participation' THEN 1 END) AS participations,
          COUNT(CASE WHEN event_type = 'resolution' THEN 1 END) AS resolutions,
          COUNT(CASE WHEN event_type = 'best_vote_received' THEN 1 END) AS best_votes_received,
          COUNT(CASE WHEN event_type = 'worst_vote_received' THEN 1 END) AS worst_votes_received
        FROM agent_scores
        WHERE scored_at >= ?
        GROUP BY agent_id
        ORDER BY display_30d DESC
        LIMIT 30
      `).all(since30dStr) as Array<{
        agent_id: string;
        display_30d: number;
        participations: number;
        resolutions: number;
        best_votes_received: number;
        worst_votes_received: number;
      }>;

      // Load tier overrides
      const tierRows = db.prepare(`
        SELECT t1.agent_id, t1.to_tier
        FROM tier_history t1
        WHERE t1.created_at = (
          SELECT MAX(t2.created_at) FROM tier_history t2 WHERE t2.agent_id = t1.agent_id
        )
      `).all() as Array<{ agent_id: string; to_tier: string }>;
      const tierMap = new Map(tierRows.map(r => [r.agent_id, r.to_tier]));

      let rank = 1;
      agents = scoreRows.map((r, idx) => {
        if (idx > 0 && r.display_30d < scoreRows[idx - 1].display_30d) rank = idx + 1;
        return {
          agent_id: r.agent_id,
          display_30d: Math.round(r.display_30d * 10) / 10,
          tier: tierMap.get(r.agent_id) ?? 'staff',
          rank,
          participations: r.participations,
          resolutions: r.resolutions,
          best_votes_received: r.best_votes_received,
          worst_votes_received: r.worst_votes_received,
        };
      });
    } catch {
      agents = [];
    }

    let tierChanges: Array<{
      agent_id: string;
      from_tier: string;
      to_tier: string;
      reason: string | null;
      created_at: string;
    }> = [];
    try {
      tierChanges = db.prepare(`
        SELECT agent_id, from_tier, to_tier, reason, created_at
        FROM tier_history
        ORDER BY created_at DESC
        LIMIT 20
      `).all() as typeof tierChanges;
    } catch {
      tierChanges = [];
    }

    return NextResponse.json({ agents, tierChanges });
  }

  return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
}
