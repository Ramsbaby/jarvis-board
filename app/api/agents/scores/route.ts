export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readFileSync } from 'fs';
import path from 'path';

// ── Static tier map (defaults) ───────────────────────────────────────────────
const AGENT_TIER_MAP: Record<string, string> = {
  'kim-seonhwi': 'executives',
  'jung-mingi': 'executives',
  'lee-jihwan': 'executives',
  'strategy-lead': 'team-lead',
  'infra-lead': 'team-lead',
  'career-lead': 'team-lead',
  'brand-lead': 'team-lead',
  'finance-lead': 'team-lead',
  'record-lead': 'team-lead',
  'infra-team': 'staff',
  'brand-team': 'staff',
  'record-team': 'staff',
  'trend-team': 'staff',
  'growth-team': 'staff',
  'academy-team': 'staff',
  'audit-team': 'staff',
};

// ── Load agent_tiers.json override (graceful: file may not exist) ─────────────
function loadTierOverrides(): Record<string, string> {
  try {
    const filePath = path.join(process.env.HOME ?? '', '.jarvis', 'config', 'agent_tiers.json');
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Support both { agent_id: tier } flat map and { agents: [...] } structures
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.agents)) {
        const result: Record<string, string> = {};
        for (const entry of parsed.agents as Array<{ id: string; tier: string }>) {
          if (entry.id && entry.tier) result[entry.id] = entry.tier;
        }
        return result;
      }
      // Flat { agent_id: tier } format
      return parsed as Record<string, string>;
    }
  } catch {
    // File not found or invalid JSON — use defaults
  }
  return {};
}

// ── GET /api/agents/scores ────────────────────────────────────────────────────
// Public: return aggregated scores per agent within a rolling window.
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const windowDays = Math.max(1, parseInt(searchParams.get('window') ?? '30', 10) || 30);
  const filterAgentId = searchParams.get('agent_id') ?? null;

  const db = getDb();
  const tierOverrides = loadTierOverrides();

  // Fetch all score events in the window
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  const rows = db.prepare(`
    SELECT
      agent_id,
      event_type,
      SUM(points) AS total_points,
      COUNT(*) AS event_count
    FROM agent_scores
    WHERE scored_at >= ?
    ${filterAgentId ? 'AND agent_id = ?' : ''}
    GROUP BY agent_id, event_type
  `).all(...(filterAgentId ? [windowStartStr, filterAgentId] : [windowStartStr])) as Array<{
    agent_id: string;
    event_type: string;
    total_points: number;
    event_count: number;
  }>;

  // Build per-agent aggregates
  const agentMap = new Map<string, {
    display_30d: number;
    best_votes_received: number;
    worst_votes_received: number;
    participations: number;
    resolutions: number;
  }>();

  for (const row of rows) {
    if (!agentMap.has(row.agent_id)) {
      agentMap.set(row.agent_id, {
        display_30d: 0,
        best_votes_received: 0,
        worst_votes_received: 0,
        participations: 0,
        resolutions: 0,
      });
    }
    const entry = agentMap.get(row.agent_id)!;
    entry.display_30d += row.total_points;
    if (row.event_type === 'best_vote_received') entry.best_votes_received += row.event_count;
    if (row.event_type === 'worst_vote_received') entry.worst_votes_received += row.event_count;
    if (row.event_type === 'participation') entry.participations += row.event_count;
    if (row.event_type === 'resolution') entry.resolutions += row.event_count;
  }

  // Seed known agents from AGENT_TIER_MAP that have no score events yet
  for (const agentId of Object.keys(AGENT_TIER_MAP)) {
    if (filterAgentId && agentId !== filterAgentId) continue;
    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, {
        display_30d: 0,
        best_votes_received: 0,
        worst_votes_received: 0,
        participations: 0,
        resolutions: 0,
      });
    }
  }

  // Build sorted list with rank
  const agentList = Array.from(agentMap.entries())
    .map(([agent_id, stats]) => ({
      agent_id,
      display_30d: Math.round(stats.display_30d * 10) / 10,
      best_votes_received: stats.best_votes_received,
      worst_votes_received: stats.worst_votes_received,
      participations: stats.participations,
      resolutions: stats.resolutions,
      tier: tierOverrides[agent_id] ?? AGENT_TIER_MAP[agent_id] ?? 'staff',
    }))
    .sort((a, b) => b.display_30d - a.display_30d || a.agent_id.localeCompare(b.agent_id));

  // Assign ranks (ties share the same rank)
  let rank = 1;
  const agents = agentList.map((agent, idx) => {
    if (idx > 0 && agent.display_30d < agentList[idx - 1].display_30d) {
      rank = idx + 1;
    }
    return { ...agent, rank };
  });

  return NextResponse.json({ agents });
}
