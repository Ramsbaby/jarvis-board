import {readableText} from './display';
import {PROJECTS} from './projects';
import type { OwnerOrder } from './orders';
import type { OfficeEmployee } from '../command-room/employees';
import type { CompanyReport, CompanyTask, CompanyIssue, WorkState } from './types';
export const OWNER_ORDER_EMPLOYEE = 'owner-order-worker';
export const ORDER_LABELS = {received:'지시 접수',assigned:'담당 배정',running:'담당자 작업 중',reviewing:'실행 결과 검토 중',reported:'결과 보고 도착',failed:'실행 확인 필요',building:'수정본 빌드 검증',cancelled:'실행 중단'};
export function orderActivity(order:OwnerOrder):string {
 if(order.stage==='reviewing'&&order.execution?.progress)return order.execution.progress;
 if(order.stage==='building')return '수정본을 빌드하여 실행 가능성 검사';
 if(order.kind==='development'&&order.stage==='reviewing')return '지시·실제 코드 변경을 별도 검토하고 회귀 검사';
 if(order.kind==='development'&&order.stage==='running')return '개발 지시에 맞춰 실제 코드 수정';
 if(order.stage==='reviewing')return order.execution?'색상·동작·그림자·타입 검사':'직원 보고와 원본 근거 대조';
 if(order.stage==='running')return order.kind==='qa-source-readonly'?'QA 원장 근거 조사':'캐릭터 렌더링 코드 수정';
 return ORDER_LABELS[order.stage];
}
export function orderNextAction(order:OwnerOrder):string {
 if(order.deployment?.state==='verified')return '외부 반영된 사이트를 확인하고 필요한 다음 수정을 지시하세요';
 if(order.deployment&&['pending','awaiting','failed','previous'].includes(order.deployment.state)&&order.stage==='reported')return order.deployment.label+' · 배포 근거를 확인하세요';
 const action=order.review?.actions.find((text,i)=>!(order.execution?.checks?.length&&order.review?.actionKinds?.[i]==='verification'&&/오케스트레이터|타입 검사|프로덕션 빌드/.test(text)));
 if(action)return action;
 if(order.stage==='reported')return '결과를 확인하고 필요한 추가 수정을 지시하세요';
 if(order.stage==='failed'&&/다른 작업이 원본을 변경/.test(order.error||''))return '보존된 수정안을 현재 소스 기준으로 다시 검토하고 적용해야 합니다';
 if(order.stage==='failed')return '실패 근거를 확인하고 수정할 내용과 완료 조건을 지시하세요';
 if(order.stage==='cancelled')return '중단된 내용을 확인하고 다시 맡길 범위를 정하세요';
 return '진행 상황을 확인하세요 · 후속 지시는 현재 실행이 끝난 뒤 배정됩니다';
}
export function orderIsWorking(order:OwnerOrder,connected=true,now=Date.now()):boolean {
 return connected&&['running','reviewing','building'].includes(order.stage)&&order.leaseUntil>now;
}
export function orderState(order:OwnerOrder):WorkState {
 if(order.stage==='failed')return 'blocked';
 if(order.stage==='reported')return 'completed';
 if(order.stage==='cancelled')return 'waiting';
 return ['running','reviewing','building'].includes(order.stage)?'running':'waiting';
}
/** One real execution lane shared by the headquarters and instruction scene. */
export function ownerOrdersProjection(orders:OwnerOrder[],connected=true,now=Date.now()) {
 const latest=orders[0];
 const employees:OfficeEmployee[]=latest?[{id:OWNER_ORDER_EMPLOYEE,name:latest.assignee,department:PROJECTS[latest.projectId||'jarvis-board'].name,role:latest.kind==='qa-source-readonly'?'근거 조사':'수정·실행 검증',mode:!connected?'unknown':orderIsWorking(latest,connected,now)?'working':latest.stage==='failed'?'attention':'waiting',status:connected?ORDER_LABELS[latest.stage]:'실행 연결 확인 필요',task:PROJECTS[latest.projectId||'jarvis-board'].name+' · '+latest.goal,next:orderNextAction(latest),observedAt:latest.updatedAt,hasActiveWork:orderIsWorking(latest,connected,now),activity:orderActivity(latest),evidence:'사장 지시 원장의 담당 프로세스와 검사 결과'}]:[];
 const tasks:CompanyTask[]=orders.map(o=>({id:'order:'+o.id,title:PROJECTS[o.projectId||'jarvis-board'].name+' · '+o.goal,kind:'work',ownerId:OWNER_ORDER_EMPLOYEE,state:connected?orderState(o):'unknown',summary:o.error||o.review?.summary||orderActivity(o),next:orderNextAction(o),source:'사장 지시 실행 원장',observedAt:o.updatedAt,eventAt:o.updatedAt,evidence:o.execution?.checks?.join(' · ')||o.events.at(-1)?.message||'지시 접수',priority:o.stage==='failed'?100:orderIsWorking(o,connected,now)?90:50,href:'/?order='+encodeURIComponent(o.id),...(o.review?{result:o.review.summary}:{}),...(o.error?{issue:o.error}:{})}));
 // A request for verification is not a completed employee report. Only terminal evidence moves a report.
 const reports:CompanyReport[]=orders.filter(o=>o.stage==='reported'||o.stage==='failed').map(o=>({id:'owner-report:'+o.id,taskId:'order:'+o.id,ownerId:OWNER_ORDER_EMPLOYEE,title:PROJECTS[o.projectId||'jarvis-board'].name+' · '+o.goal,summary:o.error||o.review?.summary||'실행 결과 확인 필요',eventAt:o.updatedAt,receivedAt:o.updatedAt,state:o.stage==='reported'?'completed':'blocked',receipt:'received',review:o.review?'reviewed':'not_reviewed',context:{next:orderNextAction(o),evidence:o.execution?.checks?.join(' · ')||o.worker?.evidence.join(' · ')||'실행 원장',issue:o.error||null,body:o.error||o.review?.summary||'실행 결과 확인 필요',executionStatus:o.stage==='reported'?'completed':'failed',eventIds:[]},...(o.review?{assessment:{reportId:'owner-report:'+o.id,status:'reviewed' as const,reviewedAt:o.updatedAt,model:o.kind==='development'?'별도 Codex 코드 검토 + 실행 검사':o.execution?'독립 실행 검사':'별도 Codex 검토',summary:o.error?'실행 미완료: '+o.error+' 코드 검토: '+o.review.summary:o.review.summary,problems:o.error?[o.error]:o.review.verdict==='needs_followup'?o.review.findings:[],nextActions:o.review.actions,ownerDecision:'이 업무의 실행 결과입니다. 별도 배포 여부는 배포 기록에서 확인하세요.',evidenceIds:[o.id],limitations:o.review.limitations}}:{})}));
 return {latest,employees,tasks,reports,issues:ownerOrderIssues(orders,connected)};
}

