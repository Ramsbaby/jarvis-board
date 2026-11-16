import { homedir } from 'node:os';
import { join } from 'node:path';
import { processReviewQueue } from '@/lib/company/reviews';
import { after, NextResponse, type NextRequest } from 'next/server';
import { getRequestAuth } from '@/lib/guest-guard';
import { buildCommandRoom, loadForOwner } from '@/lib/command-room/server';
import { loadCompany } from '@/lib/company/server';
import { companyEmployees } from '@/lib/company/employees';
import { listAutomationsSnapshot } from '@/lib/openclaw-automations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const snapshot = await loadForOwner(getRequestAuth(request).isOwner, async () => {
    const source = await listAutomationsSnapshot();
    const base = await buildCommandRoom(async () => source);
    const company = await loadCompany(base, source);
    return { ...base, company, employees: companyEmployees(base.employees ?? [], company) };
  });
  if (snapshot) after(() => processReviewQueue(process.env.JARVIS_OFFICE_JOURNAL || join(homedir(), '.openclaw-data/runtime/office/inbox.sqlite')));
  return NextResponse.json(snapshot ?? { error: '소유자 로그인 필요' }, {
    status: snapshot ? 200 : 401,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' },
  });
}
