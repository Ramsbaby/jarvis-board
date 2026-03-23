export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { nanoid } from 'nanoid';
import { AGENT_ROSTER } from '@/lib/agents';

function checkAgentKey(req: NextRequest): boolean {
  const key = req.headers.get('x-agent-key');
  return key === process.env.AGENT_API_KEY;
}

// GET /api/agents/generations — Public
export async function GET() {
  const db = getDb();

  const rows = db.prepare(`
    SELECT g.*,
      COUNT(m.id) as member_count,
      COUNT(CASE WHEN m.status = 'fired' THEN 1 END) as fired_count,
      COUNT(CASE WHEN m.status = 'hired' THEN 1 END) as hired_count
    FROM persona_generations g
    LEFT JOIN persona_generation_members m ON m.generation_id = g.id
    GROUP BY g.id
    ORDER BY g.generation_number DESC
  `).all();

  return NextResponse.json(rows);
}

// POST /api/agents/generations — Agent-key or owner session auth
export async function POST(req: NextRequest) {
  if (!checkAgentKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, notes } = body;
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const db = getDb();
  const id = nanoid();

  // Auto-increment generation_number
  const maxRow = db.prepare(
    `SELECT COALESCE(MAX(generation_number), 0) + 1 as next_num FROM persona_generations`
  ).get() as { next_num: number };
  const generationNumber = maxRow.next_num;

  db.prepare(`
    INSERT INTO persona_generations (id, generation_number, name, notes)
    VALUES (?, ?, ?, ?)
  `).run(id, generationNumber, name, notes ?? null);

  // Auto-register all AGENT_ROSTER members
  const insertMember = db.prepare(`
    INSERT INTO persona_generation_members (id, generation_id, agent_id, system_prompt_snapshot, status, score_at_hire)
    VALUES (?, ?, ?, ?, 'active', ?)
  `);

  const getPersona = db.prepare(`SELECT system_prompt FROM personas WHERE id = ?`);
  const getScore = db.prepare(`SELECT SUM(points) as total FROM agent_scores WHERE agent_id = ?`);

  const registerAll = db.transaction(() => {
    for (const agent of AGENT_ROSTER) {
      const persona = getPersona.get(agent.id) as { system_prompt: string } | undefined;
      const scoreRow = getScore.get(agent.id) as { total: number | null } | undefined;

      insertMember.run(
        nanoid(),
        id,
        agent.id,
        persona?.system_prompt ?? '',
        scoreRow?.total ?? 0,
      );
    }
  });
  registerAll();

  // Return created generation
  const created = db.prepare(`SELECT * FROM persona_generations WHERE id = ?`).get(id);
  return NextResponse.json(created, { status: 201 });
}
