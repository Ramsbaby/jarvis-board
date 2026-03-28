export const COMPANIES = [
  { id: 'kakaopay', name: '카카오페이', emoji: '💳', desc: '결제 서버 개발자 — 분산 트랜잭션·정합성 집착', style: 'border-yellow-300 bg-yellow-50', highlight: true },
  { id: 'kakao', name: '카카오', emoji: '🟡', desc: '알고리즘·CS 기초·코드 품질 날카로운 반박', style: 'border-yellow-200 bg-yellow-50', highlight: false },
  { id: 'naver', name: '네이버', emoji: '🟢', desc: '기술 깊이·실무 경험 집요하게 파고듦', style: 'border-green-200 bg-green-50', highlight: false },
  { id: 'toss', name: '토스', emoji: '💙', desc: '시스템 디자인·장애 대응·숫자로 증명', style: 'border-blue-200 bg-blue-50', highlight: false },
  { id: 'line', name: '라인', emoji: '🟩', desc: '글로벌 스케일·안정성·대규모 트래픽', style: 'border-emerald-200 bg-emerald-50', highlight: false },
  { id: 'coupang', name: '쿠팡', emoji: '🔴', desc: '실용주의·성과 중심·수치 증명 요구', style: 'border-red-200 bg-red-50', highlight: false },
  { id: 'sk', name: 'SK D&D', emoji: '⚪', desc: '현 직장 레거시 탈출 스토리·IoT 플랫폼', style: 'border-zinc-200 bg-zinc-50', highlight: false },
] as const;