export function orderDisplayGoal(order:OwnerOrder):string {
 const text=order.parent?.action==='보존된 개발 수정안 검토·검사 다시 실행'?order.parent.instruction||order.instruction:order.goal;
 return readableText(text.replace(/^(?:보존된 수정안의 검토·검사를 이어가줘[.] 원래 지시: )+/,'').trim().split(/[\n.!?]/)[0].slice(0,80)||order.goal);
}

/** A retry continues one failed candidate. Unrelated later work cannot erase its failure. */
export function ownerOrderIssues(orders:OwnerOrder[],connected=true):CompanyIssue[]{
 return orders.filter(o=>o.stage==='failed'&&!orders.some(child=>child.parent?.id===o.id&&child.parent.actionIndex===-1&&child.stage!=='cancelled')).map(o=>({
  id:'order-issue:'+o.id,taskId:'order:'+o.id,title:o.error||'지시한 업무의 실행 확인 필요',ownerId:OWNER_ORDER_EMPLOYEE,state:'open',
  triage:{category:connected&&o.id===orders[0]?.id?'current':'check',reason:o.id===orders[0]?.id?'최근 지시의 실행 실패':'미해결 과거 실패 · 현재 영향은 재확인 필요',next:o.execution?.files.length?'실패 근거와 수정안을 확인하고 필요한 수정을 지시하세요':'수정 파일이 없습니다. 실패 근거를 확인하고 실제 수정 대상과 완료 조건을 지시하세요'},
  impact:!connected?'최신 연결 미확인 · 마지막 실패 기록입니다.':o.id===orders[0]?.id?'최근 지시의 실행·검증이 완료되지 않았습니다.':'과거 실행 실패 보존 · 현재 영향은 미확인입니다.',
  next:o.execution?.files.length?'실패 근거와 수정안 확인':'실패 근거 확인 후 수정할 내용 지시',eventAt:o.updatedAt,firstSeenAt:o.createdAt,lastSeenAt:o.updatedAt,recoveredAt:null
 }));
}
