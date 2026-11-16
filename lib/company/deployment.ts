import type {OwnerOrder} from './orders';
export type DeploymentStatus={state:'pending'|'awaiting'|'verified'|'failed'|'previous'|'unavailable';label:string;detail:string;url?:string;verifiedAt?:string;buildId?:string};
export type ReleaseBinding={id:string;projectId:string;updatedAt:string;afterHash:string};
export type ReleaseManifest={version:1;buildId:string;origin:string;createdAt:string;sourceHash:string;artifactHash:string;orders:ReleaseBinding[]};
export type DeploymentReceipt={version:1;buildId:string;manifestHash:string;origin:string;checkedAt:string;ok:boolean;orders:ReleaseBinding[]};
export function sameReleaseOrder(order:OwnerOrder,b:ReleaseBinding){return order.id===b.id&&(order.projectId||'jarvis-board')===b.projectId&&order.updatedAt===b.updatedAt&&!!order.execution?.afterHash&&order.execution.afterHash===b.afterHash;}
export function deploymentStatus(order:OwnerOrder,release:ReleaseManifest|null,manifestHash:string,receipts:DeploymentReceipt[]):DeploymentStatus{
 if((order.projectId||'jarvis-board')!=='jarvis-board')return {state:'unavailable',label:'외부 배포 연결 미설정',detail:'이 프로젝트의 배포 대상과 검증 기록이 아직 연결되지 않았습니다.'};
 if(order.stage!=='reported'||order.execution?.applied!==true||order.review?.verdict!=='accepted')return {state:'pending',label:'외부 반영 전',detail:'수정·검토·적용이 완료되어야 배포에 연결할 수 있습니다.'};
 const included=release?.orders.some(b=>sameReleaseOrder(order,b));
 const matching=receipts.filter(r=>r.orders.some(b=>sameReleaseOrder(order,b))).sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt));
 if(included&&release){
  const receipt=matching.find(r=>r.buildId===release.buildId&&r.manifestHash===manifestHash&&r.origin===release.origin);
  if(receipt?.ok)return {state:'verified',label:'외부 반영 확인',detail:'이 업무를 포함한 배포본이 외부 주소에서 응답하는 것을 확인했습니다.',url:release.origin+'/',verifiedAt:receipt.checkedAt,buildId:release.buildId};
  if(receipt)return {state:'failed',label:'외부 확인 실패',detail:'배포본은 준비됐지만 외부 응답 검증을 통과하지 못했습니다. 배포 담당의 재확인이 필요합니다.',buildId:release.buildId};
  return {state:'awaiting',label:'배포본 포함 · 외부 확인 대기',detail:'현재 배포본에 이 업무가 포함됐습니다. 외부 응답 확인 전에는 반영 완료로 표시하지 않습니다.',buildId:release.buildId};
 }
 if(matching.some(r=>r.ok))return {state:'previous',label:'이전 배포 확인 · 현재 반영 미확인',detail:'이전 배포의 확인 기록은 있지만 현재 배포본과 연결되지 않았습니다.'};
 return {state:'pending',label:'수정 완료 · 외부 반영 대기',detail:'수정본은 적용됐지만 이 업무를 포함한 배포·외부 검증 기록은 아직 없습니다.'};
}
