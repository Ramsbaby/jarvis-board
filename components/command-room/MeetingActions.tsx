'use client';
import type {OwnerOrder} from '@/lib/company/orders';
import {meetingActions,type MeetingAction} from '@/lib/company/meeting-actions';
export default function MeetingActions({order,busy,ready,onChoose}:{order?:OwnerOrder;busy:boolean;ready:boolean;onChoose:(a:MeetingAction)=>void}){
 const active=order&&['received','assigned','running','reviewing','building'].includes(order.stage);
 const heading=active?'담당자가 실행 중입니다. 진행 상황을 확인하세요.':order?.stage==='failed'?'중단 원인을 확인하고 수정할 일을 지시하세요.':order?.stage==='reported'?'결과를 확인하고 다음 수정까지 지시하세요.':'보고를 받거나 수정할 일을 맡기세요.';
 return <section className="meeting-actions" aria-label="지금 할 수 있는 일"><strong>{heading}</strong><details open={!order}><summary>추천 질문·지시 <span aria-hidden="true">⌄</span></summary><div>{meetingActions(order).map(a=><button key={a.id} disabled={busy||!ready} onClick={()=>onChoose(a)}><span className="meeting-action-kind">{a.kind==='question'?'질문':'업무 지시'}</span><b>{a.label}</b><small>{a.hint}</small></button>)}</div></details><small>선택 → 내용 확인 → 질문 보내기 또는 실제 배정</small></section>;
}
