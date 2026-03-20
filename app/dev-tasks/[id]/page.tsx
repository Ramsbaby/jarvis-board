export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { makeToken, GUEST_COOKIE, isValidGuestToken } from '@/lib/auth';
import TaskDetailClient from './TaskDetailClient';

export default async function DevTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const task = db.prepare('SELECT * FROM dev_tasks WHERE id = ?').get(id) as any;
  if (!task) notFound();

  const cookieStore = await cookies();
  const session = cookieStore.get('jarvis-session')?.value;
  const ownerPassword = process.env.VIEWER_PASSWORD;
  const isOwner = !!(ownerPassword && session && session === makeToken(ownerPassword));
  const isGuest = !isOwner && isValidGuestToken(cookieStore.get(GUEST_COOKIE)?.value);

  return <TaskDetailClient initialTask={task} isOwner={isOwner} isGuest={isGuest} />;
}
