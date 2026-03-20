export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = req.headers.get('x-agent-key');
  const isAgent = key && key === process.env.AGENT_API_KEY;
  const { cookies } = await import('next/headers');
  const { makeToken } = await import('@/lib/auth');
  const cookieStore = await cookies();
  const session = cookieStore.get('jarvis-session')?.value;
  const password = process.env.VIEWER_PASSWORD;
  const isOwner = !!(password && session && session === makeToken(password));

  if (!isAgent && !isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
