export const AUTHOR_META: Record<string, {
  label: string;
  color: string;
  accent: string;
  bg: string;
  description: string;
  emoji: string;
}> = {
  'infra-team':   {
    label: '인프라팀', emoji: '⚙️',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    accent: 'border-blue-400', bg: 'from-blue-50',
    description: '시스템 안정성, 배포, 서버 운영을 담당합니다',
  },
  'audit-team':   {
    label: '감사팀', emoji: '🔍',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    accent: 'border-amber-400', bg: 'from-amber-50',
    description: '코드 품질 검사, 보안 감사, 규정 준수를 담당합니다',
  },
  'brand-team':   {
    label: '브랜드팀', emoji: '📣',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    accent: 'border-purple-400', bg: 'from-purple-50',
    description: '브랜드 전략, 마케팅, 외부 커뮤니케이션을 담당합니다',
  },
  'record-team':  {
    label: '기록팀', emoji: '🗄️',
    color: 'bg-green-50 text-green-700 border-green-200',
    accent: 'border-green-400', bg: 'from-green-50',
    description: '활동 기록, 문서화, 인사이트 아카이브를 담당합니다',
  },
  'trend-team':   {
    label: '정보팀', emoji: '📡',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    accent: 'border-cyan-400', bg: 'from-cyan-50',
    description: '트렌드 분석, 시장 조사, 정보 수집을 담당합니다',
  },
  'growth-team':  {
    label: '성장팀', emoji: '🚀',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    accent: 'border-orange-400', bg: 'from-orange-50',
    description: '사업 성장, 신규 기회 발굴, 파트너십을 담당합니다',
  },
  'academy-team': {
    label: '학습팀', emoji: '📚',
    color: 'bg-pink-50 text-pink-700 border-pink-200',
    accent: 'border-pink-400', bg: 'from-pink-50',
    description: '교육 콘텐츠, 지식 베이스, 팀 역량 강화를 담당합니다',
  },
  'dev-runner':   {
    label: 'Dev Runner', emoji: '🤖',
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    accent: 'border-gray-400', bg: 'from-gray-50',
    description: '자동화 스크립트 실행, 배치 작업, 시스템 태스크를 담당합니다',
  },
  'owner':        {
    label: '대표', emoji: '👤',
    color: 'bg-red-50 text-red-700 border-red-200',
    accent: 'border-red-400', bg: 'from-red-50',
    description: '최종 의사결정, 전략 방향 설정, 팀 전체 조율을 담당합니다',
  },
};

export const TYPE_LABELS: Record<string, string> = {
  decision: '결정', discussion: '논의', issue: '이슈', inquiry: '문의',
};

export const TYPE_COLOR: Record<string, string> = {
  decision: 'bg-blue-50 text-blue-700 border-blue-200',
  discussion: 'bg-gray-100 text-gray-600 border-gray-200',
  issue: 'bg-red-50 text-red-700 border-red-200',
  inquiry: 'bg-purple-50 text-purple-700 border-purple-200',
};

export const PRIORITY_BADGE: Record<string, string> = {
  urgent: '🔴 긴급', high: '🟠 높음', medium: '', low: '',
};

export const STATUS_DOT: Record<string, string> = {
  open: 'bg-emerald-500', 'in-progress': 'bg-amber-400', resolved: 'bg-gray-400',
};

export const STATUS_LABEL: Record<string, string> = {
  open: '토론중', 'in-progress': '진행중', resolved: '결론',
};

export const STATUS_COLOR: Record<string, string> = {
  open: 'text-emerald-600', 'in-progress': 'text-amber-600', resolved: 'text-gray-400',
};

export const TYPE_ICON: Record<string, string> = {
  decision: '✅',
  discussion: '💬',
  issue: '🔴',
  inquiry: '❓',
};
