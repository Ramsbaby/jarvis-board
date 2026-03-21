export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { callLLM, LLMError } from '@/lib/llm';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const task = db.prepare('SELECT * FROM dev_tasks WHERE id = ?').get(id) as any;
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (task.status !== 'done') return NextResponse.json({ error: '완료된 태스크만 분석 가능합니다' }, { status: 400 });

  const changedFiles: string[] = (() => { try { return JSON.parse(task.changed_files || '[]'); } catch { return []; } })();
  const logs: any[] = (() => { try { return JSON.parse(task.execution_log || '[]'); } catch { return []; } })();
  const lastLogs = logs.slice(-10).map((l: any) => l.message).join('\n');

  const prompt = `다음 자동화 개발 작업의 결과를 분석해서 임팩트 리포트를 작성해주세요.

작업 제목: ${task.title}
작업 설명: ${task.detail || '없음'}
기대 효과 (사전): ${task.expected_impact || '미입력'}
결과 요약: ${task.result_summary || '없음'}
변경된 파일 (${changedFiles.length}개): ${changedFiles.join(', ') || '없음'}
실행 로그 마지막 10줄:
${lastLogs || '없음'}

다음 JSON 형식으로만 응답해주세요 (마크다운 코드블록 없이):
{
  "one_line": "한 줄로 요약한 실제 변화 (비개발자도 이해하는 쉬운 말)",
  "actual_impact": "실제 변화를 3-5문장으로 설명. 기술 용어는 쉽게 풀어서.",
  "impact_areas": ["security", "performance", "ux", "infra", "data", "cost", "reliability"] 중 해당하는 것들,
  "improvement_score": 1-10 점수 (이 작업이 얼마나 중요한 개선인지),
  "user_visible": true/false (사용자가 직접 느낄 수 있는 변화인지),
  "risk_reduced": "어떤 리스크가 줄었는지 한 줄 (없으면 null)"
}`;

  try {
    const text = await callLLM(prompt, { maxTokens: 600, timeoutMs: 20000 });
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = { one_line: text.slice(0, 100), actual_impact: text }; }

    const actualImpactText = parsed.actual_impact || parsed.one_line || '';
    const impactAreasJson = JSON.stringify(parsed.impact_areas || []);
    db.prepare('UPDATE dev_tasks SET actual_impact = ?, impact_areas = ? WHERE id = ?')
      .run(actualImpactText, impactAreasJson, id);

    return NextResponse.json({ ...parsed, saved: true });
  } catch (err: any) {
    if (err instanceof LLMError && err.isTimeout) {
      return NextResponse.json({ error: 'Timeout' }, { status: 504 });
    }
    console.error('Impact analysis error:', err);
    return NextResponse.json({ error: 'Failed to analyze impact' }, { status: 500 });
  }
}
