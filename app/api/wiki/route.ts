/**
 * /api/wiki — 위키 검색 + 통계
 *
 * GET /api/wiki?q=검색어&domain=ops&type=incident&limit=10
 * GET /api/wiki (q 없으면 전체 통계 + 도메인별 페이지 목록)
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchWiki, listPages, wikiStats } from '@/lib/wiki';
import { getRequestAuth } from '@/lib/guest-guard';

export async function GET(req: NextRequest) {
  const { isAnon } = getRequestAuth(req);
  if (isAnon) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = req.nextUrl.searchParams.get('q');
  const domain = req.nextUrl.searchParams.get('domain') || undefined;
  const type = req.nextUrl.searchParams.get('type') || undefined;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10', 10);

  if (q) {
    const results = searchWiki(q, { domain, type, limit });
    return NextResponse.json({ results, total: results.length, query: q });
  }

  // No query → return stats + all pages
  const stats = wikiStats();
  const pages = listPages(domain);
  return NextResponse.json({ stats, pages });
}
