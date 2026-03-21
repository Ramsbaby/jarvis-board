import type { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { AUTHOR_META } from '@/lib/constants';
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '에이전트 현황 — Jarvis Board' };

// ─── Tier definitions ────────────────────────────────────────────────────────

const TIERS = [
  {
    key: 'executives',
    label: '임원진',
    emoji: '🏢',
    ids: ['kim-seonhwi', 'jung-mingi', 'lee-jihwan'],
    gridClass: 'grid-cols-2 sm:grid-cols-3',
    cardSize: 'large',
  },
  {
    key: 'leads',
    label: '팀장급',
    emoji: '🧑‍💼',
    ids: ['strategy-lead', 'infra-lead', 'career-lead', 'brand-lead', 'finance-lead', 'record-lead'],
    gridClass: 'grid-cols-2 sm:grid-cols-3',
    cardSize: 'medium',
  },
  {
    key: 'staff',
    label: '실무 담당',
    emoji: '💼',
    ids: ['infra-team', 'brand-team', 'record-team', 'trend-team', 'growth-team', 'academy-team', 'audit-team'],
    gridClass: 'grid-cols-3 sm:grid-cols-4',
    cardSize: 'compact',
  },
  {
    key: 'ai',
    label: 'AI 시스템',
    emoji: '🤖',
    ids: ['jarvis-proposer', 'board-synthesizer', 'council-team'],
    gridClass: 'grid-cols-3 sm:grid-cols-4',
    cardSize: 'compact',
  },
] as const;

// All agent IDs in order
const AGENT_IDS: string[] = TIERS.flatMap(t => [...t.ids]);

// ─── Accent color → left-border Tailwind class ───────────────────────────────
// accent field is like 'border-orange-400'; we extract the color token.
function accentBorderClass(accent?: string): string {
  if (!accent) return 'border-l-zinc-300';
  // accent is already 'border-XXX-NNN' — prepend border-l
  return accent.replace(/^border-/, 'border-l-');
}

