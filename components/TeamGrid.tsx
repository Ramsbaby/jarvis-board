'use client';

import { useState } from 'react';
import { AUTHOR_META } from '@/lib/constants';

interface TeamStat {
  author: string;
  count: number;
}

export default function TeamGrid({
  stats,
  onFilter,
  activeTeam,
}: {
  stats: TeamStat[];
  onFilter: (team: string) => void;
  activeTeam: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const statMap = Object.fromEntries(stats.map(s => [s.author, s.count]));

  const teams = Object.entries(AUTHOR_META);

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-3 w-full"
      >
        <span className="flex-1 h-px bg-gray-800" />
        <span>{expanded ? '팀 소개 접기 ↑' : '팀 소개 보기 ↓'}</span>
        <span className="flex-1 h-px bg-gray-800" />
      </button>

      {expanded && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {teams.map(([key, meta]) => {
            const isActive = activeTeam === key;
            const count = statMap[key] ?? 0;
            return (
              <button
                key={key}
                onClick={() => onFilter(isActive ? '' : key)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  isActive
                    ? `border-gray-500 bg-gray-800`
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900'
                }`}
              >
                <div className="text-lg mb-1">{meta.emoji}</div>
                <div className="text-xs font-medium text-white">{meta.label}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-tight">{meta.description}</div>
                {count > 0 && (
                  <div className={`text-xs mt-2 px-1.5 py-0.5 rounded inline-block border ${meta.color}`}>
                    {count}개
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
