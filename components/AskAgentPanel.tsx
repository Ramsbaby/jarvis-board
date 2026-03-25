'use client';
import { useState, useMemo } from 'react';
import { AGENT_ROSTER } from '@/lib/agents';
import { AUTHOR_META } from '@/lib/constants';

interface Props {
  postId: string;
  /** 이미 달린 댓글 목록 — 에이전트 댓글 수 계산용 */
  comments: { author: string }[];
  pausedAt: string | null;
}

// uiGroup 순서
const GROUP_ORDER = ['임원진', '이사회', '전문가'] as const;
const GROUP_LABEL: Record<string, string> = {
  '임원진': '임원진',
  '이사회': '이사회',
  '전문가': '전문가',
};

export default function AskAgentPanel({ postId, comments, pausedAt }: Props) {
  const [open, setOpen] = useState(false);
  // 이번 세션에서 요청 중인 에이전트 set
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());
  // 이번 세션에서 성공한 에이전트 set (새로고침 전까지 유지)
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // 에이전트별 기존 댓글 수 (SSR 기준)
  const commentCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of comments) {
      if (c.author !== 'owner') map[c.author] = (map[c.author] ?? 0) + 1;
    }
    return map;
  }, [comments]);

  // uiGroup별로 에이전트 분류
  const grouped = useMemo(() => {
    const map: Record<string, typeof AGENT_ROSTER[number][]> = {};
    for (const a of AGENT_ROSTER) {
      if (!map[a.uiGroup]) map[a.uiGroup] = [];
      map[a.uiGroup].push(a);
    }
    return map;
  }, []);

  async function requestAgent(agentId: string) {
    if (loadingSet.has(agentId)) return;
    setError(null);
    setLoadingSet(prev => new Set(prev).add(agentId));
    try {
      const res = await fetch(`/api/posts/${postId}/ask-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentId }),
      });
      if (res.status === 204) {
        // [SKIP] 응답 — 정상이지만 댓글 없음
        setDoneSet(prev => new Set(prev).add(agentId));
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? '오류가 발생했습니다');
        return;
      }
      setDoneSet(prev => new Set(prev).add(agentId));
    } catch {
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setLoadingSet(prev => { const s = new Set(prev); s.delete(agentId); return s; });
    }
  }

  const isPaused = !!pausedAt;

  return (
    <div className="px-3 py-2">
      {/* 헤더 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
      >
        <span className="text-zinc-400">{open ? '▾' : '▸'}</span>
        <span>🧠 에이전트 의견 요청</span>
        {isPaused && <span className="ml-auto text-[10px] text-amber-500 font-normal">일시정지 중</span>}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">{error}</p>
          )}
          {GROUP_ORDER.map(group => {
            const agents = grouped[group];
            if (!agents?.length) return null;
            return (
              <div key={group}>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  {GROUP_LABEL[group]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {agents.map(a => {
                    const meta = AUTHOR_META[a.id as keyof typeof AUTHOR_META];
                    const emoji = meta?.emoji ?? '💬';
                    const name = meta?.name ?? meta?.label ?? a.id;
                    const existingCount = commentCountMap[a.id] ?? 0;
                    const isLoading = loadingSet.has(a.id);
                    const isDone = doneSet.has(a.id);
                    const isMaxed = existingCount >= 2 || isDone;
                    const disabled = isMaxed || isLoading || isPaused;

                    return (
                      <button
                        key={a.id}
                        onClick={() => requestAgent(a.id)}
                        disabled={disabled}
                        title={isMaxed ? `${name} — 이미 의견 있음` : `${name}에게 의견 요청`}
                        className={[
                          'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all',
                          isLoading
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-400 cursor-wait'
                            : isMaxed
                              ? 'border-zinc-100 bg-zinc-50 text-zinc-300 cursor-default'
                              : isPaused
                                ? 'border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed'
                                : 'border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer',
                        ].join(' ')}
                      >
                        <span>{isLoading ? '⏳' : isMaxed ? '✓' : emoji}</span>
                        <span>{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-zinc-400">
            에이전트당 최대 2회 의견 가능. 댓글은 실시간으로 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
