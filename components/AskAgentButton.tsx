'use client';

import { useState, useRef, useEffect } from 'react';
import { AUTHOR_META } from '@/lib/constants';

const AGENT_GROUPS = [
  {
    label: '임원진',
    agents: ['kim-seonhwi', 'jung-mingi', 'lee-jihwan'],
  },
  {
    label: '이사회',
    agents: ['strategy-lead', 'infra-lead', 'career-lead', 'brand-lead', 'finance-lead', 'record-lead', 'board-synthesizer'],
  },
  {
    label: '전문가',
    agents: ['jarvis-proposer', 'infra-team', 'audit-team', 'brand-team', 'record-team', 'trend-team', 'growth-team', 'council-team'],
  },
] as const;

type AgentKey = typeof AGENT_GROUPS[number]['agents'][number];

const TYPE_RECOMMENDED: Record<string, string[]> = {
  decision: ['finance-lead', 'strategy-lead', 'board-synthesizer'],
  issue: ['infra-lead', 'audit-team', 'kim-seonhwi'],
  discussion: ['strategy-lead', 'career-lead', 'jarvis-proposer'],
  inquiry: ['record-lead', 'council-team', 'jarvis-proposer'],
};

export default function AskAgentButton({ postId, postType, postTags }: {
  postId: string;
  postType?: string;
  postTags?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [participated, setParticipated] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const agents = new Set(data.filter(c => !c.is_visitor).map(c => c.author));
          setParticipated(agents);
        }
      })
      .catch(() => {});
  }, [postId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function ask(agent: string) {
    setLoading(agent);
    setOpen(false);
    try {
      const res = await fetch(`/api/posts/${postId}/ask-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent }),
      });
      if (res.ok) {
        setParticipated(prev => new Set([...prev, agent]));
        const meta = AUTHOR_META[agent as keyof typeof AUTHOR_META];
        setSuccess(`${meta?.emoji ?? '🤖'} ${meta?.label ?? agent}이 응답했습니다`);
        setTimeout(() => setSuccess(null), 4000);
      }
    } finally {
      setLoading(null);
    }
  }

  const recommended = (TYPE_RECOMMENDED[postType ?? ''] ?? []).filter(a => !participated.has(a));

  function renderAgentButton(agent: string, keyPrefix?: string) {
    const meta = AUTHOR_META[agent as keyof typeof AUTHOR_META];
    const hasParticipated = participated.has(agent);
    return (
      <button
        key={keyPrefix ? `${keyPrefix}-${agent}` : agent}
        onClick={() => !hasParticipated && ask(agent)}
        disabled={hasParticipated}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left ${
          hasParticipated
            ? 'opacity-50 cursor-not-allowed text-zinc-400 bg-zinc-50'
            : 'text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700'
        }`}
      >
        <span className="text-base">{meta?.emoji ?? '🤖'}</span>
        <div className="flex-1 min-w-0">
          <span className="font-medium block">
            {hasParticipated && <span className="text-emerald-500 mr-1">✓</span>}
            {meta?.label ?? agent}
            {hasParticipated && <span className="ml-1 text-[10px] text-zinc-400">참여완료</span>}
          </span>
          {meta?.description && <span className="text-[10px] text-zinc-400 truncate block">{meta.description}</span>}
        </div>
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        disabled={!!loading}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            응답 생성 중...
          </>
        ) : (
          <>🤖 에이전트에게 물어보기</>
        )}
      </button>

      {success && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 shadow-sm whitespace-nowrap">
          ✅ {success}
        </div>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden min-w-[220px] max-h-[360px] overflow-y-auto">
          {recommended.length > 0 && (
            <div>
              <p className="text-[11px] text-indigo-600 px-3 pt-2.5 pb-1 font-semibold border-b border-indigo-100 bg-indigo-50/50">⭐ 추천</p>
              {recommended.map((agent: string) => {
                const meta = AUTHOR_META[agent as keyof typeof AUTHOR_META];
                const hasParticipated = participated.has(agent);
                return (
                  <button
                    key={`rec-${agent}`}
                    onClick={() => !hasParticipated && ask(agent)}
                    disabled={hasParticipated}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left ${
                      hasParticipated
                        ? 'opacity-50 cursor-not-allowed text-zinc-400 bg-zinc-50'
                        : 'text-zinc-700 hover:bg-indigo-100 hover:text-indigo-700 bg-indigo-50/30'
                    }`}
                  >
                    <span className="text-base">{meta?.emoji ?? '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium block">
                        {hasParticipated && <span className="text-emerald-500 mr-1">✓</span>}
                        {meta?.label ?? agent}
                        {hasParticipated && <span className="ml-1 text-[10px] text-zinc-400">참여완료</span>}
                      </span>
                      {meta?.description && <span className="text-[10px] text-zinc-400 truncate block">{meta.description}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {AGENT_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[11px] text-zinc-400 px-3 pt-2.5 pb-1 font-medium border-b border-zinc-100">{group.label}</p>
              {group.agents.map((agent: string) => renderAgentButton(agent))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
