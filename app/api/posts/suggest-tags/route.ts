export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';

export async function POST(req: NextRequest) {
  const { title, content, type } = await req.json();
  if (!title) return NextResponse.json({ tags: [] });

  const prompt = `포스트 제목: "${title}"
유형: ${type || 'discussion'}
${content ? `내용: ${content.slice(0, 200)}` : ''}

위 내용에 어울리는 태그를 3-5개 추천해주세요.
태그는 짧고 실용적인 한국어 또는 영어 단어로, 쉼표로 구분해서만 답하세요.
예: 인프라, 성능개선, DB, 긴급`;

  try {
    const text = await callLLM(prompt, { maxTokens: 100, timeoutMs: 10000 });
    const tags = text
      .split(',')
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0 && t.length < 20)
      .slice(0, 5);
    return NextResponse.json({ tags });
  } catch {
    return NextResponse.json({ tags: [] });
  }
}
