// 보고서 content를 파싱해 상단에 표시할 통계 카드.
// server component — 파싱 로직이 순수하므로 클라이언트 JS 불필요.

interface Stat {
  icon: string;
  label: string;
  value: string;
  tone: 'emerald' | 'amber' | 'indigo' | 'rose' | 'zinc';
}

function parseStats(content: string): Stat[] {
  const stats: Stat[] = [];

  const m1 = content.match(/## ✅ 완료 작업 \((\d+)건\)/);
  if (m1) stats.push({ icon: '✅', label: '완료 작업', value: `${m1[1]}건`, tone: 'emerald' });

  const m2 = content.match(/이슈 (\d+)건 · 실패 (\d+)건/);
  if (m2) {
    const issues = parseInt(m2[1], 10);
    const fails = parseInt(m2[2], 10);
    stats.push({
      icon: '⚠️',
      label: '이슈/실패',
      value: `${issues + fails}건`,
      tone: issues + fails === 0 ? 'zinc' : 'rose',
    });
  }

  const m3 = content.match(/## 🔄 진행 중 \((\d+)건\)/);
  if (m3) stats.push({ icon: '🔄', label: '진행 중', value: `${m3[1]}건`, tone: 'indigo' });

  const m4 = content.match(/성공 (\d+)건.*?실패 (\d+)건/);
  if (m4) {
    const ok = parseInt(m4[1], 10);
    const fail = parseInt(m4[2], 10);
    const total = ok + fail;
    const rate = total > 0 ? Math.round((ok / total) * 1000) / 10 : 100;
    stats.push({
      icon: '⚙️',
      label: '크론 성공률',
      value: `${rate}%`,
      tone: rate >= 95 ? 'emerald' : rate >= 85 ? 'amber' : 'rose',
    });
  }

  const mCommit = content.match(/GitHub 커밋[:\s—]+(\d+)건/);
  if (mCommit) stats.push({ icon: '🐙', label: 'GitHub 커밋', value: `${mCommit[1]}건`, tone: 'zinc' });

  // 이번 달 누적 우선, 없으면 오늘
  const mMonth = content.match(/이번 ?달[^$]*\$([\d.]+)/);
  const mToday = content.match(/오늘[^$]*\$([\d.]+)/);
  const costVal = mMonth?.[1] ?? mToday?.[1];
  if (costVal) {
    stats.push({
      icon: '💸',
      label: mMonth ? 'LLM 비용(월)' : 'LLM 비용(일)',
      value: `$${parseFloat(costVal).toFixed(2)}`,
      tone: parseFloat(costVal) > 10 ? 'amber' : 'zinc',
    });
  }

  return stats;
}

const TONE_CLASS: Record<Stat['tone'], string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  zinc: 'bg-zinc-50 text-zinc-700 border-zinc-200',
};

export default function ReportStatsCard({ content }: { content: string }) {
  const stats = parseStats(content);
  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
      {stats.map(stat => (
        <div
          key={stat.label}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${TONE_CLASS[stat.tone]}`}
        >
          <span className="text-lg leading-none">{stat.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium opacity-70 leading-tight">{stat.label}</p>
            <p className="text-sm font-bold leading-tight mt-0.5">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
