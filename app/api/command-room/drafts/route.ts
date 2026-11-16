import { NextResponse, type NextRequest } from 'next/server';
import { join } from 'node:path';
import { getRequestAuth } from '@/lib/guest-guard';
import { sameOrderOrigin } from '@/lib/company/order-origin';
import { orderConfig } from '@/lib/company/order-runner';
import { readDraft, writeDraft, validDraftInput, DRAFT_KEY } from '@/lib/company/draft-sync';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const store = () => { const c = orderConfig(); return c ? join(c.root, 'drafts.sqlite') : null; };

export async function GET(req: NextRequest) {
  if (!getRequestAuth(req).isOwner) return NextResponse.json({ error: '소유자 로그인 필요' }, { status: 401, headers });
  const file = store(); if (!file) return NextResponse.json({ error: '초안 저장소 미설정' }, { status: 503, headers });
  const key = req.nextUrl.searchParams.get('key') || '';
  if (!DRAFT_KEY.test(key)) return NextResponse.json({ error: '초안 이름 확인 필요' }, { status: 400, headers });
  const mine = Number(req.nextUrl.searchParams.get('mine') || 0);
  try { return NextResponse.json({ draft: readDraft(file, key, Number.isSafeInteger(mine) && mine > 0 ? mine : undefined) }, { headers }); }
  catch { return NextResponse.json({ error: '초안 조회 실패' }, { status: 500, headers }); }
}
export async function PUT(req: NextRequest) {
  if (!getRequestAuth(req).isOwner) return NextResponse.json({ error: '소유자 로그인 필요' }, { status: 401, headers });
  if (!sameOrderOrigin(req.headers.get('origin'), req.headers.get('host'), req.nextUrl.protocol)) return NextResponse.json({ error: '동일 출처 요청 필요' }, { status: 403, headers });
  const file = store(); if (!file) return NextResponse.json({ error: '초안 저장소 미설정' }, { status: 503, headers });
  const body = await req.json().catch(() => null) as { key?: unknown; value?: unknown; updatedAt?: unknown } | null;
  const invalid = body ? validDraftInput(body.key, body.value, body.updatedAt) : '입력 확인 필요';
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400, headers });
  try { return NextResponse.json({ draft: writeDraft(file, body!.key as string, body!.value, body!.updatedAt as number) }, { headers }); }
  catch { return NextResponse.json({ error: '초안 저장 실패' }, { status: 500, headers }); }
}
