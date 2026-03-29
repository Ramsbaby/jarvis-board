export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestAuth } from '@/lib/guest-guard';

interface MessageRow {
  session_id: string;
  missing_keywords: string;
  score: number | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  company: string;
  category: string;
  difficulty: string;
  created_at: string;
}

/**
 * GET /api/interview/weakness-report?company=kakaopay&limit=20
 * 최근 세션들의 missing_keywords를 집계하여 반복 약점 리포트를 반환합니다.
 */
export async function GET(req: NextRequest) {
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const company = searchParams.get('company') ?? 'kakaopay';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100);
  const category = searchParams.get('category'); // optional filter

  const db = getDb();

  // 최근 N개 세션 조회 (company 필터)
  const sessionQuery = category
    ? `SELECT id, company, category, difficulty, created_at FROM interview_sessions WHERE company = ? AND category = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT id, company, category, difficulty, created_at FROM interview_sessions WHERE company = ? ORDER BY created_at DESC LIMIT ?`;

  const sessions = category
    ? db.prepare(sessionQuery).all(company, category, limit) as SessionRow[]
    : db.prepare(sessionQuery).all(company, limit) as SessionRow[];

  if (sessions.length === 0) {
    return NextResponse.json({
      company,
      session_count: 0,
      top_weaknesses: [],
      category_breakdown: {},
      recent_scores: [],
      message: '세션 데이터가 없습니다.',
    });
  }

  const sessionIds = sessions.map(s => s.id);

  // 각 세션의 feedback 메시지에서 missing_keywords + score 수집
  const placeholders = sessionIds.map(() => '?').join(',');
  const messages = db.prepare(
    `SELECT session_id, missing_keywords, score, created_at
     FROM interview_messages
     WHERE session_id IN (${placeholders}) AND role = 'feedback' AND missing_keywords IS NOT NULL`
  ).all(...sessionIds) as MessageRow[];

  // 키워드 빈도 집계
  const keywordMap: Map<string, { count: number; sessions: Set<string>; totalScore: number; scoreCount: number }> = new Map();

  for (const msg of messages) {
    let keywords: string[] = [];
    try {
      keywords = JSON.parse(msg.missing_keywords || '[]');
    } catch {
      continue;
    }
    for (const kw of keywords) {
      if (!kw?.trim()) continue;
      const key = kw.trim();
      if (!keywordMap.has(key)) {
        keywordMap.set(key, { count: 0, sessions: new Set(), totalScore: 0, scoreCount: 0 });
      }
      const entry = keywordMap.get(key)!;
      entry.count++;
      entry.sessions.add(msg.session_id);
      if (msg.score !== null) {
        entry.totalScore += msg.score;
        entry.scoreCount++;
      }
    }
  }

  // 빈도 순 정렬
  const topWeaknesses = Array.from(keywordMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([keyword, data]) => ({
      keyword,
      miss_count: data.count,
      affected_sessions: data.sessions.size,
      avg_score_when_missed: data.scoreCount > 0
        ? Math.round(data.totalScore / data.scoreCount)
        : null,
      severity: data.count >= 5 ? 'high' : data.count >= 3 ? 'medium' : 'low',
    }));

  // 카테고리별 평균 점수
  const categoryScores: Record<string, { total: number; count: number }> = {};
  for (const session of sessions) {
    const sessionMsgs = messages.filter(m => m.session_id === session.id);
    const scores = sessionMsgs.map(m => m.score).filter(s => s !== null) as number[];
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (!categoryScores[session.category]) {
        categoryScores[session.category] = { total: 0, count: 0 };
      }
      categoryScores[session.category].total += avg;
      categoryScores[session.category].count++;
    }
  }

  const categoryBreakdown = Object.entries(categoryScores).map(([cat, data]) => ({
    category: cat,
    session_count: data.count,
    avg_score: Math.round(data.total / data.count),
  })).sort((a, b) => a.avg_score - b.avg_score); // 점수 낮은 카테고리 먼저

  // 최근 세션 점수 트렌드 (최근 10개)
  const recentScores = sessions.slice(0, 10).map(s => {
    const sessionMsgs = messages.filter(m => m.session_id === s.id);
    const scores = sessionMsgs.map(m => m.score).filter(n => n !== null) as number[];
    return {
      session_id: s.id,
      category: s.category,
      difficulty: s.difficulty,
      created_at: s.created_at,
      avg_score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      question_count: scores.length,
    };
  });

  return NextResponse.json({
    company,
    session_count: sessions.length,
    top_weaknesses: topWeaknesses,
    category_breakdown: categoryBreakdown,
    recent_scores: recentScores,
    generated_at: new Date().toISOString(),
  });
}
