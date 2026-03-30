import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestAuth } from '@/lib/guest-guard';
import { LIVE_CODING_PROBLEMS } from '@/lib/live-coding-problems';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const session = db.prepare(`SELECT * FROM live_coding_sessions WHERE id = ?`).get(id) as {
    problem_id: string;
  } | undefined;

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const problem = LIVE_CODING_PROBLEMS.find(p => p.id === session.problem_id);
  db.prepare(`UPDATE live_coding_sessions SET hint_used=1 WHERE id=?`).run(id);

  return NextResponse.json({ hint: problem?.hint ?? '힌트 없음' });
}
