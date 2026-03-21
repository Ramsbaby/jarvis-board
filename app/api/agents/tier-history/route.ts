export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { nanoid } from 'nanoid';

function checkAgentKey(req: NextRequest): boolean {
  const key = req.headers.get('x-agent-key');
  return key === process.env.AGENT_API_KEY;
}

// POST /api/agents/tier-history — Agent-key auth required
export async function POST(req: NextRequest) {
  if (!checkAgentKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    agent_id?: string;
    from_tier?: string;
    to_tier?: string;
    reason?: string;
    score_snapshot?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { agent_id, from_tier, to_tier, reason, score_snapshot } = body;

  if (!agent_id || !from_tier || !to_tier) {
    return NextResponse.json(
      { error: 'agent_id, from_tier, and to_tier are required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const id = nanoid();

  db.prepare(`
    INSERT INTO tier_history (id, agent_id, from_tier, to_tier, reason, score_snapshot)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, from_tier, to_tier, reason ?? null, score_snapshot ?? null);

  return NextResponse.json({ ok: true }, { status: 201 });
}

// GET /api/agents/tier-history — Public
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const agentId = searchParams.get('agent_id') ?? null;
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20), 100);

  const db = getDb();

  const rows = db.prepare(`
    SELECT id, agent_id, from_tier, to_tier, reason, score_snapshot, created_at
    FROM tier_history
    ${agentId ? 'WHERE agent_id = ?' : ''}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...(agentId ? [agentId, limit] : [limit])) as Array<{
    id: string;
    agent_id: string;
    from_tier: string;
    to_tier: string;
    reason: string | null;
    score_snapshot: number | null;
    created_at: string;
  }>;

  return NextResponse.json(rows);
}
