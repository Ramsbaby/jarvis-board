import type { CompanyReport } from './types';
const MOTION_WINDOW = 120000;
const recent = (at:string|null,now:number) => {const age=now-Date.parse(at||'');return age>=0&&age<MOTION_WINDOW;};

/** Inspect source text only; an internal heartbeat is still retained in the ledger. */
export function internalHeartbeat(report:CompanyReport):boolean {
  const source=[report.title,report.summary,report.context?.body,report.context?.result].filter(Boolean).join('\n');
  return (source.match(/<heartbeat\b[^>]*(?:\/>|>[\s\S]*?<\/heartbeat\s*>)/gi)||[])
    .some(xml=>/\bdecision\s*=\s*["']?DONT_NOTIFY\b|<decision\b[^>]*>\s*DONT_NOTIFY\s*<\/decision\s*>/i.test(xml));
}
export function automaticReportIsRecent(report:CompanyReport,now:number):boolean {
  return !internalHeartbeat(report)&&recent(report.receivedAt,now)&&recent(report.eventAt??report.receivedAt,now);
}
/** Walking represents an actionable report, not a poll or an unverified start signal. */
export function reportMotionReason(report: CompanyReport): string | null {
  if(internalHeartbeat(report))return null;
  if(report.state==='decision')return '사장 결정 요청 접수';
  if(report.state==='blocked')return '문제 기록 접수';
  if(report.state==='completed')return '결과 보고 접수';
  if(report.context?.executionStatus&&['completed','failed','interrupted'].includes(report.context.executionStatus)&&report.context.body)return '실행 회차 결과 접수';
  return null;
}
export function reportMotionKey(report: CompanyReport): string {
  return JSON.stringify([report.taskId,report.state,report.summary,report.context?.result,report.context?.issue,report.context?.executionStatus]);
}

export function collectReportMotions(reports:CompanyReport[],seen:Set<string>,latestByTask:Map<string,string>,now:number):CompanyReport[] {
  const events=new Map<string,CompanyReport>();
  for(const report of [...reports].reverse())if(!seen.has(report.id)) {
    seen.add(report.id);const key=reportMotionKey(report);
    if(reportMotionReason(report)&&latestByTask.get(report.taskId)!==key&&automaticReportIsRecent(report,now)) {
      const previous=events.get(report.ownerId);
      if(!previous||reportEventTime(report)>=reportEventTime(previous))events.set(report.ownerId,report);
    }
    latestByTask.set(report.taskId,key);
  }
  return [...events.values()];
}

const reportEventTime=(r:CompanyReport)=>Date.parse(r.eventAt??r.receivedAt);
export interface ReportMotionEntry {report:CompanyReport;replay:boolean}
/** One pending automatic walk per employee. Explicit replays remain independent. */
export function enqueueReportMotion(queue:ReportMotionEntry[],entry:ReportMotionEntry,active?:ReportMotionEntry|null):void {
  if(entry.replay){queue.unshift(entry);return;}
  if(active&&!active.replay&&active.report.ownerId===entry.report.ownerId&&reportMotionKey(active.report)===reportMotionKey(entry.report))return;
  const index=queue.findIndex(q=>!q.replay&&q.report.ownerId===entry.report.ownerId);
  if(index<0)queue.push(entry);
  else if(reportEventTime(entry.report)>=reportEventTime(queue[index].report))queue[index]=entry;
}

/** Historical audit batches belong in the inbox, not a parade of old employee walks. */
export function reviewDeliveryIsRecent(r:CompanyReport,now=Date.now()){const age=now-Date.parse(r.assessment?.reviewedAt||r.receivedAt),receiptAge=now-Date.parse(r.receivedAt);return !internalHeartbeat(r)&&recent(r.eventAt??r.receivedAt,now)&&age>=0&&age<120000&&(r.assessment?.method!=='codex_audit'||receiptAge>=0&&receiptAge<120000);}

/** Staff and secretary consume the same newest representative per employee. */
export function retainLatestReview(pending:Map<string,CompanyReport>,report:CompanyReport){const old=pending.get(report.ownerId);if(!old||reportEventTime(report)>=reportEventTime(old))pending.set(report.ownerId,report);}

export function takeHandoffReview(entry:ReportMotionEntry,pending:Map<string,CompanyReport>,ready:boolean){if(entry.replay)return ready?entry.report:undefined;const report=pending.get(entry.report.ownerId);if(report)pending.delete(entry.report.ownerId);return report;}
