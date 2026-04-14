/**
 * 자비스 컴퍼니 팀 레지스트리 (Single Source of Truth)
 *
 * 왜 이 파일이 존재하는가:
 *   이전에는 팀 키워드가 3군데에 독립 정의되어 있었다:
 *     1. app/api/entity/[id]/briefing/route.ts 의 ENTITIES
 *     2. app/api/game/chat/route.ts 의 TEAM_KEYWORDS
 *     3. 같은 파일의 buildTeamSummary() 내부 하드코딩 리스트
 *   → 재무실 분리 같은 구조 변경이 있을 때 한 군데만 갱신되고 나머지는
 *      드리프트 해서 요약 문장이 깨지거나("... 에서 문제가 있었어요.")
 *      브리핑 통계와 팀장 채팅 답변이 서로 모순되는 버그가 발생했다.
 *
 * 이 파일의 규칙:
 *   - 팀 추가/병합/분리 시 **오직 이 파일만** 수정한다.
 *   - 두 API 라우트는 이 파일에서 keywords / persona / metadata 를 import 한다.
 *   - hardcoded 키워드 리스트를 새로 만들지 말 것. entity.keywords 를 쓸 것.
 *
 * 재발 방지:
 *   - entity-level 드리프트는 컴파일 타임에 TypeScript 가 잡는다.
 *   - cron 키워드 드리프트는 이 파일 1개만 보면 되므로 사람 리뷰가 가능.
 */

export type TeamEntityType = 'team-lead' | 'system-metric';

export interface TeamEntityDef {
  /** 엔티티 고유 ID — 방 id / briefing 라우트 id / chat teamId 공통 */
  id: string;
  type: TeamEntityType;
  /** 디스플레이 네임 ("SRE실 · 이준혁") */
  name: string;
  /** 한 줄 타이틀 */
  title?: string;
  /** 이모지 아바타 */
  avatar?: string;
  /** 시스템 메트릭용 아이콘 */
  icon?: string;
  /** 간략 설명 (system-metric용) */
  description?: string;
  /** cron.log 매칭용 키워드 — SSoT. 여기 한 곳만 수정한다. */
  keywords: string[];
  /** 담당 Discord 채널 */
  discordChannel?: string;
  /** 스케줄 요약 */
  schedule?: string;
  /**
   * 팀장 NPC 페르소나 한 줄 (NPC_RULES는 chat/route.ts에서 뒤에 붙인다).
   * team-lead 타입은 반드시 채워야 한다.
   */
  persona?: string;
}

/**
 * 모든 팀 엔티티의 SSoT.
 * 키: 엔티티 ID. 값: 정의.
 */
