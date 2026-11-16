"use client";
import {useEffect,useRef,useState} from 'react';
import {orderDrafts,draftKey,ORDER_DRAFTS_KEY,type OrderDraft} from './order-drafts';
import {pullDraft} from '@/lib/company/draft-sync-client';

export const emptyOrderDraft=():OrderDraft=>({projectId:'jarvis-board',kind:'development',instruction:'',projectManual:false});
export function useOrderDraft(){
 const [draft,setDraft]=useState<OrderDraft>(emptyOrderDraft);
 const [ready,setReady]=useState(false);
 const [durable,setDurable]=useState(true);
 const [synced,setSynced]=useState(false);
 // 화면을 연 뒤 입력을 시작했으면 다른 기기의 초안으로 덮지 않는다.
 const edited=useRef(false);
 // 서버 렌더와 첫 화면을 맞추려면 브라우저 저장소의 초안은 마운트 뒤에만 읽을 수 있다(hydration-safe restore) — 마운트 1회 추가 렌더는 의도된 것.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{let live=true;const restored=orderDrafts.restoreIndependent();if(restored){setDraft(restored);setDurable(orderDrafts.save(restored));}setReady(true);
  void pullDraft(ORDER_DRAFTS_KEY).then(remote=>{if(!live||edited.current||!remote||!orderDrafts.adopt(remote))return;const next=orderDrafts.restoreIndependent();if(next){setDraft(next);setSynced(true);}});
  const off=orderDrafts.subscribe(submitted=>setDraft(current=>draftKey(current)===draftKey(submitted)&&current.instruction===submitted.instruction?emptyOrderDraft():current));return ()=>{live=false;off();};},[]);
 function save(next:OrderDraft,touched=false){if(touched)edited.current=true;setDurable(orderDrafts.save(next,touched));setDraft(next);}
 function startNew(){save(orderDrafts.restoreIndependent()||emptyOrderDraft());}
 function switchTo(context:OrderDraft){save({...(orderDrafts.restore(context)||context),projectManual:context.projectManual});}
 function edit(instruction:string,projectId:OrderDraft['projectId']){
  if(projectId!==draft.projectId&&orderDrafts.restore({...draft,projectId})?.instruction){
   // Keep both drafts when automatic assignment would replace existing work.
   save({...draft,instruction,projectManual:true},true);return false;
  }
  save({...draft,projectId,instruction},true);return true;
 }
 function sent(submitted:OrderDraft){orderDrafts.sent(submitted);}
 return {draft,ready,durable,synced,save,startNew,switchTo,edit,sent};
}
