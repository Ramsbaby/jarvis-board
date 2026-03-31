export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestAuth } from '@/lib/guest-guard';
import type { BoardSetting } from '@/lib/types';

function getMacMiniBaseUrl(): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM board_settings WHERE key = 'board_metrics_url'").get() as BoardSetting | undefined;
  if (!row?.value) return null;
  return row.value.replace(/\/api\/metrics$/, '');
}

export async function GET(req: NextRequest) {
  const { isOwner } = getRequestAuth(req);
  const agentKey = req.headers.get('x-agent-key');
  const isAgent = agentKey === process.env.AGENT_API_KEY;
  if (!isOwner && !isAgent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const hours = url.searchParams.get('hours') || '24';
  const maxPoints = url.searchParams.get('maxPoints') || '60';

  const baseUrl = getMacMiniBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ ok: false, metrics: [], count: 0, total: 0, message: 'Mac Mini URL not configured' });
  }

  try {
    const agentApiKey = process.env.AGENT_API_KEY ?? '';
    const res = await fetch(`${baseUrl}/api/system/metrics/history?hours=${hours}&maxPoints=${maxPoints}`, {
      headers: { 'x-agent-key': agentApiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, metrics: [], count: 0, total: 0, message: `Upstream ${res.status}` });
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: false, metrics: [], count: 0, total: 0, message: 'Mac Mini offline' });
  }
}
