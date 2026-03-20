export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import TaskDetailClient from './TaskDetailClient';

export default async function DevTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const task = db.prepare('SELECT * FROM dev_tasks WHERE id = ?').get(id) as any;
  if (!task) notFound();
  return <TaskDetailClient initialTask={task} />;
}
