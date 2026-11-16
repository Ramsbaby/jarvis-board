import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import type { CompanyTask, CompanyIssue, CompanyReport, CompanySnapshot } from './types';
const revision = (t: CompanyTask) => {
  const fields:unknown[]=[t.id,t.state,t.id.startsWith('workflow:')?null:t.eventAt,t.summary,t.next,t.issue,t.result,t.execution?.reportEventId,t.result?'result-context-v2':null];
  const recoveries=t.execution?.events.filter(e=>e.recoveryEventId).map(e=>[e.id,e.recoveryEventId]);
  if(recoveries?.length)fields.push(recoveries);
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
};
/** Local inbox receipts. Reception means imported here, never an AI review or upstream delivery. */
export function reconcileCompany(path: string, current: CompanyTask[], now: string): Pick<CompanySnapshot, 'tasks' | 'issues' | 'reports' | 'receiptAvailable'> {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path); db.pragma('busy_timeout = 3000'); db.pragma('journal_mode = WAL');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS office_tasks(id TEXT PRIMARY KEY, data TEXT NOT NULL, last_seen TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS office_reports(id TEXT PRIMARY KEY, data TEXT NOT NULL, received_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS office_issues(id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
    db.transaction(() => {
      for (const t of current) {
        const previous = db.prepare('SELECT data FROM office_tasks WHERE id=?').get(t.id) as { data: string } | undefined;
        const old = previous ? JSON.parse(previous.data) as CompanyTask : null;
        // An unchanged current report should not create another receipt every poll.
        if (!old || revision(old) !== revision(t) || !db.prepare('SELECT 1 FROM office_reports WHERE id=?').get(revision(t))) {
          const report: CompanyReport = { id: revision(t), taskId: t.id, ownerId: t.ownerId, title: t.title,
            summary: t.summary, eventAt: t.eventAt, receivedAt: now, state: t.state, receipt: 'received', review: 'not_reviewed', context: { result: t.result, next: t.next, evidence: t.evidence, issue: t.issue ?? null, body: t.execution?.reportText || t.summary, executionStatus: t.execution?.status ?? null, events: t.execution?.events, eventIds: t.execution?.events.map(e => e.id) ?? [] } };
          db.prepare('INSERT OR IGNORE INTO office_reports VALUES(?,?,?)').run(report.id, JSON.stringify(report), now);
        }
        db.prepare("UPDATE office_reports SET data=json_set(data, '$.ownerId', ?) WHERE json_extract(data, '$.taskId')=? AND json_extract(data, '$.ownerId')<>?").run(t.ownerId, t.id, t.ownerId);
        const id = `issue:${t.id}`;
        const existing = db.prepare('SELECT data FROM office_issues WHERE id=?').get(id) as { data: string } | undefined;
        const issue = existing ? JSON.parse(existing.data) as CompanyIssue : null;
        if (t.issue && !(issue?.state === 'recovered' && issue.recoveryEventAt && t.eventAt && Date.parse(t.eventAt) <= Date.parse(issue.recoveryEventAt))) {
          const item: CompanyIssue = { id, taskId: t.id, title: t.issue, ownerId: t.ownerId, state: 'open',
            impact: '실제 영향은 확인되지 않았습니다. 해당 업무의 다음 진행을 확인해야 합니다.', next: t.next,
            eventAt: issue?.eventAt && t.eventAt && Date.parse(issue.eventAt) > Date.parse(t.eventAt) ? issue.eventAt : t.eventAt,
            firstSeenAt: issue?.state === 'open' ? issue.firstSeenAt : now, lastSeenAt: now, recoveredAt: null };
          db.prepare('INSERT OR REPLACE INTO office_issues VALUES(?,?)').run(id, JSON.stringify(item));
        } else if (issue?.state === 'open' && t.kind === 'overview' && current.some(child => child.parentId === t.id && child.issue)) {
          db.prepare('UPDATE office_issues SET data=? WHERE id=?').run(JSON.stringify({ ...issue, state: 'grouped', next: '개별 실행 문제에 연결하여 표시 · 해결 판정이 아님', lastSeenAt: now }), id);
        } else if (issue?.state === 'open' && t.result && t.state !== 'unknown' && t.eventAt && (issue.eventAt || old?.eventAt) && Date.parse(t.eventAt) > Date.parse(issue.eventAt || old!.eventAt!)) {
          // Only newer positive evidence for THIS task can mark execution recovery.
          db.prepare('UPDATE office_issues SET data=? WHERE id=?').run(JSON.stringify({ ...issue, state: 'recovered', recoveryEventAt: t.eventAt, recoveredAt: now, lastSeenAt: now }), id);
        }
        db.prepare('INSERT OR REPLACE INTO office_tasks VALUES(?,?,?)').run(t.id, JSON.stringify(t), now);
      }
    })();
    const ids = new Set(current.map(t => t.id));
    const tasks = (db.prepare('SELECT data FROM office_tasks').all() as { data: string }[]).map(row => {
      const t = JSON.parse(row.data) as CompanyTask;
      return ids.has(t.id) ? t : { ...t, state: 'unknown' as const, evidence: `${t.evidence} 이번 조회에서 관측되지 않아 이전 기록을 보존합니다.` };
    });
    const issues = (db.prepare('SELECT data FROM office_issues').all() as { data: string }[]).map(r => JSON.parse(r.data) as CompanyIssue);
    const reports = (db.prepare("SELECT data FROM office_reports WHERE rowid IN (SELECT MAX(rowid) FROM office_reports GROUP BY json_extract(data, '$.taskId')) OR rowid IN (SELECT rowid FROM office_reports ORDER BY received_at DESC, rowid DESC LIMIT 200) ORDER BY COALESCE(json_extract(data, '$.eventAt'), received_at) DESC, received_at DESC, rowid DESC").all() as { data: string }[]).map(r => JSON.parse(r.data) as CompanyReport);
    return { tasks, issues, reports, receiptAvailable: true };
  } finally { db.close(); }
}
