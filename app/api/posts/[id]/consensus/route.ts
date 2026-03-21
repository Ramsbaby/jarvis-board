export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';

export const SYSTEM_PROMPT = `당신은 자비스 컴퍼니 이사회 수석 결의 담당자입니다.

역할: 토론의 모든 참여자 의견을 분석하여 경영진이 즉시 실행 가능한 최종 결의안을 작성합니다.

핵심 원칙:
- 모호한 표현 절대 금지 ("~검토", "~고려", "~방향 수립" 단독 사용 금지)
- 실행 항목은 반드시 [누가][무엇을][어떻게][언제까지] 4요소 명시
- Jarvis AI 개발 지시사항은 파일명/함수명/API 경로 수준까지 구체적으로 작성
- 합의되지 않은 사항을 억지로 결론 내리지 않음
- 의견 수가 적거나 논의가 미성숙해도 현 상태를 정직하게 반영

출력 형식 (이 마크다운 구조를 정확히 따르십시오):
## 🏛️ 이사회 최종 의견

### 핵심 합의
[토론에서 실질적으로 합의된 사항 2-3줄. 합의 미도달 시 "이번 토론에서 명확한 합의 미도달" 명시]

### 이견 및 리스크
[의견이 나뉜 사항 또는 실행 리스크. 없으면 "주요 이견 없음"]

## ⚡ 구체적 실행 항목
[각 항목을 아래 형식으로. 토론에서 합의되지 않은 항목 절대 포함 금지]
1. **[항목명]** — [담당팀/담당자], [기한]: [무엇을 어떻게 하는지 구체적 내용]
[실행 항목 없을 시 "현재 확정된 실행 항목 없음" 명시]

## 🤖 Jarvis 개발 지시사항
[Jarvis AI가 이 결의를 보고 즉시 코딩 시작 가능한 수준. 불가능하면 "개발 작업 없음" 명시]
- HIGH: [구체적 개발 작업 — 관련 파일/함수/API 명시]
- MEDIUM: [구체적 개발 작업]
- LOW: [구체적 개발 작업]

---
*자비스 컴퍼니 이사회 결의*

언어: 한국어. 경어체.
쉬운 말로 작성: 전문 용어나 영어 단어를 쓸 때는 바로 뒤에 괄호로 쉬운 설명 필수. 처음 보는 사람도 바로 이해할 수 있게 쓸 것.`;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT consensus_summary, consensus_at, consensus_requested_at FROM posts WHERE id = ?').get(id) as any;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const pending = !!(row.consensus_requested_at && !row.consensus_summary);
  return NextResponse.json({
    consensus: row.consensus_summary ?? null,
    consensus_at: row.consensus_at ?? null,
    pending,
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;

  // Allow either: owner session OR agent key (for Jarvis to submit results)
  const isOwner = !!(password && session && session === makeToken(password));
  const agentKey = _req.headers.get('x-agent-key');
  const isAgent = !!(agentKey && agentKey === process.env.AGENT_API_KEY);

  if (!isOwner && !isAgent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If agent is submitting results (x-agent-key + body has consensus field)
  if (isAgent) {
    const body = await _req.json().catch(() => ({})) as any;
    if (body.consensus) {
      const now = new Date().toISOString();
      db.prepare('UPDATE posts SET consensus_summary = ?, consensus_at = ?, consensus_requested_at = NULL, consensus_pending_prompt = NULL WHERE id = ?')
        .run(body.consensus, now, id);
      return NextResponse.json({ consensus: body.consensus, consensus_at: now });
    }
  }

  // Owner requesting new consensus — build prompt and set pending
  const allComments = db.prepare(`
    SELECT author, author_display, content, is_visitor FROM comments
    WHERE post_id = ? AND (is_resolution IS NULL OR is_resolution = 0)
    ORDER BY created_at ASC
  `).all(id) as any[];

  if (allComments.length === 0) {
    return NextResponse.json({ error: '분석할 의견이 없습니다' }, { status: 400 });
  }

  const agentComments = allComments.filter((c: any) => !c.is_visitor);
  const visitorComments = allComments.filter((c: any) => c.is_visitor);
  const agentText = agentComments.map((c: any) => `[${c.author_display || c.author}]: ${c.content}`).join('\n\n');
  const visitorSection = visitorComments.length > 0
    ? `\n\n### 방문자/외부 의견 (${visitorComments.length}건)\n${visitorComments.map((c: any) => `[${c.author_display || c.author}]: ${c.content}`).join('\n\n')}`
    : '';
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const userPrompt = `## 토론 정보\n제목: ${post.title}\n유형: ${post.type ?? 'discussion'}\n날짜: ${today}\n총 의견 수: ${allComments.length}개 (에이전트 ${agentComments.length}명, 방문자 ${visitorComments.length}명)\n\n## 팀 에이전트 의견 (${agentComments.length}건)\n${agentText || '(에이전트 의견 없음)'}${visitorSection}\n\n---\n위 토론의 모든 의견을 종합하여 이사회 최종 결의안을 작성해주세요.\n지정된 마크다운 형식을 정확히 따르고, 모호한 표현 없이 실행 가능한 수준으로 작성하세요.`;

  const now = new Date().toISOString();
  db.prepare('UPDATE posts SET consensus_requested_at = ?, consensus_pending_prompt = ?, consensus_summary = NULL, consensus_at = NULL WHERE id = ?')
    .run(now, userPrompt, id);

  return NextResponse.json({ pending: true, consensus: null, consensus_at: null }, { status: 202 });
}
