"use client";
import {useEffect,useState} from 'react';
import {orderDrafts,draftKey,ORDER_DRAFTS_KEY,type OrderDraft} from './order-drafts';
import {pullDraft,onDraftResume,unsentState,discardUnsent,type RemoteDraft} from '@/lib/company/draft-sync-client';

export const emptyOrderDraft=():OrderDraft=>({projectId:'jarvis-board',kind:'development',instruction:'',projectManual:false});
export function useOrderDraft(){
 const [draft,setDraft]=useState<OrderDraft>(emptyOrderDraft);
 const [ready,setReady]=useState(false);
 const [durable,setDurable]=useState(true);
 // 다른 기기 초안을 반영했을 때의 안내와, 못 올린 글과 겹쳤을 때 고를 수 있는 다른 기기 초안.
 const [syncNote,setSyncNote]=useState('');
 const [conflict,setConflict]=useState<RemoteDraft<unknown>|null>(null);
 /** 지금 보고 있는 초안 자리(독립 지시·후속 지시)를 유지한 채 저장소 내용으로 화면을 맞춘다. */
 function showStored(){setDraft(current=>{const next=orderDrafts.restore(current);setSyncNote(next?.instruction?'다른 기기에서 쓰던 초안을 불러왔습니다. ':'다른 기기에서 초안을 비웠습니다(보냈거나 지움). ');return next||{...current,instruction:''};});}
 // 이 기기에 못 올린 글이 있으면 덮지 않는다. 다 올라간 상태에서 다른 기기가 더 나중에 썼으면 그것으로 맞춘다.
 function applyRemote(remote:RemoteDraft<unknown>|null){if(!remote)return;if(unsentState(ORDER_DRAFTS_KEY)==='conflict'){setConflict(remote);setSyncNote('다른 기기에서 더 나중에 쓴 초안이 있습니다. 이 기기에서 아직 못 올린 글은 지우지 않고 그대로 두었습니다. ');return;}if(unsentState(ORDER_DRAFTS_KEY)!=='none'||!orderDrafts.adopt(remote))return;setConflict(null);showStored();}
 // 서버 렌더와 첫 화면을 맞추려면 브라우저 저장소의 초안은 마운트 뒤에만 읽을 수 있다(hydration-safe restore) — 마운트 1회 추가 렌더는 의도된 것.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{let live=true;const restored=orderDrafts.restoreIndependent();if(restored){setDraft(restored);setDurable(orderDrafts.save(restored));}setReady(true);
  const sync=()=>void pullDraft(ORDER_DRAFTS_KEY).then(remote=>{if(live)applyRemote(remote);});sync();const offResume=onDraftResume(sync);
  const off=orderDrafts.subscribe(submitted=>setDraft(current=>draftKey(current)===draftKey(submitted)&&current.instruction===submitted.instruction?emptyOrderDraft():current));return ()=>{live=false;off();offResume();};},[]);
 function save(next:OrderDraft,touched=false){if(touched){setConflict(null);setSyncNote('');}setDurable(orderDrafts.save(next,touched));setDraft(next);}
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
 /** 겹쳤을 때 주인님이 다른 기기 초안을 고르면 이 기기의 못 올린 글을 버리고 그것으로 바꾼다. */
 function takeRemote(){if(!conflict)return;discardUnsent(ORDER_DRAFTS_KEY);if(orderDrafts.adopt(conflict))showStored();setConflict(null);}
 return {draft,ready,durable,syncNote,conflict:!!conflict,takeRemote,save,startNew,switchTo,edit,sent};
}
