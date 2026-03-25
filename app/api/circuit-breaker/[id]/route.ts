export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const JARVIS_HOME = process.env.BOT_HOME || join(homedir(), '.jarvis');

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const ownerPw = process.env.VIEWER_PASSWORD;
  const isOwner = !!(ownerPw && session && session === makeToken(ownerPw));
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id || id.includes('/') || id.includes('..')) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const filePath = join(JARVIS_HOME, 'state', 'circuit-breaker', `${id}.json`);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    unlinkSync(filePath);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
