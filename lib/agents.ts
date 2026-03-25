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

  // ── 추가 실무 담당 ────────────────────────────────────────────────────────────
  { id: 'devops-team',   tier: 'staff', uiGroup: '전문가' },
  { id: 'finance-team',  tier: 'staff', uiGroup: '전문가' },
  { id: 'product-team',  tier: 'staff', uiGroup: '전문가' },
  { id: 'data-team',     tier: 'staff', uiGroup: '전문가' },

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

// ─── 컨텍스트 익명화용 기능 역할 레이블 ─────────────────────────────────────────
// 에이전트에게 다른 에이전트 댓글을 보여줄 때 이름 제거 → 역할 기능만 표시
// (Identity Bias 방지: 직위·이름을 보면 하급 에이전트가 상급에 수렴하는 경향 차단)
export const AGENT_ROLE_LABELS: Readonly<Record<string, string>> = {
  'kim-seonhwi':      'CTO',
  'jung-mingi':       'COO',
  'lee-jihwan':       'CSO',
  'infra-lead':       '인프라리드',
  'career-lead':      '성장리드',
  'brand-lead':       '브랜드리드',
  'finance-lead':     '재무리드',
  'record-lead':      '기록리드',
  'board-synthesizer':'합성AI',
  'infra-team':       '인프라담당',
  'brand-team':       '브랜드담당',
  'record-team':      '기록담당',
  'trend-team':       '시장조사담당',
  'growth-team':      '사업개발담당',
  'academy-team':     '교육담당',
  'audit-team':       '감사담당',
  'llm-critic':       'AI품질담당',
  'devops-team':      'DevOps담당',
  'finance-team':     '재무기획담당',
  'product-team':     '프로덕트담당',
  'data-team':        '데이터담당',
  'jarvis-proposer':  'JarvisAI',
  'council-team':     '전략기획위원회',
};

// ─── 에이전트별 Temperature ───────────────────────────────────────────────────
// 반론·비판형은 높게(다양성 유도), 합성·정리형은 낮게(구조화 출력)
export const AGENT_TEMPERATURE: Readonly<Record<string, number>> = {
  'board-synthesizer': 0.25,  // 구조화 마크다운 출력
  'record-lead':       0.40,
  'record-team':       0.40,
  'finance-lead':      0.45,
  'finance-team':      0.45,
  'data-team':         0.50,
  'jung-mingi':        0.65,  // 실행 중심 — 표준
  'audit-team':        0.85,  // 리스크·반론 발굴
  'llm-critic':        0.85,  // 비판적 AI 검토
  'kim-seonhwi':       0.80,  // 에코챔버 방지 명시
  'lee-jihwan':        0.80,  // 장기 전략 반론
};
export const AGENT_TEMPERATURE_DEFAULT = 0.65;

// ─── 팀 그룹 (에이전트 현황 페이지 팀 단위 표시용) ─────────────────────────────

export interface TeamGroup {
  key: string;
  label: string;
  emoji: string;
  /** 팀 리드 ID (첫 번째가 리드) + 스태프 IDs */
  ids: readonly string[];
}

/** 팀 기반 조직 구조 — 첫 번째 ID가 팀 리드 */
export const TEAM_GROUPS: readonly TeamGroup[] = [
  { key: 'infra',   label: '인프라팀',    emoji: '⚙️',  ids: ['infra-lead', 'infra-team', 'devops-team'] },
  { key: 'brand',   label: '브랜드팀',    emoji: '✨',  ids: ['brand-lead', 'brand-team'] },
  { key: 'growth',  label: '성장팀',      emoji: '📈',  ids: ['career-lead', 'growth-team', 'data-team'] },
  { key: 'finance', label: '재무팀',      emoji: '💰',  ids: ['finance-lead', 'finance-team'] },
  { key: 'record',  label: '기록팀',      emoji: '📝',  ids: ['record-lead', 'record-team'] },
  { key: 'ai',      label: 'AI/프로덕트', emoji: '🧪',  ids: ['llm-critic', 'trend-team', 'product-team'] },
  { key: 'audit',   label: '감사팀',      emoji: '🔍',  ids: ['audit-team'] },
  { key: 'academy', label: '아카데미',    emoji: '📖',  ids: ['academy-team'] },
] as const;
