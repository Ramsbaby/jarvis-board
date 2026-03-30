'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { LCProblem as LiveCodingProblem } from '@/lib/live-coding-problems';

const TOTAL_SECONDS = 30 * 60; // 30분

interface Feedback {
  score: number;
  correctness: string;
  timeComplexity: string;
  spaceComplexity: string;
  goodPoints: string[];
  improvements: string[];
  edgeCases: string[];
  interviewerComment: string;
}

function Timer({ running, onExpire }: { running: boolean; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && remaining > 0) {
      ref.current = setInterval(() => setRemaining(r => r - 1), 1000);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  useEffect(() => {
    if (remaining === 0) onExpire();
  }, [remaining, onExpire]);

  const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');
  const pct = (remaining / TOTAL_SECONDS) * 100;
  const urgency = remaining < 300 ? 'text-red-600' : remaining < 600 ? 'text-amber-600' : 'text-zinc-800';
  const elapsed = TOTAL_SECONDS - remaining;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`font-mono text-2xl font-black tabular-nums ${urgency}`}>
        {mins}:{secs}
      </span>
      <div className="w-32 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${remaining < 300 ? 'bg-red-500' : remaining < 600 ? 'bg-amber-400' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-400">{Math.floor(elapsed / 60)}분 경과</span>
    </div>
  );
}

const BOILERPLATE = `public class Solution {
    public static void main(String[] args) {
        Solution sol = new Solution();
        // TODO: 테스트
    }

    // TODO: 풀이 구현

}`;