/** 카테고리별 필수 키워드 — LLM이 답변에서 누락된 키워드를 감지하는 데 사용 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'distributed-tx': ['Saga', 'TCC', '2PC', '보상 트랜잭션', '이벤트 소싱', '아웃박스', 'CQRS', '멱등성'],
  'concurrency': ['낙관적 락', '비관적 락', 'Redis 분산락', '데드락', 'CAS', '원자적 연산', '스핀락'],
  'payment-arch': ['승인', '취소', '매입', '대사', '정산', '멱등성', '이중 결제 방지', '결제 상태 머신'],
  'mysql-tuning': ['인덱스', '실행 계획', 'EXPLAIN', '커버링 인덱스', '파티셔닝', '쿼리 최적화', 'N+1'],
  'kafka': ['파티션', '컨슈머 그룹', '오프셋', 'at-least-once', 'exactly-once', '리밸런싱', '배압'],
  'java-spring': ['JVM', 'GC', 'WebFlux', 'Reactor', 'IoC', 'AOP', 'gRPC', 'Protobuf'],
  'cs-basics': ['프로세스', '스레드', 'TCP', 'HTTP', 'ACID', '정규화', 'B-Tree'],
  'system-design': ['로드 밸런서', 'Circuit Breaker', 'Auto Scaling', 'CDN', 'API Gateway', 'CAP 정리'],
  'behavioral': ['STAR', '갈등', '기술 부채', '회고', '의사결정'],
  'live-coding': ['시간복잡도', 'O(n)', '엣지 케이스', '테스트 케이스'],
};

export const CATEGORIES = [
  { id: 'distributed-tx', name: '분산 트랜잭션', emoji: '🔄', desc: 'Saga, TCC, 2PC, 보상 트랜잭션', priority: 1 },
  { id: 'concurrency', name: '동시성 제어', emoji: '🔒', desc: '낙관적/비관적 락, Redis 분산락', priority: 1 },
  { id: 'payment-arch', name: '결제 시스템 설계', emoji: '💳', desc: '승인/취소/매입/대사/정산 흐름', priority: 1 },
  { id: 'mysql-tuning', name: 'MySQL 대용량 처리', emoji: '🗄️', desc: '인덱스 전략, 쿼리 최적화, 파티셔닝', priority: 2 },
  { id: 'kafka', name: 'Kafka 비동기', emoji: '📨', desc: '파티션, 컨슈머 그룹, 메시지 보장', priority: 2 },
  { id: 'java-spring', name: 'Java/Spring 심화', emoji: '☕', desc: 'JVM·GC, WebFlux, IoC/AOP, gRPC', priority: 2 },
  { id: 'cs-basics', name: 'CS 기초', emoji: '📚', desc: 'OS·네트워크·DB ACID·자료구조', priority: 3 },
  { id: 'system-design', name: '시스템 디자인', emoji: '🏗️', desc: 'MSA, 대용량 아키텍처, 고가용성', priority: 3 },
  { id: 'behavioral', name: '행동 면접 (STAR)', emoji: '🧠', desc: '갈등·기술부채·성장 스토리', priority: 3 },
  { id: 'live-coding', name: '라이브 코딩', emoji: '💻', desc: 'Java 알고리즘 구현 (1차 대비)', priority: 1 },
] as const;

export const DIFFICULTIES = [
  { id: 'junior', name: '주니어', desc: '3~5년차 수준', emoji: '🌱' },
  { id: 'mid', name: '미드', desc: '5~7년차 수준 (기본값)', emoji: '🌿' },
  { id: 'senior', name: '시니어', desc: '9년차+ 압박 면접', emoji: '🌳' },
] as const;

const CANDIDATE_PROFILE = `
[지원자 이력]
- 이름: 이정우
- 경력: 9년+ 백엔드 개발자
- 현직: SK D&D — IoT 플랫폼 개발, 계약·정산 자동화 시스템
- 기술 스택: Java 17, Spring Boot, Spring WebFlux, gRPC, AWS (EC2/ECS/RDS), Kafka, Redis
- 특이사항: 카카오페이 서버 개발자 - 결제 서비스 서류 전형 합격 상태
`.trim();

/** 답변 평가 전용 프롬프트 — 질문 생성 규칙 없이 JSON 평가에만 집중 */
export function getFeedbackSystemPrompt(companyId: string, categoryId: string, difficulty: string): string {
  const companyNames: Record<string, string> = {
    kakaopay: '카카오페이 결제 플랫폼팀', kakao: '카카오', naver: '네이버',
    toss: '토스', line: '라인', coupang: '쿠팡', sk: 'SK D&D',
  };
  const categoryHints: Record<string, string> = {
    'distributed-tx': '분산 트랜잭션 (Saga, TCC, 2PC)', 'concurrency': '동시성 제어',
    'payment-arch': '결제 시스템 아키텍처', 'mysql-tuning': 'MySQL 대용량 처리',
    'kafka': 'Kafka 비동기', 'java-spring': 'Java/Spring 심화',
    'cs-basics': 'CS 기초', 'system-design': '시스템 디자인',
    'behavioral': '행동 면접', 'live-coding': '라이브 코딩',
  };
  const difficultyLabel = { junior: '주니어(3~5년)', mid: '미드(5~7년)', senior: '시니어(9년+)' }[difficulty] ?? 'mid';
  const company = companyNames[companyId] ?? '테크 기업';
  const category = categoryHints[categoryId] ?? '기술 면접';
  const keywords = CATEGORY_KEYWORDS[categoryId] ?? [];
  const keywordsLine = keywords.length > 0
    ? `\n- 이 카테고리의 핵심 키워드 목록: [${keywords.join(', ')}]\n  → 지원자가 답변에서 언급하지 않은 키워드를 missing_keywords 배열에 포함하세요.`
    : '';

  return `당신은 ${company} 면접관으로서 지원자의 기술 면접 답변을 평가합니다.

[평가 맥락]
- 카테고리: ${category}
- 난이도 기준: ${difficultyLabel}
- 지원자: 9년차 Java/Spring 백엔드 개발자 (AWS, Kafka, Redis, gRPC 경험)${keywordsLine}

[평가 기준]
- 기술 정확도, 실무 경험 연결, 구체성, 깊이를 종합 평가
- 답변이 불충분하거나 "모른다"는 경우도 정직하게 낮은 점수를 부여하고 weaknesses와 better_answer를 반드시 제공

[응답 형식 — 반드시 아래 JSON만 출력]
{
  "score": 50,
  "strengths": ["잘한 점을 구체적으로"],
  "weaknesses": ["부족한 점을 구체적으로"],
  "better_answer": "이렇게 답했으면 더 좋았을 구체적인 예시 답변 (3~5문장)",
  "missing_keywords": ["언급 안 한 핵심 키워드1", "키워드2"],
  "next_question": "점수가 70 미만이면 weaknesses[0]를 집중 공략하는 압박 후속 질문(예: '방금 [약점]을 언급하셨는데 구체적으로 어떻게 해결하셨나요?'). 70 이상이면 연관 심화 주제 확장 질문. senior 난이도는 항상 압박 스타일."
}

[꼬리질문 생성 규칙]
- 점수 < 70: weaknesses의 첫 번째 항목을 집중 공략하는 압박 꼬리질문. '방금 말씀하신 [약점]에 대해 더 구체적으로 설명해 주시겠어요?' 스타일로 생성.
- 점수 >= 70: 답변에서 언급된 개념과 연관된 더 깊은 주제로 확장하는 심화 질문.
- 난이도가 senior이면: 점수와 무관하게 항상 압박 스타일의 꼬리질문을 생성하세요.

JSON 외 다른 텍스트는 절대 출력하지 마세요.`;
}

