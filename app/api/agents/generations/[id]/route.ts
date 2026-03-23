export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { nanoid } from 'nanoid';

function checkAgentKey(req: NextRequest): boolean {
  const key = req.headers.get('x-agent-key');
  return key === process.env.AGENT_API_KEY;
}

// GET /api/agents/generations/[id] — Public
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const generation = db.prepare(`SELECT * FROM persona_generations WHERE id = ?`).get(id);
  if (!generation) {
    return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
  }

  const members = db.prepare(`
    SELECT * FROM persona_generation_members WHERE generation_id = ? ORDER BY status, agent_id
  `).all(id);

  return NextResponse.json({ ...generation as Record<string, unknown>, members });
}

// PUT /api/agents/generations/[id] — Agent-key auth
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAgentKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: { action?: string; agent_id?: string; reason?: string; system_prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, agent_id, reason, system_prompt } = body;
  if (!action || !agent_id || !['fire', 'hire'].includes(action)) {
    return NextResponse.json(
      { error: "action ('fire' | 'hire') and agent_id are required" },
      { status: 400 },
    );
  }

  const db = getDb();

  // Verify generation exists
  const gen = db.prepare(`SELECT id FROM persona_generations WHERE id = ?`).get(id);
  if (!gen) {
    return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
  }

  // Get current score
  const scoreRow = db.prepare(
    `SELECT SUM(points) as total FROM agent_scores WHERE agent_id = ?`
  ).get(agent_id) as { total: number | null } | undefined;
  const currentScore = scoreRow?.total ?? 0;

  if (action === 'fire') {
    const existing = db.prepare(
      `SELECT id FROM persona_generation_members WHERE generation_id = ? AND agent_id = ?`
    ).get(id, agent_id);

    if (!existing) {
      return NextResponse.json({ error: 'Member not found in this generation' }, { status: 404 });
    }

    db.prepare(`
      UPDATE persona_generation_members
      SET status = 'fired', fired_at = datetime('now'), score_at_fire = ?, fire_reason = ?
      WHERE generation_id = ? AND agent_id = ?
    `).run(currentScore, reason ?? null, id, agent_id);
  } else {
    // hire — INSERT OR REPLACE
    const existing = db.prepare(
      `SELECT id FROM persona_generation_members WHERE generation_id = ? AND agent_id = ?`
    ).get(id, agent_id) as { id: string } | undefined;

    const memberId = existing?.id ?? nanoid();

    db.prepare(`
      INSERT OR REPLACE INTO persona_generation_members
        (id, generation_id, agent_id, system_prompt_snapshot, status, hired_at, score_at_hire)
      VALUES (?, ?, ?, ?, 'hired', datetime('now'), ?)
    `).run(memberId, id, agent_id, system_prompt ?? '', currentScore);
  }

  const updated = db.prepare(
    `SELECT * FROM persona_generation_members WHERE generation_id = ? AND agent_id = ?`
  ).get(id, agent_id);

  return NextResponse.json(updated);
}