export const TEAM_REGISTRY: Record<string, TeamEntityDef> = {
  // ═══════════════════════════════════════════════════════════════════════
  // 팀장 엔티티 (9개)
  // ═══════════════════════════════════════════════════════════════════════

  'infra-lead': {
    id: 'infra-lead',
    type: 'team-lead',
    name: 'SRE실 · 이준혁',
    title: '신뢰성 엔지니어링 · 예방적 시스템 운영',
    avatar: '🛡️',
    keywords: [
      'infra-daily', 'system-doctor', 'system-health', 'health',
      'disk', 'glances', 'scorecard', 'aggregate-metrics',
      'memory-cleanup', 'memory-expire', 'memory-sync', 'rate-limit-check',
    ],
    discordChannel: 'jarvis-system',
    schedule: '매일 09:00',
    persona: '나는 SRE실장 이준혁입니다. 서버, 디스크, 크론, Discord 봇 상태를 관리합니다. 예방적 신뢰성 엔지니어링을 추구하며, 장애 발생 전에 선제 조치를 취합니다. 돈 관련(TQQQ/market/cost-monitor)은 재무실 소관입니다.',
  },

  'trend-lead': {
    id: 'trend-lead',
    type: 'team-lead',
    name: '전략기획실 · 강나연',
    title: '뉴스·기술 트렌드 분석',
    avatar: '📡',
    keywords: ['trend', 'news', 'calendar-alert', 'github-monitor', 'recon'],
    discordChannel: 'jarvis',
    schedule: '평일 07:30',
    persona: '나는 전략기획실장 강나연입니다. 뉴스, 기술 트렌드, GitHub 동향을 분석합니다. 시장/주식 지표는 재무실 소관이라 다루지 않습니다.',
  },

  finance: {
    id: 'finance',
    type: 'team-lead',
    name: '재무실 · 장원석',
    title: 'AI 운영 비용 + 시장 포지션 + 개인 수입 통합',
    avatar: '💰',
    keywords: [
      'tqqq', 'market-alert', 'stock', 'macro',
      'finance-monitor', 'cost-monitor', 'preply', 'personal-schedule',
    ],
    discordChannel: 'jarvis-ceo',
    schedule: '매일',
    persona: '나는 재무실장 장원석입니다. 자비스 AI 운영 비용, TQQQ·시장 포지션, 오너 Preply 수입, 손익 추적을 담당합니다. 숫자와 통화는 정확하게 전달합니다.',
  },

  'record-lead': {
    id: 'record-lead',
    type: 'team-lead',
    name: '데이터실 · 한소희',
    title: '메모리·RAG 아카이빙',
    avatar: '🗄️',
    keywords: ['record-daily', 'memory', 'session-sum', 'compact', 'rag-index'],
    discordChannel: 'jarvis-system',
    schedule: '매일 22:30',
    persona: '나는 데이터실장 한소희입니다. 일일 대화 기록, RAG 인덱싱, 데이터 아카이빙 등 백엔드 업무를 담당합니다. 사용자 검색 UI는 자료실(문지아) 소관입니다.',
  },

  library: {
    id: 'library',
    type: 'team-lead',
    name: '자료실 · 문지아',
    title: '전사 지식 베이스 프론트엔드',
    avatar: '📖',
    keywords: ['rag-index', 'rag-bench'],
    discordChannel: 'jarvis-system',
    schedule: '상시',
    persona: '나는 자료실 사서 문지아입니다. 데이터실이 쌓은 RAG 인덱스와 오너 메모리 파일을 사용자가 검색·탐색할 수 있도록 돕는 프론트엔드를 담당합니다.',
  },

  'growth-lead': {
    id: 'growth-lead',
    type: 'team-lead',
    name: '인재개발실 · 김서연',
    title: '커리어·면접·기술 학습 통합',
    avatar: '🌱',
    keywords: [
      'career', 'commitment', 'growth', 'job', 'resume', 'interview',
      'academy', 'learning', 'study', 'lecture',
    ],
    discordChannel: 'jarvis-ceo',
    schedule: '매주',
    persona: '나는 인재개발실장 김서연입니다. 기술 학습(CS/아키텍처/책 요약)과 이직 준비(채용·이력서·면접)를 한 곳에서 관리합니다.',
  },

  'brand-lead': {
    id: 'brand-lead',
    type: 'team-lead',
    name: '마케팅실 · 정하은',
    title: 'OSS·블로그·콘텐츠 전략',
    avatar: '📣',
    keywords: ['brand', 'openclaw', 'blog', 'oss', 'github-star'],
    discordChannel: 'jarvis-blog',
    schedule: '매주 화 08:00',
    persona: '나는 마케팅실장 정하은입니다. 오픈소스 전략, 기술 블로그, GitHub 성장을 관리합니다.',
  },

  'audit-lead': {
    id: 'audit-lead',
    type: 'team-lead',
    name: 'QA실 · 류태환',
    title: '품질·감사·E2E 테스트',
    avatar: '🔍',
    keywords: ['audit', 'cron-failure', 'kpi', 'e2e', 'regression', 'doc-sync'],
    discordChannel: 'jarvis-system',
    schedule: '매일 23:00',
    persona: '나는 QA실장 류태환입니다. 크론 실패 추적, E2E 테스트, 시스템 품질을 감시합니다.',
  },

  secretary: {
    id: 'secretary',
    type: 'team-lead',
    name: '컨시어지 · 자비스 봇',
    title: 'Discord 24/7 대응 · 봇 품질 자가 점검',
    avatar: '🤵',
    keywords: [
      'bot-quality', 'bot-self-critique', 'auto-diagnose',
      'skill-eval', 'ask-claude', 'weekly-usage-stats',
    ],
    discordChannel: 'jarvis',
    schedule: '상시',
    persona: '나는 컨시어지 담당 자비스 봇입니다. Discord 24/7 응답, 봇 품질 자가 점검, /ask·/logs·/brief 슬래시 명령을 관리합니다. 봇이 죽으면 전사 CS가 멈춥니다.',
  },

  // ── 대표실 — 별도 엔드포인트(presidentBriefingGET)로 처리되지만 ──
  //    keyword/persona 는 chat 과 공유해야 해서 여기 등록.
  president: {
    id: 'president',
    type: 'team-lead',
    name: '대표실 · 이정우',
    title: 'AI 경영 + 오너 개인 데이터 통합',
    avatar: '🏛️',
    keywords: [
      'board-meeting', 'ceo-daily-digest', 'council', 'scorecard',
      'connections', 'weekly-kpi', 'monthly-review',
    ],
    discordChannel: 'jarvis-ceo',
    schedule: '매일',
    persona: '나는 자비스 컴퍼니의 대표 이정우입니다. AI 경영 현황(이사회·KPI·경영 점검)과 개인 데이터(약속·Claude 세션·메모리)를 통합 관리하는 이정우 본인의 공간이라 답변합니다.',
  },

  // ── 회의실 — 모닝 스탠드업 전용 엔드포인트로 처리. persona만 공유. ──
  standup: {
    id: 'standup',
    type: 'team-lead',
    name: '회의실 · 모닝 스탠드업',
    title: '전사 모닝 브리핑',
    avatar: '🎤',
    keywords: ['standup', 'morning-brief', 'board-meeting'],
    discordChannel: 'jarvis-ceo',
    schedule: '매일 09:15 KST',
    persona: '나는 회의실 진행 담당입니다. 매일 09:15 KST에 전사 시스템 상태와 오늘 예정 크론, 주요 이슈를 요약해 Discord로 전송합니다.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 시스템 메트릭 엔티티 (6개) — keywords 는 chat 컨텍스트용 근사치
  // ═══════════════════════════════════════════════════════════════════════

  'cron-engine': {
    id: 'cron-engine',
    type: 'system-metric',
    name: '크론 엔진',
    icon: '📊',
    description: '자동화 태스크 실행 엔진',
    keywords: [],
    persona: '나는 크론 엔진 총괄입니다. 자동화 태스크 스케줄링과 실행 상태를 관리합니다.',
  },

  'rag-memory': {
    id: 'rag-memory',
    type: 'system-metric',
    name: 'RAG 장기기억',
    icon: '🧠',
    description: 'LanceDB 벡터 검색 + BM25 하이브리드',
    keywords: ['rag-index', 'memory-sync'],
    persona: '나는 RAG 장기기억 담당입니다. LanceDB 벡터 인덱스와 메모리 스냅샷 상태를 관리합니다.',
  },

  'discord-bot': {
    id: 'discord-bot',
    type: 'system-metric',
    name: 'Discord 봇',
    icon: '🤖',
    description: '24/7 대화형 인터페이스',
    keywords: ['discord', 'bot-watchdog', 'bot-restart'],
    persona: '나는 Discord 봇 담당입니다. 봇 프로세스 상태와 채팅 시스템을 관리합니다.',
  },

  'disk-storage': {
    id: 'disk-storage',
    type: 'system-metric',
    name: '디스크 스토리지',
    icon: '💾',
    description: '로컬 스토리지 사용량',
    keywords: ['disk', 'log-cleanup'],
    persona: '나는 디스크 스토리지 담당입니다. 로컬 스토리지 사용량과 정리 상태를 관리합니다.',
  },

  'circuit-breaker': {
    id: 'circuit-breaker',
    type: 'system-metric',
    name: '서킷 브레이커',
    icon: '🛡️',
    description: '연속 실패 태스크 격리 시스템',
    keywords: [],
    persona: '나는 서킷 브레이커 담당입니다. 연속 실패 태스크를 격리하고 자동 쿨다운을 관리합니다.',
  },

  'dev-queue': {
    id: 'dev-queue',
    type: 'system-metric',
    name: '개발 큐',
    icon: '📋',
    description: 'AI 자동 코딩 태스크 대기열',
    keywords: ['dev-runner', 'agent-batch-commit'],
    persona: '나는 개발 큐 담당입니다. AI 자동 코딩 태스크 대기열을 관리합니다.',
  },
};

/**
 * 팀장 타입만 필터링한 엔트리.
 * Object.fromEntries 로 record 형태 유지.
 */
export const TEAM_LEADS: Record<string, TeamEntityDef> = Object.fromEntries(
  Object.entries(TEAM_REGISTRY).filter(([, e]) => e.type === 'team-lead'),
);

/**
 * teamId → keywords 맵 (기존 TEAM_KEYWORDS / ENTITIES.keywords 대체).
 * 새 키워드 리스트를 만들 때는 이 맵을 참조할 것.
 */
export const TEAM_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(TEAM_REGISTRY).map(([id, e]) => [id, e.keywords]),
);

/**
 * 특정 팀의 키워드를 가져온다. 없으면 빈 배열.
 * buildTeamSummary 같은 함수에서 하드코딩 대신 호출.
 */
export function getTeamKeywords(teamId: string): string[] {
  return TEAM_REGISTRY[teamId]?.keywords ?? [];
}

/**
 * 특정 팀의 NPC persona 프롬프트를 반환한다.
 * chat/route.ts 에서 TEAM_PROMPTS[id] || fallback 형태로 소비.
 */
export function getTeamPersona(teamId: string): string | undefined {
  return TEAM_REGISTRY[teamId]?.persona;
}
