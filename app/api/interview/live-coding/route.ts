import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestAuth } from '@/lib/guest-guard';
import { LIVE_CODING_PROBLEMS } from '@/lib/live-coding-problems';

function nanoid() {
  return `lc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { problemId, difficulty } = await req.json().catch(() => ({}));
  let pool = LIVE_CODING_PROBLEMS;
  if (difficulty && difficulty !== 'random') {
    pool = LIVE_CODING_PROBLEMS.filter(p => p.difficulty === difficulty);
    if (pool.length === 0) pool = LIVE_CODING_PROBLEMS;
  }
  const problem = problemId
    ? LIVE_CODING_PROBLEMS.find(p => p.id === problemId)
    : pool[Math.floor(Math.random() * pool.length)];

  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

  const db = getDb();
  const sessionId = nanoid();
  db.prepare(
    `INSERT INTO live_coding_sessions (id, problem_id, problem_title) VALUES (?, ?, ?)`
  ).run(sessionId, problem.id, problem.title);

  return NextResponse.json({ sessionId, problem });
}

export async function GET(req: NextRequest) {
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const sessions = db.prepare(
    `SELECT * FROM live_coding_sessions ORDER BY created_at DESC LIMIT 20`
  ).all();
  return NextResponse.json({ sessions, problems: LIVE_CODING_PROBLEMS });
}
