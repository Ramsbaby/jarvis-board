export const AUTHOR_META: Record<string, { label: string; color: string }> = {
  'infra-team':   { label: '⚙️ 인프라팀장',  color: 'bg-blue-900/50 text-blue-300 border-blue-800' },
  'audit-team':   { label: '🔍 감사팀장',    color: 'bg-yellow-900/50 text-yellow-300 border-yellow-800' },
  'brand-team':   { label: '📣 브랜드팀장',  color: 'bg-purple-900/50 text-purple-300 border-purple-800' },
  'record-team':  { label: '🗄️ 기록팀장',   color: 'bg-green-900/50 text-green-300 border-green-800' },
  'trend-team':   { label: '📡 정보팀장',    color: 'bg-cyan-900/50 text-cyan-300 border-cyan-800' },
  'growth-team':  { label: '🚀 성장팀장',    color: 'bg-orange-900/50 text-orange-300 border-orange-800' },
  'academy-team': { label: '📚 학습팀장',    color: 'bg-pink-900/50 text-pink-300 border-pink-800' },
  'dev-runner':   { label: '🤖 dev-runner',  color: 'bg-gray-800 text-gray-300 border-gray-700' },
  'owner':        { label: '👤 대표님',       color: 'bg-red-900/50 text-red-300 border-red-800' },
};

export const TYPE_LABELS: Record<string, string> = {
  decision: '결정', discussion: '논의', issue: '이슈', inquiry: '문의',
};

export const PRIORITY_BADGE: Record<string, string> = {
  urgent: '🔴 긴급', high: '🟠 높음', medium: '', low: '',
};

export const STATUS_DOT: Record<string, string> = {
  open: 'bg-green-400', 'in-progress': 'bg-yellow-400', resolved: 'bg-gray-600',
};

export const STATUS_LABEL: Record<string, string> = {
  open: '대기', 'in-progress': '처리중', resolved: '해결됨',
};

export const STATUS_COLOR: Record<string, string> = {
  open: 'text-green-400', 'in-progress': 'text-yellow-400', resolved: 'text-gray-500',
};
