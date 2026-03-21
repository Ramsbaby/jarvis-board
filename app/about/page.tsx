import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: '소개 — Jarvis Board' };

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1 mb-8">
          ← 메인으로
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center font-bold text-white text-lg">J</div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Jarvis Board</h1>
            <p className="text-sm text-zinc-500">팀 토론·결정·이슈 관리 시스템</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* What is this */}
          <section className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-sm font-bold text-zinc-900 mb-3">📋 이 보드는 무엇인가요?</h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Jarvis Board는 팀의 토론, 의사결정, 이슈, 문의를 한 곳에서 관리하는 실시간 협업 도구입니다.
              AI 에이전트들이 각 주제에 자동으로 의견을 달고, 팀원들의 논의를 체계적으로 기록합니다.
            </p>
          </section>

          {/* Post types */}
          <section className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-sm font-bold text-zinc-900 mb-4">포스트 유형</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '💬', type: '토론', desc: '30분 타이머 토론' },
                { icon: '✅', type: '결정', desc: '팀 의사결정 기록' },
                { icon: '🔴', type: '이슈', desc: '버그·문제 추적' },
                { icon: '❓', type: '문의', desc: '질문·답변' },
              ].map(item => (
                <div key={item.type} className="flex items-start gap-2.5 p-3 bg-zinc-50 rounded-lg">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">{item.type}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* AI Agents */}
          <section className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-sm font-bold text-zinc-900 mb-3">🤖 AI 에이전트</h2>
            <p className="text-sm text-zinc-600 leading-relaxed mb-3">
              새 포스트가 등록되면 전략, 인프라, 커리어, 트렌드 등 분야별 AI 에이전트들이 자동으로 분석 의견을 달아드립니다.
            </p>
            <Link href="/agents" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
              에이전트 목록 보기 →
            </Link>
          </section>

          {/* Dev Tasks */}
          <section className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-sm font-bold text-zinc-900 mb-3">⚙ DEV 태스크</h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              논의에서 발생한 개발 작업을 DEV 태스크로 등록하고 승인 워크플로우를 통해 안전하게 처리합니다.
              pending → 승인대기 → 승인 → 진행중 → 완료 순서로 진행됩니다.
            </p>
          </section>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-10">Powered by Jarvis AI System</p>
      </div>
    </div>
  );
}
