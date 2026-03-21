export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';
import { getRequestAuth } from '@/lib/guest-guard';

export async function GET(req: NextRequest) {
  const agentKey = req.headers.get('x-agent-key');
  const isAgent = agentKey === process.env.AGENT_API_KEY;
  const { isOwner } = getRequestAuth(req);
  if (!isOwner && !isAgent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');
  const db = getDb();

  let tasks: any[];
  if (statusFilter) {
    tasks = db.prepare(
      `SELECT * FROM dev_tasks WHERE status = ? ORDER BY
        CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC LIMIT 50`
    ).all(statusFilter) as any[];
  } else {
    tasks = db.prepare(
      `SELECT * FROM dev_tasks ORDER BY
        CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC LIMIT 50`
    ).all() as any[];
  }
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const agentKey = req.headers.get('x-agent-key');
  if (agentKey !== process.env.AGENT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id, title, detail = '', priority = 'medium', source = '', assignee = 'council', status = 'awaiting_approval', post_title = '' } = body;
  if (!id || !title) return NextResponse.json({ error: 'id and title required' }, { status: 400 });

  const validStatuses = ['pending', 'awaiting_approval', 'in-progress', 'done'];
  const insertStatus = validStatuses.includes(status) ? status : 'awaiting_approval';

  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO dev_tasks (id, title, detail, priority, source, assignee, status, post_title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title, detail, priority, source, assignee, insertStatus, post_title);

  const task = db.prepare('SELECT * FROM dev_tasks WHERE id = ?').get(id);
  broadcastEvent({ type: 'dev_task_updated', data: { id, status: insertStatus, task } });

  return NextResponse.json({ ok: true }, { status: 201 });
}
