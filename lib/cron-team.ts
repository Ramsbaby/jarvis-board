/**
 * cron-team.ts — 자동화 이름 → 담당 팀(크론 센터 카드의 소속) 분류
 *
 * 키워드의 정본은 TEAM_REGISTRY(lib/map/team-registry.ts) 의 keywords + cronKeywords 다. 여기서는 고르는 규칙만 정한다.
 *
 * 규칙 (2026-10-03):
 *   1. 'jarvis-' / 'openclaw-' 접두사는 팀 정보가 아니므로 떼고 본다 ('openclaw' 는 마케팅실 키워드와 겹친다).
 *      'jarvis-openclaw-…' 처럼 겹쳐 붙은 것도 모두 뗀다.
 *   2. 이름에 들어 있는 키워드 중 **가장 긴 것**을 가진 팀이 이긴다.
 *      예전에는 팀 순서대로 첫 일치를 골라, 짧고 넓은 키워드가 구체적인 키워드를 가로챘다
 *      (예: 'job-enablement-watch' 가 'job' 때문에 인재개발실, 'growth-monitor'(디스크 비대 감시)가 'growth' 때문에 인재개발실).
 *   3. 길이가 같으면 CRON_TEAM_ORDER 앞쪽 팀이 이긴다 (예전 우선순위 유지).
 */

import { TEAM_REGISTRY } from '@/lib/map/team-registry';

export const CRON_TEAM_ORDER = [
  'finance', 'infra-lead', 'trend-lead',
  'library', 'record-lead',
  'growth-lead', 'brand-lead', 'audit-lead',
  'secretary', 'standup', 'dev-queue', 'president',
] as const;

export interface CronTeam {
  /** TEAM_REGISTRY 키. 미분류면 null */
  id: string | null;
  label: string;
  emoji: string;
}

export const UNCLASSIFIED_TEAM: CronTeam = { id: null, label: '미분류', emoji: '❓' };

export function classifyCronTeam(name: string): CronTeam {
  const lower = name.toLowerCase().replace(/^((jarvis|openclaw)-)+/, '');
  let best: { key: string; len: number } | null = null;
  for (const key of CRON_TEAM_ORDER) {
    const entry = TEAM_REGISTRY[key];
    if (!entry) continue;
    for (const kw of [...entry.keywords, ...(entry.cronKeywords ?? [])]) {
      // 같은 길이면 먼저 본 팀(우선순위 높은 팀)을 유지한다 — 엄격한 '>' 비교
      if (kw && lower.includes(kw) && (!best || kw.length > best.len)) best = { key, len: kw.length };
    }
  }
  if (!best) return UNCLASSIFIED_TEAM;
  const entry = TEAM_REGISTRY[best.key];
  const label = entry.name.includes(' · ') ? entry.name.split(' · ')[0] : entry.name;
  return { id: best.key, label, emoji: entry.avatar || entry.icon || '❓' };
}
