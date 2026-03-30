import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestAuth } from '@/lib/guest-guard';
import { LIVE_CODING_PROBLEMS } from '@/lib/live-coding-problems';
import { callLLM, MODEL_QUALITY } from '@/lib/llm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { code, timeUsed, hintUsed } = await req.json();

  const db = getDb();
  const session = db.prepare(`SELECT * FROM live_coding_sessions WHERE id = ?`).get(id) as {
    id: string; problem_id: string; status: string;
  } | undefined;

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const problem = LIVE_CODING_PROBLEMS.find(p => p.id === session.problem_id);
  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

  const systemPrompt = `당신은 카카오페이 기술 면접관입니다. 지원자가 제출한 Java 코드를 리뷰합니다.
반드시 아래 JSON 형식으로만 응답하세요:
{
  "score": <0-100 정수. 완전 정답=90+, 로직 맞지만 엣지케이스 누락=70~89, 방향은 맞지만 버그=50~69, 틀림=~49>,
  "correctness": "<정답여부 한 줄 평가>",
  "timeComplexity": "<시간복잡도 O(?) 분석>",
  "spaceComplexity": "<공간복잡도 O(?) 분석>",
  "goodPoints": ["잘한 점 1", "잘한 점 2"],
  "improvements": ["개선점 1", "개선점 2"],
  "edgeCases": ["놓친 엣지케이스 (없으면 빈 배열)"],
  "interviewerComment": "<면접관 코멘트 — 실제 면접처럼 냉정하게 2~3문장>"
}`;

  const userMessage = `[문제] ${problem.title}
${problem.description}

[제출 코드]
${code || '(코드 없음)'}

[소요 시간] ${Math.floor((timeUsed || 0) / 60)}분 ${(timeUsed || 0) % 60}초
[힌트 사용] ${hintUsed ? '예' : '아니오'}`;

  let feedbackRaw: string;
  try {
    feedbackRaw = await callLLM(userMessage, {
      model: MODEL_QUALITY,
      systemPrompt,
      maxTokens: 800,
      temperature: 0.3,
    });
  } catch {
    feedbackRaw = JSON.stringify({
      score: 0, correctness: '평가 실패', timeComplexity: '-', spaceComplexity: '-',
      goodPoints: [], improvements: ['LLM 호출 실패'], edgeCases: [], interviewerComment: '평가 중 오류가 발생했습니다.',
    });
  }

  // JSON 파싱 시도
  let feedback;
  try {
    const jsonMatch = feedbackRaw.match(/\{[\s\S]*\}/);
    feedback = JSON.parse(jsonMatch ? jsonMatch[0] : feedbackRaw);
  } catch {
    feedback = { score: 0, correctness: feedbackRaw, timeComplexity: '-', spaceComplexity: '-', goodPoints: [], improvements: [], edgeCases: [], interviewerComment: '' };
  }

  db.prepare(
    `UPDATE live_coding_sessions SET submitted_code=?, feedback_json=?, time_used=?, hint_used=?, status='completed', completed_at=datetime('now') WHERE id=?`
  ).run(code, JSON.stringify(feedback), timeUsed, hintUsed ? 1 : 0, id);

  return NextResponse.json({ feedback, modelSolution: problem.modelSolution });
}
