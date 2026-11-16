import {internalHeartbeat} from './motion';
import type { CompanyReport, CompanyReview } from './types';
/** This is routing, never a claim that a report is correct or its task is done. */
export function needsDeepReview(r: CompanyReport): boolean {
  if(internalHeartbeat(r))return false;
  const c=r.context;
  // Structured collectors already supply the issue and responsible party's next action.
  const structured=/^(qa|workflow|automation):/.test(r.taskId)&&!!c?.next&&c.body===r.summary&&!c.events?.length;
  if(structured&&r.state!=='decision')return false;
  return r.state==='decision'||r.state==='blocked'||!!c?.issue||['failed','interrupted'].includes(c?.executionStatus||'')||!!c?.events?.some(e=>e.failed&&!e.recoveryEventId);
}
export function sourceBrief(r: CompanyReport): CompanyReview {
  return {reportId:r.id,status:'source_ready',reviewedAt:null,model:'',summary:r.summary,problems:r.context?.issue?[r.context.issue]:r.state==='blocked'?[r.summary]:[],nextActions:[r.context?.next||'담당자의 다음 조치 기록 확인'],ownerDecision:r.state==='decision'?'원본에 사장 결정 대기로 기록됨 · 요청 근거 확인':'원본에 사장 결정 대기 상태가 없습니다.',evidenceIds:[r.id],limitations:['원문 필드 정리입니다. AI 심층검토·사실 검증·문제 해결을 뜻하지 않습니다.']};
}
/** Same task/turn AND identical full evidence only. Never reuse across executions. */
export function reviewKey(r:CompanyReport):string {
 const c=r.context;return JSON.stringify([r.taskId,r.taskId.startsWith('workflow:')?null:r.eventAt,r.ownerId,r.title,r.state,r.summary,c?.body,c?.issue,c?.next,c?.evidence,c?.result,c?.executionStatus,c?.eventIds,c?.events]);
}
export const REVIEW_LABEL:Record<CompanyReview['status'],string>={queued:'AI 심층검토 대기',reviewing:'AI 심층검토 중',reviewed:'AI 검토 완료',failed:'AI 검토 실패 · 원문 보존',stale:'이전 기준 · 재분류 대기',source_ready:'원문 정리 · AI 미검토',linked:'동일 내용 · 연결 보고에서 검토'};
