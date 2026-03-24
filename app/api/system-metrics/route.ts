export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const METRICS_KEY = 'system_metrics';

function checkAgent(req: NextRequest) {
  const key = req.headers.get('x-agent-key');
  return key === process.env.AGENT_API_KEY;
}

export async function GET() {
  const db = getDb();
  const row = db.prepare('SELECT value, updated_at FROM board_settings WHERE key = ?').get(METRICS_KEY) as
    | { value: string; updated_at: string }
    | undefined;
  if (!row) return NextResponse.json({ ok: false, data: null });
  try {
    const data = JSON.parse(row.value);
    return NextResponse.json({ ok: true, data, updated_at: row.updated_at });
  } catch {
    return NextResponse.json({ ok: false, data: null });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO board_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(METRICS_KEY, JSON.stringify(body), now);

  return NextResponse.json({ ok: true, updated_at: now });
}
