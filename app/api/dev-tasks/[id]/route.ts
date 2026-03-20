export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const task = db.prepare('SELECT * FROM dev_tasks WHERE id = ?').get(id) as any;
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const agentKey = req.headers.get('x-agent-key');
  const isAgent = agentKey === process.env.AGENT_API_KEY;

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  const isOwner = !!(password && session && session === makeToken(password));

  if (!isAgent && !isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { status, result_summary, changed_files, execution_log, log_entry } = body;

  // Agents can set operational statuses; owner can approve/reject
  const agentAllowed = ['pending', 'in-progress', 'done'];
  const ownerAllowed = ['approved', 'rejected'];
  const allowed = isAgent ? agentAllowed : ownerAllowed;

  const db = getDb();
  const now = new Date().toISOString();

  // Agent can append a single log entry without changing status
  if (log_entry && isAgent && !status) {
    const task = db.prepare('SELECT execution_log FROM dev_tasks WHERE id = ?').get(id) as any;
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const logs: any[] = JSON.parse(task.execution_log || '[]');
    logs.push({ time: now, message: log_entry });
    db.prepare('UPDATE dev_tasks SET execution_log = ? WHERE id = ?')
      .run(JSON.stringify(logs), id);
    const updated = db.prepare('SELECT * FROM dev_tasks WHERE id = ?').get(id) as any;
    broadcastEvent({ type: 'dev_task_updated', data: { id, status: updated.status, task: updated } });
    return NextResponse.json({ ok: true });
  }

  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 });
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'invalid status for this auth level' }, { status: 400 });
  }

  if (status === 'approved') {
    db.prepare('UPDATE dev_tasks SET status = ?, approved_at = ? WHERE id = ?').run(status, now, id);
  } else if (status === 'rejected') {
    db.prepare('UPDATE dev_tasks SET status = ?, rejected_at = ? WHERE id = ?').run(status, now, id);
  } else if (status === 'in-progress') {
    db.prepare('UPDATE dev_tasks SET status = ?, started_at = COALESCE(started_at, ?) WHERE id = ?').run(status, now, id);
  } else if (status === 'done') {
    const task = db.prepare('SELECT execution_log FROM dev_tasks WHERE id = ?').get(id) as any;
    const logs: any[] = JSON.parse(task?.execution_log || '[]');
    if (log_entry) logs.push({ time: now, message: log_entry });

    db.prepare(`UPDATE dev_tasks SET
      status = ?, completed_at = ?,
      result_summary = COALESCE(?, result_summary),
      changed_files = COALESCE(?, changed_files),
      execution_log = ?
      WHERE id = ?`).run(
        status, now,
        result_summary || null,
        changed_files ? JSON.stringify(changed_files) : null,
        JSON.stringify(logs),
        id,
    );
  } else {
    db.prepare('UPDATE dev_tasks SET status = ? WHERE id = ?').run(status, id);
  }

  const task = db.prepare('SELECT * FROM dev_tasks WHERE id = ?').get(id) as any;
  broadcastEvent({ type: 'dev_task_updated', data: { id, status, task } });

  return NextResponse.json({ ok: true, status });
}