export default function LiveCodingClient({
  sessionId,
  problem,
  initialCode,
  existingFeedback,
  alreadyCompleted,
}: {
  sessionId: string;
  problem: LiveCodingProblem;
  initialCode: string;
  existingFeedback: Feedback | null;
  alreadyCompleted: boolean;
}) {
  const [code, setCode] = useState(initialCode || problem.starterCode || BOILERPLATE);
  const [started, setStarted] = useState(alreadyCompleted);
  const [timerRunning, setTimerRunning] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(alreadyCompleted ? Date.now() : null);
  const [feedback, setFeedback] = useState<Feedback | null>(existingFeedback);
  const [modelSolution, setModelSolution] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [loadingHint, setLoadingHint] = useState(false);
  const [expired, setExpired] = useState(false);
  const [activeTab, setActiveTab] = useState<'problem' | 'examples' | 'constraints'>('problem');

  const handleStart = () => {
    setStarted(true);
    setTimerRunning(true);
    setStartTime(Date.now());
  };

  const getElapsed = useCallback(() => {
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime) / 1000);
  }, [startTime]);

  const handleExpire = useCallback(() => {
    setTimerRunning(false);
    setExpired(true);
  }, []);

  const handleHint = async () => {
    if (hintUsed || hint) return;
    setLoadingHint(true);
    try {
      const res = await fetch(`/api/interview/live-coding/${sessionId}/hint`);
      const data = await res.json();
      setHint(data.hint);
      setHintUsed(true);
    } finally {
      setLoadingHint(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || feedback) return;
    setSubmitting(true);
    setTimerRunning(false);
    try {
      const res = await fetch(`/api/interview/live-coding/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, timeUsed: getElapsed(), hintUsed }),
      });
      const data = await res.json();
      setFeedback(data.feedback);
      setModelSolution(data.modelSolution);
    } finally {
      setSubmitting(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 90 ? 'text-emerald-600 bg-emerald-50' :
    score >= 70 ? 'text-blue-600 bg-blue-50' :
    score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

  const difficultyBadge = (d: string) =>
    d === 'easy' ? 'bg-emerald-100 text-emerald-700' :
    d === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <div className="bg-zinc-50 min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/interview" className="text-zinc-400 hover:text-zinc-600 text-sm shrink-0">← 면접</Link>
          <span className="text-zinc-300">|</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-zinc-800 truncate">{problem.title}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${difficultyBadge(problem.difficulty)}`}>
                {problem.difficulty === 'easy' ? '쉬움' : problem.difficulty === 'medium' ? '보통' : '어려움'}
              </span>
              {problem.tags.map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded">{t}</span>
              ))}
            </div>
          </div>
          {started && !alreadyCompleted && (
            <Timer running={timerRunning} onExpire={handleExpire} />
          )}
        </div>
      </header>

      {/* 시작 전 화면 */}
      {!started && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 max-w-md w-full text-center space-y-6 shadow-sm">
            <div className="space-y-2">
              <div className="text-4xl">💻</div>
              <h2 className="text-lg font-black text-zinc-800">라이브코딩 준비</h2>
              <p className="text-sm text-zinc-500">카카오페이 1차 면접 — 라이브코딩 파트</p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-bold text-zinc-600">진행 방식</p>
              <ul className="text-xs text-zinc-500 space-y-1">
                <li>⏱ 제한 시간 <strong className="text-zinc-700">30분</strong></li>
                <li>☕ 언어: <strong className="text-zinc-700">Java</strong></li>
                <li>🔍 웹 검색 · AI 도구 <strong className="text-zinc-700">허용</strong></li>
                <li>💡 힌트 1회 사용 가능 (점수 감점 없음)</li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800 font-semibold">
                문제: <span className="text-amber-900">{problem.title}</span>
              </p>
            </div>
            <button
              onClick={handleStart}
              className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-colors"
            >
              ⏱ 타이머 시작 — 문제 풀기
            </button>
          </div>
        </div>
      )}

      {/* 메인 코딩 영역 */}
      {started && (
        <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 py-4 gap-4">
          {/* 왼쪽: 문제 */}
          <div className="lg:w-[45%] flex flex-col gap-3">
            {/* 탭 */}
            <div className="flex gap-1 bg-white border border-zinc-200 rounded-xl p-1">
              {(['problem', 'examples', 'constraints'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  {tab === 'problem' ? '📋 문제' : tab === 'examples' ? '📌 예제' : '📐 제약'}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
              {activeTab === 'problem' && (
                <div className="space-y-3">
                  <pre className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed font-sans">{problem.description}</pre>
                </div>
              )}
              {activeTab === 'examples' && (
                <div className="space-y-3">
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="space-y-2">
                      <p className="text-xs font-bold text-zinc-600">예제 {i + 1}</p>
                      <div className="bg-zinc-50 rounded-lg p-3 space-y-1">
                        <p className="text-[11px] text-zinc-500 font-mono">입력: {ex.input}</p>
                        <p className="text-[11px] text-zinc-500 font-mono">출력: {ex.output}</p>
                        {ex.explanation && <p className="text-[11px] text-zinc-400 mt-1">{ex.explanation}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'constraints' && (
                <div className="space-y-2">
                  {problem.constraints.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-zinc-300 mt-0.5">•</span>
                      <p className="text-xs text-zinc-600 font-mono">{c}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 힌트 */}
            {!feedback && (
              <div className="bg-white rounded-xl border border-zinc-200 p-3">
                {!hint ? (
                  <button
                    onClick={handleHint}
                    disabled={loadingHint}
                    className="w-full text-xs text-amber-600 hover:text-amber-700 font-semibold flex items-center justify-center gap-1.5 py-1 disabled:opacity-50"
                  >
                    💡 {loadingHint ? '힌트 로딩...' : '힌트 보기 (1회 가능)'}
                  </button>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-amber-600">💡 힌트</p>
                    <p className="text-xs text-zinc-600">{hint}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 오른쪽: 에디터 + 피드백 */}
          <div className="lg:w-[55%] flex flex-col gap-3">
            {/* 만료 배너 */}
            {expired && !feedback && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <span className="text-red-500">⏰</span>
                <p className="text-xs font-bold text-red-700">시간 종료! 지금 제출하거나 코드를 완성하세요.</p>
              </div>
            )}

            {/* 코드 에디터 */}
            {!feedback && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-500">☕ Java</span>
                    <span className="text-[10px] text-zinc-400">· 문법 하이라이팅 · 자동완성</span>
                  </div>
                  <button
                    onClick={() => setCode(problem.starterCode || BOILERPLATE)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    ↺ 초기화
                  </button>
                </div>
                <textarea
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const el = e.currentTarget;
                      const start = el.selectionStart;
                      const end = el.selectionEnd;
                      const next = code.substring(0, start) + '    ' + code.substring(end);
                      setCode(next);
                      requestAnimationFrame(() => {
                        el.selectionStart = el.selectionEnd = start + 4;
                      });
                    }
                  }}
                  spellCheck={false}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 text-green-300 font-mono text-sm p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  style={{ height: '420px' }}
                  placeholder="// Java 코드를 작성하세요..."
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !code.trim()}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><span className="animate-spin inline-block">⏳</span> Jarvis 평가 중...</>
                  ) : (
                    '🚀 제출 — Jarvis 코드 리뷰'
                  )}
                </button>
              </div>
            )}

            {/* 피드백 카드 */}
            {feedback && (
              <div className="space-y-3">
                {/* 점수 */}
                <div className={`rounded-2xl border p-5 flex items-center gap-4 ${scoreColor(feedback.score)}`}>
                  <div className="text-4xl font-black tabular-nums">{feedback.score}</div>
                  <div>
                    <p className="font-bold text-sm">/ 100점</p>
                    <p className="text-xs mt-0.5 opacity-80">{feedback.correctness}</p>
                  </div>
                </div>

                {/* 복잡도 */}
                <div className="bg-white rounded-xl border border-zinc-200 p-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold">시간 복잡도</p>
                    <p className="text-sm font-mono font-bold text-zinc-800">{feedback.timeComplexity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold">공간 복잡도</p>
                    <p className="text-sm font-mono font-bold text-zinc-800">{feedback.spaceComplexity}</p>
                  </div>
                </div>

                {/* 잘한 점 */}
                {feedback.goodPoints.length > 0 && (
                  <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 space-y-2">
                    <p className="text-xs font-black text-emerald-700">✅ 잘한 점</p>
                    {feedback.goodPoints.map((p, i) => <p key={i} className="text-xs text-emerald-800">• {p}</p>)}
                  </div>
                )}

                {/* 개선점 */}
                {feedback.improvements.length > 0 && (
                  <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 space-y-2">
                    <p className="text-xs font-black text-amber-700">⚠️ 개선점</p>
                    {feedback.improvements.map((p, i) => <p key={i} className="text-xs text-amber-800">• {p}</p>)}
                  </div>
                )}

                {/* 엣지케이스 */}
                {feedback.edgeCases.length > 0 && (
                  <div className="bg-red-50 rounded-xl border border-red-100 p-4 space-y-2">
                    <p className="text-xs font-black text-red-700">🚨 놓친 엣지케이스</p>
                    {feedback.edgeCases.map((p, i) => <p key={i} className="text-xs text-red-800">• {p}</p>)}
                  </div>
                )}

                {/* 면접관 코멘트 */}
                {feedback.interviewerComment && (
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <p className="text-[10px] text-zinc-400 font-bold mb-1.5">💬 면접관 코멘트</p>
                    <p className="text-xs text-zinc-200 leading-relaxed">{feedback.interviewerComment}</p>
                  </div>
                )}

                {/* 모범 답안 */}
                <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                  <button
                    onClick={() => setShowSolution(!showSolution)}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    <span>📖 모범 답안 보기</span>
                    <span className="text-zinc-400">{showSolution ? '▲' : '▼'}</span>
                  </button>
                  {showSolution && modelSolution && (
                    <pre className="px-4 pb-4 text-xs font-mono text-zinc-700 bg-zinc-50 whitespace-pre-wrap overflow-x-auto">
                      {modelSolution}
                    </pre>
                  )}
                </div>

                {/* 다음 문제 / 다시 풀기 */}
                <div className="flex gap-2">
                  <Link
                    href="/interview"
                    className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-600 font-semibold text-xs text-center hover:bg-zinc-50 transition-colors"
                  >
                    ← 면접 홈
                  </Link>
                  <a
                    href="/api/interview/live-coding"
                    onClick={async e => {
                      e.preventDefault();
                      const res = await fetch('/api/interview/live-coding', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
                      const data = await res.json();
                      window.location.href = `/interview/live-coding/${data.sessionId}`;
                    }}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-black text-xs text-center hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    다음 문제 →
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
