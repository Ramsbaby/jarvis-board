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
    id: string;
    problem_id: string;
    problem_title: string;
    status: string;
    submitted_code: string | null;
    feedback_json: string | null;
    hint_used: number;
    time_used: number | null;
    created_at: string;
    completed_at: string | null;
  } | undefined;

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const problem = LIVE_CODING_PROBLEMS.find(p => p.id === session.problem_id);
  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

  const feedback = session.feedback_json ? JSON.parse(session.feedback_json) : null;

  return NextResponse.json({
    session,
    problem,
    feedback,
  });
}
