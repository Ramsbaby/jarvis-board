import type {OwnerOrder} from './orders';
export type MeetingAction={id:string;label:string;kind:'question'|'instruction';text:string;hint:string};
/** Local suggestions never dispatch work. Only explicitly typed development actions become instructions. */
export function meetingActions(order?:OwnerOrder):MeetingAction[]{
 const status:MeetingAction={id:'status',label:'지금 누가 어디까지 했어?',kind:'question',text:'이 업무의 진행 상황과 담당별 수정·검토 결과, 지금 내가 할 일을 알려줘.',hint:'실행 원장에서 답변 · 추가 AI 호출 없음'};
 const next:MeetingAction={id:'next',label:'다음에 무엇을 결정하면 돼?',kind:'question',text:'이 업무의 진행 상황과 다음 행동을 알려줘. 완료된 것과 아직 확인할 것을 구분해줘.',hint:'현재 업무의 결과와 다음 행동 확인'};
 if(!order)return [
  {id:'work',label:'지금 하는 일부터 보고해줘',kind:'question',text:'지금 맡은 업무와 실제 실행 근거, 막힌 문제, 내가 결정해야 할 일을 간단히 보고해줘.',hint:'선택한 직원의 업무 근거로 자비스가 답변'},
  {id:'plan',label:'이 문제를 어떻게 고치면 돼?',kind:'question',text:'현재 확인된 문제 중 우선 해결할 한 가지와 담당, 수정 방법, 완료 확인 기준을 제안해줘. 근거가 없으면 확인할 질문부터 해줘.',hint:'수정안을 상의한 뒤 실제 배정'},
  {id:'new',label:'직접 수정할 일 지시하기',kind:'instruction',text:'',hint:'수정 대상·원하는 결과를 입력하면 담당 배정 → 수정 → 독립 검토 → 결과 보고'}
 ];
 if(['received','assigned','running','reviewing','building'].includes(order.stage))return [status,next];
 const actions:MeetingAction[]=[status,next];
 if(order.stage==='failed')actions.push({id:'repair',label:'중단 원인을 고치고 다시 검토해',kind:'instruction',text:`기존 업무 “${order.goal}”의 실행 중단 원인을 확인해 실제 수정하고, 프로젝트 검사와 독립 검토를 거쳐 결과를 보고해줘. 중단 기록: ${(order.error||'실행 원장의 실패 근거 확인').slice(0,400)}`,hint:'실패한 업무에 연결하여 새 수정·검토 실행'});
 (order.review?.actions||[]).forEach((text,i)=>{if(order.review?.actionKinds?.[i]==='development')actions.push({id:`review-${i}`,label:text,kind:'instruction',text:`기존 업무 “${order.goal}”의 후속 수정: ${text}\n변경 후 프로젝트 검사를 실행하고 독립 검토 결과와 남은 문제를 보고해줘.`.slice(0,1200),hint:'검토자가 제안한 실제 개발 후속 조치'});});
 actions.push({id:'followup',label:'결과에서 아쉬운 점 추가 수정',kind:'instruction',text:'',hint:'아쉬운 동작과 원하는 결과를 적으면 이 업무에 연결하여 실행'});
 return actions;
}
