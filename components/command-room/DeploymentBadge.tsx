import type {OwnerOrder} from '@/lib/company/orders';
import {deploymentStatus} from '@/lib/company/deployment';
export default function DeploymentBadge({order,compact=false}:{order:OwnerOrder;compact?:boolean}){
 const status=order.deployment||deploymentStatus(order,null,'',[]);
 const steps=[{label:'수정',done:order.execution?.applied===true},{label:'검토',done:order.review?.verdict==='accepted'},{label:'외부 반영',done:status.state==='verified'}];
 return <section className="company-deployment" data-deployment-state={status.state} aria-label="업무 외부 반영 상태"><ol aria-label="업무 진행 단계">{steps.map(step=><li key={step.label} data-done={step.done}><span aria-hidden="true">{step.done?'✓':'○'}</span> {step.label}</li>)}</ol><strong>{status.label}</strong>{!compact&&<details><summary>확인 근거</summary><p>{status.detail}</p>{status.verifiedAt&&<small>확인 시각 <time dateTime={status.verifiedAt}>{new Date(status.verifiedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time></small>}</details>}{status.state==='verified'&&status.url&&<a href={status.url} target="_blank" rel="noopener noreferrer">외부 화면 열기 ↗</a>}</section>;
}
