import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { makeToken, buildLoginRedirect } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ReportGenerateButton from '@/components/ReportGenerateButton';

export const dynamic = 'force-dynamic';

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function getSubtype(tags: string[]): 'daily' | 'weekly' | 'monthly' | 'unknown' {
  if (tags.includes('daily')) return 'daily';
  if (tags.includes('weekly')) return 'weekly';
  if (tags.includes('monthly')) return 'monthly';
  return 'unknown';
}

const SUBTYPE_LABEL = { daily: '일일', weekly: '주간', monthly: '월간', unknown: '기타' };
const SUBTYPE_COLOR = {
  daily: 'bg-indigo-100 text-indigo-700',
  weekly: 'bg-emerald-100 text-emerald-700',
  monthly: 'bg-amber-100 text-amber-700',
  unknown: 'bg-zinc-100 text-zinc-600',
};

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = ['all','daily','weekly','monthly'].includes(sp.filter||'')?sp.filter!:'all';

  const db = getDb();
  const cookieStore = await cookies();
  const session = cookieStore.get('jarvis-session')?.value;
  const ownerPassword = process.env.VIEWER_PASSWORD;
  const isOwner = !!(ownerPassword && session && session === makeToken(ownerPassword));

  if (!isOwner) {
    redirect(buildLoginRedirect('/reports'));
  }

  // Fetch all report posts ordered by newest first
  const reports = db.prepare(`
    SELECT id, title, tags, created_at, content
    FROM posts
    WHERE type = 'report'
    ORDER BY created_at DESC
    LIMIT 100
  `).all() as Array<{ id: string; title: string; tags: string; created_at: string; content: string }>;

  const enriched = reports.map(r => ({
    ...r,
    tags: parseTags(r.tags),
    subtype: getSubtype(parseTags(r.tags)),
  }));

  const filtered = filter === 'all' ? enriched : enriched.filter(r => r.subtype === filter);

  const pageCount=Math.max(1,Math.ceil(filtered.length/15));
  const page=Math.min(pageCount,Math.max(1,Number.parseInt(sp.page||'1',10)||1));
  const visible=filtered.slice((page-1)*15,page*15);
  const pageHref=(n:number)=>`/reports?filter=${filter}&page=${n}`;
  const tabs = [
    { key: 'all', label: '전체', count: enriched.length },
    { key: 'daily', label: '일일', count: enriched.filter(r => r.subtype === 'daily').length },
    { key: 'weekly', label: '주간', count: enriched.filter(r => r.subtype === 'weekly').length },
    { key: 'monthly', label: '월간', count: enriched.filter(r => r.subtype === 'monthly').length },
  ];

  return (
    <div className="bg-zinc-50 min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-50 bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-700 text-sm transition-colors">← 게임 본사</Link>
          <span className="text-zinc-300">|</span>
          <h1 className="text-sm font-semibold text-zinc-900">기간별 보고 기록</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <section className="rounded-xl border border-zinc-200 p-4 mb-4" aria-label="보고 기록 안내">
          <p className="text-sm leading-relaxed text-zinc-500">저장 당시의 기간별 기록입니다. 여기의 ‘0건’은 현재 문제가 없다는 뜻이 아닙니다.</p>
          <p className="text-sm mt-3">가장 최근 저장: {enriched[0]?.created_at.slice(0,10)||'기록 없음'} · 최근 {enriched.length}건 범위</p>
          <div className="flex flex-wrap gap-4 mt-4"><Link className="text-sm underline" href="/">지금 업무·문제 보기 →</Link><Link className="text-sm underline" href="/office-lab">자비스 실행 보고·다음 지시 →</Link></div>
        </section>
        <details className="mb-5 rounded-lg border border-zinc-200 p-3"><summary className="cursor-pointer text-sm">기간별 집계 새로 만들기</summary><p className="text-sm text-zinc-500 my-3">기존 집계 데이터로 보고 기록을 저장합니다. 담당자에게 작업을 배정하는 기능은 아닙니다.</p><ReportGenerateButton /></details>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-none pb-0.5">
          {tabs.map(tab => (
            <Link
              key={tab.key}
              aria-current={filter===tab.key?'page':undefined}
              href={tab.key === 'all' ? '/reports' : `/reports?filter=${tab.key}`}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
              }`}
            >
              {tab.label}
              <span className={`text-[11px] ${filter === tab.key ? 'text-zinc-400' : 'text-zinc-400'}`}>
                {tab.count}
              </span>
            </Link>
          ))}
        </div>

        {/* Report list */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">아직 보고서가 없습니다</p>
            {isOwner && (
              <p className="text-xs mt-1 text-zinc-300">선택한 기간 분류에 저장된 보고가 없습니다.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(report => {
              const subLabel = SUBTYPE_LABEL[report.subtype as keyof typeof SUBTYPE_LABEL];
              const subColor = SUBTYPE_COLOR[report.subtype as keyof typeof SUBTYPE_COLOR];
              const dateStr = new Date(report.created_at + 'Z').toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
              });

              return (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="block bg-white border border-zinc-200 rounded-xl p-4 hover:border-zinc-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${subColor}`}>
                          {subLabel}
                        </span>
                        <span className="text-xs text-zinc-400">{dateStr}</span>
                      </div>
                      <h2 className="text-base font-semibold text-zinc-900 break-words">{report.title}</h2>
                      {report.content && (
                        <p className="text-sm text-zinc-500 line-clamp-2 mt-2 leading-relaxed">{stripMarkdown(report.content).slice(0, 120)}</p>
                      )}
                    </div>
                    <span className="text-zinc-300 text-sm shrink-0">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {pageCount>1&&<nav aria-label="보고 기록 페이지" className="flex items-center justify-between gap-3 mt-6 text-sm">{page>1?<Link href={pageHref(page-1)} className="border rounded-lg px-4 py-3">← 이전</Link>:<span/>}<span>{page} / {pageCount} 페이지</span>{page<pageCount?<Link href={pageHref(page+1)} className="border rounded-lg px-4 py-3">다음 →</Link>:<span/>}</nav>}
      </div>
    </div>
  );
}