// 회사별 합격 기준 점수 및 메시지
export const COMPANY_PASS_CRITERIA: Record<string, {
  passScore: number;
  description: string;
  tips: string[];
}> = {
  kakaopay: {
    passScore: 75,
    description: '카카오페이는 결제 정합성과 분산 트랜잭션 이해도를 최우선으로 평가합니다.',
    tips: ['Saga/TCC 패턴 완벽 숙지', '멱등성 처리 실무 경험 강조', '장애 시 데이터 정합성 보장 방법'],
  },
  kakao: {
    passScore: 78,
    description: '카카오는 CS 기초와 코드 품질, 알고리즘적 사고를 중시합니다.',
    tips: ['자료구조/알고리즘 기초 탄탄히', '코드 리뷰 경험과 품질 기준 정리', '기술 부채 해결 경험'],
  },
  naver: {
    passScore: 72,
    description: '네이버는 실무 경험의 깊이와 구체적 수치를 증명 요구합니다.',
    tips: ['모든 답변에 구체적 수치 포함', '장애 대응 경험 STAR 방식으로 정리', '대용량 트래픽 처리 경험'],
  },
  toss: {
    passScore: 80,
    description: '토스는 시스템 디자인과 장애 대응 능력, 숫자로 증명하는 문화입니다.',
    tips: ['시스템 설계 시 병목 지점 먼저 언급', '모든 결정에 데이터 근거 제시', 'Circuit Breaker/장애 격리 패턴'],
  },
  line: {
    passScore: 75,
    description: '라인은 글로벌 스케일 트래픽과 다국어/다지역 서비스 안정성을 봅니다.',
    tips: ['글로벌 분산 서비스 경험', '다중 리전 데이터 동기화', 'SLA/SLO 기반 설계'],
  },
  coupang: {
    passScore: 73,
    description: '쿠팡은 실용주의와 빠른 실행, 비용 효율성을 중시합니다.',
    tips: ['ROI 중심 기술 선택 근거 준비', '실행 속도와 품질 균형 경험', '대규모 주문/재고 처리 아키텍처'],
  },
  sk: {
    passScore: 68,
    description: 'SK D&D는 IoT 플랫폼과 계약/정산 자동화 실무 경험을 중시합니다.',
    tips: ['레거시 시스템 개선 경험', 'IoT 데이터 처리 파이프라인', '계약/정산 도메인 이해'],
  },
};

