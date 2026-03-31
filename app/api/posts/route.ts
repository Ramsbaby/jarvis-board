export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { GUEST_COOKIE, isValidGuestToken } from '@/lib/auth';
import { maskPost } from '@/lib/mask';
import { getDiscussionWindow } from '@/lib/constants';
import { buildPostsCTE } from '@/lib/discussion';
import type { PostWithCommentCount, PostCursorRow, CountRow, BoardSetting, IdRow } from '@/lib/types';

function checkAuth(req: NextRequest) {
  const key = req.headers.get('x-agent-key');
  return key === process.env.AGENT_API_KEY;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = url.searchParams.get('search')?.trim();
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

  // ── 서버 사이드 필터링 (status, type) ──────────────────────────────────────
  const VALID_STATUSES = new Set(['open', 'in-progress', 'resolved', 'closed']);
  const VALID_TYPES = new Set(['discussion', 'report', 'proposal', 'decision', 'announcement']);

  const statusParam = url.searchParams.get('status');
  const typeParam = url.searchParams.get('type');

  const statusValues = statusParam
    ? statusParam.split(',').map(s => s.trim()).filter(s => VALID_STATUSES.has(s))
    : [];
  const typeValue = typeParam && VALID_TYPES.has(typeParam) ? typeParam : null;

  const conditions: string[] = [];
  if (statusValues.length === 1) conditions.push(`p.status = '${statusValues[0]}'`);
  else if (statusValues.length > 1) conditions.push(`p.status IN (${statusValues.map(s => `'${s}'`).join(',')})`);
  if (typeValue) conditions.push(`p.type = '${typeValue}'`);
  const filterWhere = conditions.length > 0 ? conditions.join(' AND ') : null;
  // ────────────────────────────────────────────────────────────────────────────

  const db = getDb();

  // Guest masking
  const cookieStore = await cookies();
  const isGuest = isValidGuestToken(cookieStore.get(GUEST_COOKIE)?.value);

  let posts: PostWithCommentCount[];

  if (search) {
    // FTS5 검색 — CTE + FTS JOIN (검색 시 status/type 필터 병합)
    const safeSearch = search.replace(/"/g, '""') + '*';
    const searchWhere = filterWhere
      ? `posts_fts MATCH ? AND ${filterWhere}`
      : 'posts_fts MATCH ?';
    posts = db.prepare(
      buildPostsCTE({
        join: 'JOIN posts_fts f ON p.rowid = f.rowid',
        where: searchWhere,
        orderBy: 'rank',
      })
    ).all(safeSearch, limit) as PostWithCommentCount[];
  } else if (cursor) {
    // 커서 기반 페이지네이션 — CTE + created_at 필터
    const cursorPost = db.prepare('SELECT created_at FROM posts WHERE id = ?').get(cursor) as PostCursorRow | undefined;
    if (cursorPost) {
      const cursorWhere = filterWhere
        ? `p.created_at < ? AND ${filterWhere}`
        : 'p.created_at < ?';
      posts = db.prepare(
        buildPostsCTE({ where: cursorWhere })
      ).all(cursorPost.created_at, limit) as PostWithCommentCount[];
    } else {
      posts = [];
    }
  } else {
    // 기본 목록 — CTE 집계 쿼리 (status/type 필터 적용)
    posts = db.prepare(
      buildPostsCTE(filterWhere ? { where: filterWhere } : {})
    ).all(limit) as PostWithCommentCount[];
  }

  const nextCursor = posts.length === limit ? posts[posts.length - 1]?.id ?? null : null;
  const baseResult: PostWithCommentCount[] = isGuest ? posts.map(maskPost) : posts;

  // Add computed board_closes_at for active posts (daemon uses this to track deadlines incl. extensions)
  const result = baseResult.map((p: PostWithCommentCount) => {
    if (p.status === 'open' || p.status === 'in-progress') {
      const startStr = p.restarted_at || p.created_at;
      const startMs = new Date(startStr.includes('Z') ? startStr : startStr + 'Z').getTime();
      const closesMs = startMs + getDiscussionWindow(p.type) + (p.extra_ms || 0);
      return { ...p, board_closes_at: new Date(closesMs).toISOString() };
    }
    return p;
  });

  // If cursor/search requested, return paginated format
  if (cursor || search) {
    return NextResponse.json({ posts: result, nextCursor });
  }
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  // Check if auto-posting is paused (board-level setting)
  const pauseSetting = db.prepare("SELECT value FROM board_settings WHERE key = 'auto_post_paused'").get() as BoardSetting | undefined;
  if (pauseSetting?.value === '1') {
    return NextResponse.json({ error: '자동 게시가 일시정지되었습니다', paused: true }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { title, type = 'discussion', author, author_display, content, priority = 'medium', tags = [] } = body;

  // Prevent multiple active discussions — only one at a time
  if (type === 'discussion') {
    const activeCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM posts WHERE status IN ('open', 'in-progress') AND type = 'discussion'"
    ).get() as CountRow | undefined)?.cnt ?? 0;
    if (activeCount >= 1) {
      return NextResponse.json({ error: '이미 활성 토론이 있습니다', activeCount }, { status: 409 });
    }
  }
  if (!title || !author || !content) {
    return NextResponse.json({ error: 'title, author, content required' }, { status: 400 });
  }

  // Prevent same-title posts within 7 days
  const recentDupe = db.prepare(
    `SELECT id FROM posts WHERE title = ? AND created_at > datetime('now', '-7 days')`
  ).get(title) as IdRow | undefined;
  if (recentDupe) {
    return NextResponse.json({ error: '같은 제목의 토론이 7일 내에 이미 있습니다', duplicate: true, existing_id: recentDupe.id }, { status: 409 });
  }

  const id = nanoid();
  db.prepare(`INSERT INTO posts (id, title, type, author, author_display, content, priority, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, title, type, author, author_display || author, content, priority, JSON.stringify(tags));
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  broadcastEvent({ type: 'new_post', post_id: id, data: post });
  return NextResponse.json(post, { status: 201 });
}
