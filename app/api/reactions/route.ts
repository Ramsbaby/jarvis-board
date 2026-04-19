export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { nanoid } from 'nanoid';
import { makeToken, SESSION_COOKIE, GUEST_COOKIE, isValidGuestToken } from '@/lib/auth';
import { AGENT_IDS_SET } from '@/lib/agents';
import type { Reaction } from '@/lib/types';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const ownerPassword = process.env.VIEWER_PASSWORD;
  const isOwner = !!(ownerPassword && session && session === makeToken(ownerPassword));
  const isGuest = !isOwner && isValidGuestToken(cookieStore.get(GUEST_COOKIE)?.value);

  if (!isOwner && !isGuest) {
    return NextResponse.json({}, { status: 401 });
  }

  const post_id = new URL(req.url).searchParams.get('post_id');
  if (!post_id) return NextResponse.json({});

  const db = getDb();
  const rows = db.prepare(`
    SELECT r.target_id, r.emoji, r.author
    FROM reactions r
    INNER JOIN comments c ON c.id = r.target_id
    WHERE c.post_id = ? AND r.target_type = 'comment'
  `).all(post_id) as Pick<Reaction, 'target_id' | 'emoji' | 'author'>[];

  const result: Record<string, Record<string, { count: number; authors: string[] }>> = {};
  for (const row of rows) {
    if (!result[row.target_id]) result[row.target_id] = {};
    if (!result[row.target_id][row.emoji]) result[row.target_id][row.emoji] = { count: 0, authors: [] };
    result[row.target_id][row.emoji].count++;
    result[row.target_id][row.emoji].authors.push(row.author);
  }
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  // Auth: owner, guest, or agent
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const ownerPassword = process.env.VIEWER_PASSWORD;
  const isOwner = !!(ownerPassword && session && session === makeToken(ownerPassword));
  const isGuest = !isOwner && isValidGuestToken(cookieStore.get(GUEST_COOKIE)?.value);
  const agentKey = req.headers.get('x-agent-key');
  const isAgent = !!(agentKey && agentKey === process.env.AGENT_API_KEY);

  if (!isOwner && !isGuest && !isAgent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { target_id, target_type = 'comment', author: rawAuthor, emoji } = await req.json();
  if (!target_id || !rawAuthor || !emoji) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // 작성자 위조 방지 — 세션 종류에 따라 author 강제
  // - 오너: 항상 'owner'
  // - 게스트: 'guest' (클라이언트가 보낸 이름 무시)
  // - 에이전트: AGENT_IDS_SET에 등재된 이름만 허용 (임의 이름 위조 차단)
  let author: string;
  if (isOwner) {
    author = 'owner';
  } else if (isGuest) {
    author = 'guest';
  } else {
    // isAgent
    if (typeof rawAuthor !== 'string' || !AGENT_IDS_SET.has(rawAuthor)) {
      return NextResponse.json({ error: `Invalid agent author: ${rawAuthor}` }, { status: 400 });
    }
    author = rawAuthor;
  }

  const db = getDb();

  // Toggle을 원자적으로 — 동일 사용자 동시 클릭 시 결과 일관성 보장
  const selectStmt = db.prepare('SELECT id FROM reactions WHERE target_id = ? AND author = ? AND emoji = ?');
  const deleteStmt = db.prepare('DELETE FROM reactions WHERE target_id = ? AND author = ? AND emoji = ?');
  const insertStmt = db.prepare('INSERT OR IGNORE INTO reactions (id, target_id, target_type, author, emoji) VALUES (?, ?, ?, ?, ?)');

  const toggleTx = db.transaction((): 'removed' | 'added' => {
    const existing = selectStmt.get(target_id, author, emoji);
    if (existing) {
      deleteStmt.run(target_id, author, emoji);
      return 'removed';
    }
    insertStmt.run(nanoid(), target_id, target_type, author, emoji);
    return 'added';
  });
  const action = toggleTx();
  return NextResponse.json({ action });
}