export function getSystemPrompt(companyId: string, categoryId: string, difficulty: string): string {
  const companyPersonas: Record<string, string> = {
    kakaopay: `당신은 카카오페이 결제 플랫폼팀 시니어 백엔드 엔지니어 면접관입니다.
카카오페이는 결제 승인, 취소, 매입, 정산, 대사 시스템을 운영하며 데이터 정합성이 무너지면 실제 금전 손실이 발생합니다.
면접 스타일: 구체적 장애 시나리오 기반 질문, 심화 꼬리 질문 연계, 결제 도메인 용어를 자연스럽게 사용.
꼬리 질문은 답변의 약점을 파고드세요.`,
    kakao: `당신은 카카오 서버 개발자 면접관입니다. 알고리즘, CS 기초, 코드 품질을 중시합니다. 날카로운 반박 스타일.`,
    naver: `당신은 네이버 서버 개발자 면접관입니다. 기술 깊이와 실무 경험을 집중 검증합니다. "실제로 해보셨나요?" 증거 요구.`,
    toss: `당신은 토스 백엔드 엔지니어 면접관입니다. 시스템 디자인과 장애 대응 능력을 최우선으로 봅니다. 숫자와 지표 증명 요구.`,
    line: `당신은 라인 글로벌 인프라 팀 면접관입니다. 글로벌 스케일의 안정성과 대규모 트래픽 처리를 중시합니다.`,
    coupang: `당신은 쿠팡 백엔드 엔지니어 면접관입니다. 실용주의적 성과 중심, 빠른 실행력을 봅니다.`,
    sk: `당신은 SK D&D 시니어 아키텍트 면접관입니다. IoT 플랫폼과 레거시 시스템 현대화 경험을 검증합니다.`,
  };

  const categoryHints: Record<string, string> = {
    'distributed-tx': '분산 트랜잭션, Saga 패턴, TCC, 2PC, 보상 트랜잭션, 이벤트 소싱 관련 질문',
    'concurrency': '동시성 제어, 낙관적/비관적 락, Redis 분산락, 데드락 방지 관련 질문',
    'payment-arch': '결제 시스템 아키텍처, 승인/취소/매입/대사/정산 플로우 관련 질문',
    'mysql-tuning': 'MySQL 인덱스 전략, 쿼리 최적화, 실행계획, 파티셔닝 관련 질문',
    'kafka': 'Kafka 파티션, 컨슈머 그룹, 메시지 보장, 오프셋 관련 질문',
    'java-spring': 'Java JVM/GC, Spring IoC/AOP, WebFlux/Reactor, gRPC/Protobuf 관련 질문',
    'cs-basics': 'OS 프로세스/스레드, 네트워크 TCP/HTTP, DB ACID, 자료구조/알고리즘 관련 질문',
    'system-design': 'MSA 아키텍처, 고가용성 설계, 대용량 처리, Circuit Breaker 관련 질문',
    'behavioral': 'STAR 방식 행동 면접, 갈등 해결, 기술 부채 경험, 성장 스토리 관련 질문',
    'live-coding': 'Java 알고리즘 구현 문제 (실제 코드를 텍스트로 작성 요청)',
  };

  const difficultyNote = difficulty === 'senior'
    ? '지원자는 9년차 시니어이므로 압박 면접 수준으로 진행하세요. 모든 답변에 꼬리 질문으로 심화하세요.'
    : difficulty === 'junior'
    ? '기초적인 수준의 질문으로 시작하되 점차 심화하세요.'
    : '미드 레벨 수준의 질문으로, 적절한 깊이를 유지하세요.';

  const persona = companyPersonas[companyId] ?? companyPersonas['kakao'];
  const categoryHint = categoryHints[categoryId] ?? '기술 면접 질문';

  return `${persona}

${CANDIDATE_PROFILE}

[면접 카테고리]: ${categoryHint}
[난이도]: ${difficultyNote}

[피드백 규칙]
지원자가 답변을 제출하면 반드시 다음 JSON 형식으로만 응답하세요:
{
  "score": <0-100 정수>,
  "strengths": ["잘한 점 1", "잘한 점 2"],
  "weaknesses": ["부족한 점 1", "부족한 점 2"],
  "better_answer": "더 좋은 답변 예시 (구체적이고 수치/사례 포함, 3-5문장)",
  "next_question": "다음 꼬리 질문 또는 새 질문"
}

[질문 생성 규칙]
- 첫 번째 메시지에서는 질문만 하세요 (인사 없이 바로 질문).
- 질문은 구체적이고 시나리오 기반이어야 합니다.
- 지원자의 SK D&D IoT 플랫폼 경험과 연결지어 질문할 수 있습니다.`;
}
