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
// Returns generations with enriched stats: avg_score, best_ratio, worst_ratio
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
  `).all() as Array<Record<string, unknown>>;

  // N+1 제거: 모든 세대의 점수/투표 데이터를 한 번에 집계
  const genIds = rows.map(r => r.id as string);

  type ScoreAggregate = { generation_id: string; agent_id: string; total_score: number };
  type VoteAggregate = { generation_id: string; best_received: number; worst_received: number; total_votes: number };

  const scoreRowsAll: ScoreAggregate[] = genIds.length === 0
    ? []
    : db.prepare(`
        SELECT m.generation_id, m.agent_id,
          COALESCE(SUM(s.points), 0) as total_score
        FROM persona_generation_members m
        LEFT JOIN agent_scores s ON s.agent_id = m.agent_id
        WHERE m.generation_id IN (${genIds.map(() => '?').join(',')})
        GROUP BY m.generation_id, m.agent_id
      `).all(...genIds) as ScoreAggregate[];

  const voteRowsAll: VoteAggregate[] = genIds.length === 0
    ? []
    : db.prepare(`
        SELECT m.generation_id,
          COUNT(CASE WHEN pv.vote_type = 'best' THEN 1 END) as best_received,
          COUNT(CASE WHEN pv.vote_type = 'worst' THEN 1 END) as worst_received,
          COUNT(pv.id) as total_votes
        FROM persona_generation_members m
        JOIN comments c ON c.author = m.agent_id
        JOIN peer_votes pv ON pv.comment_id = c.id
        WHERE m.generation_id IN (${genIds.map(() => '?').join(',')})
        GROUP BY m.generation_id
      `).all(...genIds) as VoteAggregate[];

  const scoresByGen = new Map<string, Array<{ agent_id: string; total_score: number }>>();
  for (const s of scoreRowsAll) {
    let arr = scoresByGen.get(s.generation_id);
    if (!arr) { arr = []; scoresByGen.set(s.generation_id, arr); }
    arr.push({ agent_id: s.agent_id, total_score: s.total_score });
  }
  const voteByGen = new Map<string, VoteAggregate>();
  for (const v of voteRowsAll) voteByGen.set(v.generation_id, v);

  const enriched = rows.map(gen => {
    const genId = gen.id as string;
    const scores = scoresByGen.get(genId) ?? [];
    const avg_score = scores.length > 0
      ? Math.round((scores.reduce((sum, s) => sum + s.total_score, 0) / scores.length) * 100) / 100
      : 0;

    const voteRow = voteByGen.get(genId);
    const totalVotes = voteRow?.total_votes ?? 0;
    const best_ratio = totalVotes > 0 ? Math.round(((voteRow?.best_received ?? 0) / totalVotes) * 1000) / 1000 : 0;
    const worst_ratio = totalVotes > 0 ? Math.round(((voteRow?.worst_received ?? 0) / totalVotes) * 1000) / 1000 : 0;

    return { ...gen, avg_score, best_ratio, worst_ratio };
  });

  return NextResponse.json(enriched);
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

  // MAX+INSERT race 방지: MAX 조회부터 멤버 등록까지 하나의 트랜잭션(IMMEDIATE)으로 묶음
  const maxStmt = db.prepare(
    `SELECT COALESCE(MAX(generation_number), 0) + 1 as next_num FROM persona_generations`
  );
  const insertGeneration = db.prepare(`
    INSERT INTO persona_generations (id, generation_number, name, notes)
    VALUES (?, ?, ?, ?)
  `);
  const insertMember = db.prepare(`
    INSERT INTO persona_generation_members (id, generation_id, agent_id, system_prompt_snapshot, status, score_at_hire)
    VALUES (?, ?, ?, ?, 'active', ?)
  `);
  const getPersona = db.prepare(`SELECT system_prompt FROM personas WHERE id = ?`);
  const getScore = db.prepare(`SELECT SUM(points) as total FROM agent_scores WHERE agent_id = ?`);

  const createGenerationTx = db.transaction(() => {
    const maxRow = maxStmt.get() as { next_num: number };
    const generationNumber = maxRow.next_num;
    insertGeneration.run(id, generationNumber, name, notes ?? null);

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
    return generationNumber;
  });
  createGenerationTx();

  // Return created generation
  const created = db.prepare(`SELECT * FROM persona_generations WHERE id = ?`).get(id);
  return NextResponse.json(created, { status: 201 });
}
