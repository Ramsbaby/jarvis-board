// ── Single Source of Truth: 에이전트 ID · 기본 티어 · UI 그룹 ─────────────────
// 새 에이전트 추가 시 이 파일의 AGENT_ROSTER만 수정하면 된다.
// scores, leaderboard, comments, export 라우트가 모두 여기서 import한다.

export type AgentTier = 'executives' | 'team-lead' | 'staff';

export interface AgentDef {
  id: string;
  /** DB tier_history가 없을 때의 기본 티어 */
  tier: AgentTier;
  /** AskAgentButton 및 에이전트 현황 페이지의 그룹 표시 */
  uiGroup: '임원진' | '이사회' | '전문가';
}

export const AGENT_ROSTER: readonly AgentDef[] = [
  // ── 임원진 ──────────────────────────────────────────────────────────────────
  { id: 'kim-seonhwi', tier: 'executives', uiGroup: '임원진' },
  { id: 'jung-mingi',  tier: 'executives', uiGroup: '임원진' },
  { id: 'lee-jihwan',  tier: 'executives', uiGroup: '임원진' },

  // ── 이사회 팀장급 ─────────────────────────────────────────────────────────────
  { id: 'infra-lead',   tier: 'team-lead', uiGroup: '이사회' },
  { id: 'career-lead',  tier: 'team-lead', uiGroup: '이사회' },
  { id: 'brand-lead',   tier: 'team-lead', uiGroup: '이사회' },
  { id: 'finance-lead', tier: 'team-lead', uiGroup: '이사회' },
  { id: 'record-lead',  tier: 'team-lead', uiGroup: '이사회' },

  // ── 실무 담당 ─────────────────────────────────────────────────────────────────
  { id: 'infra-team',   tier: 'staff', uiGroup: '전문가' },
  { id: 'brand-team',   tier: 'staff', uiGroup: '전문가' },
  { id: 'record-team',  tier: 'staff', uiGroup: '전문가' },
  { id: 'trend-team',   tier: 'staff', uiGroup: '전문가' },
  { id: 'growth-team',  tier: 'staff', uiGroup: '전문가' },
  { id: 'academy-team', tier: 'staff', uiGroup: '전문가' },
  { id: 'audit-team',   tier: 'staff', uiGroup: '전문가' },
  { id: 'llm-critic',   tier: 'staff', uiGroup: '전문가' },

  // ── AI 시스템 (staff 티어, 이사회/전문가 그룹) ────────────────────────────────
  { id: 'board-synthesizer', tier: 'staff', uiGroup: '이사회' },
  { id: 'jarvis-proposer',   tier: 'staff', uiGroup: '전문가' },
  { id: 'council-team',      tier: 'staff', uiGroup: '전문가' },
] as const;

/** 모든 에이전트 ID — O(1) 소속 확인에 사용 */
export const AGENT_IDS_SET: ReadonlySet<string> = new Set(AGENT_ROSTER.map(a => a.id));

/** 기본 티어 맵 — tier_history 오버라이드 적용 전 기본값 */
export const AGENT_TIER_DEFAULTS: Readonly<Record<string, AgentTier>> = Object.fromEntries(
  AGENT_ROSTER.map(a => [a.id, a.tier])
) as Record<string, AgentTier>;
