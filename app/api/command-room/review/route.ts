import { after, NextResponse, type NextRequest } from 'next/server';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getRequestAuth } from '@/lib/guest-guard';
import { requestReview, processReviewQueue } from '@/lib/company/reviews';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!getRequestAuth(request).isOwner) return NextResponse.json({ error: '소유자 로그인 필요' }, { status: 401 });
  const origin = request.headers.get('origin');
  let sameOrigin = false;
  try { const parsed = new URL(origin || ''); sameOrigin = ['http:', 'https:'].includes(parsed.protocol) && parsed.host === request.headers.get('host'); } catch {}
  if (!sameOrigin) return NextResponse.json({ error: '동일 출처 요청 필요' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.reportId !== 'string' || !/^[a-f0-9]{64}$/.test(body.reportId)) return NextResponse.json({ error: '보고 ID 확인 필요' }, { status: 400 });
  const path = process.env.JARVIS_OFFICE_JOURNAL || join(homedir(), '.openclaw-data/runtime/office/inbox.sqlite');
  if (!requestReview(path, body.reportId)) return NextResponse.json({ error: '보고 없음' }, { status: 404 });
  after(() => processReviewQueue(path));
  return NextResponse.json({ queued: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