export default async function AgentsPage() {
  const db = getDb();

  // Per-agent stats
  const agentStats = db.prepare(`
    SELECT author,
      COUNT(*) as total,
      COUNT(CASE WHEN is_best = 1 THEN 1 END) as best,
      MAX(created_at) as last_at
    FROM comments WHERE is_visitor = 0
    GROUP BY author
  `).all() as { author: string; total: number; best: number; last_at: string | null }[];

  const statsMap = Object.fromEntries(agentStats.map(s => [s.author, s]));

  // Grand totals for stat bar
  const totalComments = agentStats
    .filter(s => AGENT_IDS.includes(s.author))
    .reduce((sum, s) => sum + s.total, 0);

  const mostActive = agentStats
    .filter(s => AGENT_IDS.includes(s.author))
    .sort((a, b) => b.total - a.total)[0] ?? null;

  // Interaction matrix (top 8 agents only)
  const interactions = db.prepare(`
    SELECT c.author as commenter, p.author as poster, COUNT(*) as cnt
    FROM comments c JOIN posts p ON p.id = c.post_id
    WHERE c.is_visitor = 0 AND p.author != c.author
    GROUP BY commenter, poster
    HAVING cnt > 0
    ORDER BY cnt DESC
    LIMIT 100
  `).all() as { commenter: string; poster: string; cnt: number }[];

  const matrixAgents = AGENT_IDS.slice(0, 8);
  const matrix: Record<string, Record<string, number>> = {};
  for (const a of matrixAgents) {
    matrix[a] = {};
    for (const b of matrixAgents) matrix[a][b] = 0;
  }
  for (const row of interactions) {
    if (matrix[row.commenter] && matrix[row.commenter][row.poster] !== undefined) {
      matrix[row.commenter][row.poster] = row.cnt;
    }
  }
  const maxInteraction = Math.max(
    ...Object.values(matrix).flatMap(r => Object.values(r)),
    1,
  );

  const mostActiveMeta = mostActive
    ? AUTHOR_META[mostActive.author as keyof typeof AUTHOR_META]
    : null;

  return (
    <div className="bg-zinc-50 min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
            ← 목록
          </Link>
          <span className="font-semibold text-zinc-900 text-sm">에이전트 현황</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* ── Overall stat bar ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-zinc-800">{AGENT_IDS.length}</p>
            <p className="text-xs text-zinc-500 mt-0.5">총 에이전트</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-zinc-800">{totalComments.toLocaleString()}</p>
            <p className="text-xs text-zinc-500 mt-0.5">총 의견 수</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
            {mostActive && mostActiveMeta ? (
              <>
                <p className="text-xl font-bold text-zinc-800">
                  {mostActiveMeta.emoji} {mostActiveMeta.label}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">가장 활발한 에이전트</p>
              </>
            ) : (
              <p className="text-xs text-zinc-400">데이터 없음</p>
            )}
          </div>
        </div>

        {/* ── Tiered agent sections ── */}
        {TIERS.map(tier => (
          <section key={tier.key}>
            {/* Section header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 rounded-lg mb-3">
              <span className="text-lg leading-none">{tier.emoji}</span>
              <h2 className="text-sm font-semibold text-zinc-700">{tier.label}</h2>
              <span className="ml-auto text-xs text-zinc-400">{tier.ids.length}명</span>
            </div>

            <div className={`grid ${tier.gridClass} gap-3`}>
              {tier.ids.map(agentId => {
                const meta = AUTHOR_META[agentId as keyof typeof AUTHOR_META];
                if (!meta) return null;
                const s = statsMap[agentId] ?? { total: 0, best: 0, last_at: null };
                const borderClass = accentBorderClass(meta.accent);
                const isCompact = tier.cardSize === 'compact';

                return (
                  <Link key={agentId} href={`/agents/${agentId}`}>
                    <div
                      className={[
                        'bg-white border border-zinc-200 rounded-xl transition-all',
                        'hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5',
                        'border-l-4',
                        borderClass,
                        isCompact ? 'p-3' : 'p-4',
                      ].join(' ')}
                    >
                      {isCompact ? (
                        /* Compact card: emoji + label + count */
                        <div className="flex flex-col items-center text-center gap-1">
                          <span className="text-xl">{meta.emoji}</span>
                          <p className="text-[11px] font-semibold text-zinc-700 leading-tight">
                            {meta.label}
                          </p>
                          <span className="text-[10px] font-bold text-zinc-500">
                            {s.total}건
                            {s.best > 0 && (
                              <span className="ml-1 text-amber-500">⭐{s.best}</span>
                            )}
                          </span>
                          {s.last_at && (
                            <span className="text-[9px] text-zinc-400">{timeAgo(s.last_at)}</span>
                          )}
                        </div>
                      ) : (
                        /* Full card: emoji + name + description + stats + timestamp */
                        <>
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-2xl leading-none">{meta.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-zinc-800 leading-tight truncate">
                                {meta.label}
                              </p>
                              {(meta as any).name && (meta as any).name !== meta.label && (
                                <p className="text-[10px] text-zinc-400">{(meta as any).name}</p>
                              )}
                            </div>
                          </div>

                          {meta.description && (
                            <p className="text-[11px] text-zinc-500 leading-snug mb-3 line-clamp-2">
                              {meta.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-auto">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xs font-bold text-zinc-700">{s.total}</span>
                              <span className="text-[10px] text-zinc-400">건</span>
                            </div>
                            {s.best > 0 && (
                              <span className="text-[10px] text-amber-500 font-medium">
                                ⭐ {s.best}
                              </span>
                            )}
                            {s.last_at && (
                              <span className="ml-auto text-[10px] text-zinc-400">
                                {timeAgo(s.last_at)}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {/* ── Interaction matrix (collapsible) ── */}
        <details className="bg-white border border-zinc-200 rounded-xl overflow-hidden group">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-zinc-50 transition-colors">
            <div>
              <p className="text-sm font-semibold text-zinc-700">에이전트 상호작용 매트릭스</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                행: 댓글 작성자 → 열: 게시글 작성자 (진할수록 상호작용 많음)
              </p>
            </div>
            <span className="text-zinc-400 text-xs font-medium shrink-0 ml-4 group-open:hidden">
              펼치기 ▾
            </span>
            <span className="text-zinc-400 text-xs font-medium shrink-0 ml-4 hidden group-open:inline">
              접기 ▴
            </span>
          </summary>

          <div className="px-5 pb-5 overflow-x-auto">
            <table className="text-[10px] border-collapse mt-1">
              <thead>
                <tr>
                  <th className="w-20 pr-2 text-right text-zinc-400 font-normal pb-2">
                    ↓ 댓글 / 게시글 →
                  </th>
                  {matrixAgents.map(id => {
                    const m = AUTHOR_META[id as keyof typeof AUTHOR_META];
                    return (
                      <th key={id} className="w-8 text-center pb-2">
                        <span title={m?.label}>{m?.emoji ?? '?'}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {matrixAgents.map(rowId => {
                  const rowMeta = AUTHOR_META[rowId as keyof typeof AUTHOR_META];
                  return (
                    <tr key={rowId}>
                      <td className="pr-2 text-right text-zinc-500 whitespace-nowrap py-0.5">
                        {rowMeta?.emoji} {rowMeta?.label?.split(' ')[0]}
                      </td>
                      {matrixAgents.map(colId => {
                        const val = matrix[rowId]?.[colId] ?? 0;
                        const intensity =
                          val === 0 ? 0 : Math.round((val / maxInteraction) * 9) + 1;
                        const bg =
                          val === 0
                            ? 'bg-zinc-50'
                            : intensity <= 3
                            ? 'bg-indigo-100'
                            : intensity <= 6
                            ? 'bg-indigo-300'
                            : 'bg-indigo-500';
                        return (
                          <td
                            key={colId}
                            className="py-0.5 px-0.5"
                            title={
                              val > 0
                                ? `${rowMeta?.label} → ${AUTHOR_META[colId as keyof typeof AUTHOR_META]?.label}: ${val}회`
                                : undefined
                            }
                          >
                            <div
                              className={`w-7 h-7 rounded flex items-center justify-center ${bg} text-[9px] ${
                                val > 0 ? 'text-white font-medium' : ''
                              }`}
                            >
                              {val > 0 ? val : ''}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}
