export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { callLLM, LLMError } from '@/lib/llm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT consensus_summary, consensus_at FROM posts WHERE id = ?').get(id) as any;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ consensus: row.consensus_summary ?? null, consensus_at: row.consensus_at ?? null });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  if (!password || !session || session !== makeToken(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get all agent comments (is_agent column does not exist — filter by known agent authors only)
  const agentComments = db.prepare(`
    SELECT c.*, c.author_display FROM comments c
    WHERE c.post_id = ? AND c.author IN (
      'strategy-lead','infra-lead','career-lead','brand-lead','finance-lead','record-lead',
      'jarvis-proposer','board-synthesizer','kim-seonhwi','jung-mingi','lee-jihwan',
      'infra-team','audit-team','brand-team','record-team','trend-team','growth-team','council-team'
    )
    ORDER BY c.created_at ASC
  `).all(id) as any[];

  if (agentComments.length === 0) {
    return NextResponse.json({ error: '에이전트 의견이 없습니다' }, { status: 400 });
  }

  const commentsText = agentComments.map((c: any) =>
    `[${c.author_display || c.author}]: ${c.content}`
  ).join('\n\n');

  const prompt = `다음 토론 주제와 팀원 의견을 분석해서 합의 요약을 작성해주세요.

토론 주제: ${post.title}

팀원 의견:
${commentsText}

다음 형식으로 응답해주세요:
1. 합의 사항: (팀이 동의하는 핵심 포인트 2-3개)
2. 이견 사항: (의견이 갈리는 포인트)
3. 권고 결론: (가장 합리적인 방향 1문장)
4. 신뢰도: (합의 수준 - 높음/보통/낮음)`;

  try {
    const summary = await callLLM(prompt, { maxTokens: 800, timeoutMs: 15000 });
    // Persist to DB so it survives page navigation
    const now = new Date().toISOString();
    db.prepare('UPDATE posts SET consensus_summary = ?, consensus_at = ? WHERE id = ?').run(summary, now, id);
    return NextResponse.json({
      consensus: summary,
      consensus_at: now,
      commentCount: agentComments.length,
      agents: agentComments.map((c: any) => c.author_display || c.author)
    });
  } catch (err: any) {
    if (err instanceof LLMError && err.isTimeout) {
      return NextResponse.json({ error: 'Timeout' }, { status: 504 });
    }
    if (err instanceof LLMError && err.status === 500) {
      return NextResponse.json({ error: 'AI 키가 설정되지 않았습니다' }, { status: 503 });
    }
    console.error('Consensus error:', err);
    return NextResponse.json({ error: 'Failed to generate consensus' }, { status: 500 });
  }
}
