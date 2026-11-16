"use client";
import {useEffect,useState} from 'react';
import {orderDrafts,draftKey,type OrderDraft} from './order-drafts';

export const emptyOrderDraft=():OrderDraft=>({projectId:'jarvis-board',kind:'development',instruction:'',projectManual:false});
export function useOrderDraft(){
 const [draft,setDraft]=useState<OrderDraft>(emptyOrderDraft);
 const [ready,setReady]=useState(false);
 const [durable,setDurable]=useState(true);
 // 서버 렌더와 첫 화면을 맞추려면 브라우저 저장소의 초안은 마운트 뒤에만 읽을 수 있다(hydration-safe restore) — 마운트 1회 추가 렌더는 의도된 것.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{const restored=orderDrafts.restoreIndependent();if(restored){setDraft(restored);setDurable(orderDrafts.save(restored));}setReady(true);return orderDrafts.subscribe(submitted=>setDraft(current=>draftKey(current)===draftKey(submitted)&&current.instruction===submitted.instruction?emptyOrderDraft():current));},[]);
 function save(next:OrderDraft){setDurable(orderDrafts.save(next));setDraft(next);}
 function startNew(){save(orderDrafts.restoreIndependent()||emptyOrderDraft());}
 function switchTo(context:OrderDraft){save({...(orderDrafts.restore(context)||context),projectManual:context.projectManual});}
 function edit(instruction:string,projectId:OrderDraft['projectId']){
  if(projectId!==draft.projectId&&orderDrafts.restore({...draft,projectId})?.instruction){
   // Keep both drafts when automatic assignment would replace existing work.
   save({...draft,instruction,projectManual:true});return false;
  }
  save({...draft,projectId,instruction});return true;
 }
 function sent(submitted:OrderDraft){orderDrafts.sent(submitted);}
 return {draft,ready,durable,save,startNew,switchTo,edit,sent};
}
