export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { makeToken, SESSION_COOKIE, GUEST_COOKIE, isValidGuestToken } from '@/lib/auth';
import { nanoid } from 'nanoid';
import type { Poll, PollVoteCount } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const ownerPassword = process.env.VIEWER_PASSWORD;
  const isOwner = !!(ownerPassword && session && session === makeToken(ownerPassword));
  const isGuest = !isOwner && isValidGuestToken(cookieStore.get(GUEST_COOKIE)?.value);

  if (!isOwner && !isGuest) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const polls = db.prepare('SELECT * FROM polls WHERE post_id = ? ORDER BY created_at ASC').all(id) as Poll[];

  // N+1 제거: 단일 쿼리로 모든 poll의 votes를 한 번에 집계
  const pollIds = polls.map(p => p.id);
  const voteRows: Array<PollVoteCount & { poll_id: string }> = pollIds.length === 0
    ? []
    : db.prepare(
        `SELECT poll_id, option_idx, COUNT(*) as cnt FROM poll_votes WHERE poll_id IN (${pollIds.map(() => '?').join(',')}) GROUP BY poll_id, option_idx`
      ).all(...pollIds) as Array<PollVoteCount & { poll_id: string }>;

  const voteMapByPoll = new Map<string, Record<number, number>>();
  for (const v of voteRows) {
    let m = voteMapByPoll.get(v.poll_id);
    if (!m) { m = {}; voteMapByPoll.set(v.poll_id, m); }
    m[v.option_idx] = v.cnt;
  }

  const result = polls.map(poll => {
    const options: string[] = JSON.parse(poll.options);
    const voteMap = voteMapByPoll.get(poll.id) ?? {};
    const totalVotes = Object.values(voteMap).reduce((s, n) => s + n, 0);
    return {
      ...poll,
      options,
      votes: options.map((_: string, i: number) => voteMap[i] ?? 0),
      totalVotes,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  const isOwner = !!(password && session && session === makeToken(password));
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { question, options } = await req.json();
  if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: '질문과 선택지(2개 이상) 필요' }, { status: 400 });
  }

  const db = getDb();
  const pollId = nanoid();
  db.prepare('INSERT INTO polls (id, post_id, question, options) VALUES (?, ?, ?, ?)')
    .run(pollId, id, question.trim(), JSON.stringify(options.map((o: string) => o.trim()).filter(Boolean)));

  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId) as Poll;
  return NextResponse.json({ ...poll, options: JSON.parse(poll.options), votes: [], totalVotes: 0 }, { status: 201 });
}
