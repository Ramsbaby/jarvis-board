import type {OrderKind} from '@/lib/company/orders';
import type {ProjectId} from '@/lib/company/projects';
import {pushDraft} from '@/lib/company/draft-sync-client';

export interface OrderDraft {
 projectId:ProjectId;
 kind:OrderKind;
 instruction:string;
 projectManual:boolean;
 parent?:{parentId:string;actionIndex:number};
}
export const ORDER_DRAFTS_KEY='jarvis.order-drafts.v1';
type StorageAccess=()=>Pick<Storage,'getItem'|'setItem'>;
/** 기기 사이에 오가는 지시 초안 묶음. 같은 모양을 브라우저 저장소에도 쓴다. */
export interface SyncedOrderDrafts {active?:string;independentActive:string|null;drafts:OrderDraft[];updatedAt?:number}
type Push=(key:string,value:unknown,updatedAt:number)=>void;
const browserStorage:StorageAccess=()=>window.localStorage;
export const draftKey=(draft:OrderDraft)=>JSON.stringify([draft.projectId,draft.kind,draft.parent?.parentId??null,draft.parent?.actionIndex??null]);
const copy=(draft:OrderDraft):OrderDraft=>({projectId:draft.projectId,kind:draft.kind,instruction:draft.instruction,projectManual:draft.projectManual,...(draft.parent?{parent:{parentId:draft.parent.parentId,actionIndex:draft.parent.actionIndex}}:{})});
function valid(value:unknown):value is OrderDraft {
 if(!value||typeof value!=='object')return false;
 const d=value as OrderDraft;
 return ['jarvis-board','gostop'].includes(d.projectId)&&['development','office-render-fix','office-render-verify','qa-source-readonly'].includes(d.kind)
  &&(d.kind==='development'||d.projectId==='jarvis-board')&&typeof d.instruction==='string'&&d.instruction.length<=1200&&typeof d.projectManual==='boolean'
  &&(d.parent===undefined||(!!d.parent&&typeof d.parent.parentId==='string'&&d.parent.parentId.length>0&&Number.isInteger(d.parent.actionIndex)&&(d.parent.actionIndex>=0||d.parent.actionIndex===-2)));
}
/** Memory remains authoritative when browser storage is blocked or full. */
export function createOrderDraftStore(storage:StorageAccess=browserStorage,push:Push=pushDraft){
 let loaded=false,active:string|undefined,independentActive:string|undefined,updatedAt=0;
 const drafts=new Map<string,OrderDraft>();
 const listeners=new Set<(sent:OrderDraft)=>void>();
 function read(){
  if(loaded)return;loaded=true;
  try{
   const data:unknown=JSON.parse(storage().getItem(ORDER_DRAFTS_KEY)||'null');
   if(!data||typeof data!=='object')return;
   const saved=data as {drafts?:unknown;active?:unknown;independentActive?:unknown;updatedAt?:unknown};
   if(typeof saved.updatedAt==='number')updatedAt=saved.updatedAt;
   if(!Array.isArray(saved.drafts))return;
   for(const draft of saved.drafts)if(valid(draft))drafts.set(draftKey(draft),copy(draft));
   if(typeof saved.active==='string'&&drafts.has(saved.active))active=saved.active;
   if(typeof saved.independentActive==='string'&&drafts.has(saved.independentActive)&&!drafts.get(saved.independentActive)!.parent)independentActive=saved.independentActive;
   // Older stores only tracked the last active draft, which may be a follow-up.
   else if(saved.independentActive!==null)independentActive=active&&!drafts.get(active)!.parent?active:[...drafts.keys()].reverse().find(key=>!drafts.get(key)!.parent);
  }catch{/* Malformed or inaccessible storage must not block the desk. */}
 }
 const snapshot=():SyncedOrderDrafts=>({active,independentActive:independentActive??null,drafts:[...drafts.values()],updatedAt});
 /** touched=주인님이 글자를 바꾸거나 보낸 경우만 시각을 올리고 다른 기기로 보낸다. 화면 열기·전환은 보내지 않는다. */
 function persist(touched=false){if(touched){updatedAt=Math.max(Date.now(),updatedAt+1);const {updatedAt:_omit,...value}=snapshot();void _omit;push(ORDER_DRAFTS_KEY,value,updatedAt);}try{storage().setItem(ORDER_DRAFTS_KEY,JSON.stringify(snapshot()));return true;}catch{return false;}}
 return {
  subscribe(listener:(sent:OrderDraft)=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
  restore(context?:OrderDraft){read();const value=drafts.get(context?draftKey(context):active||'');return value?copy(value):undefined;},
  restoreIndependent(){read();const value=drafts.get(independentActive||'');return value?copy(value):undefined;},
  save(draft:OrderDraft,touched=false){read();const key=draftKey(draft);const changed=drafts.get(key)?.instruction!==draft.instruction;active=key;if(!draft.parent)independentActive=active;drafts.set(active,copy(draft));return persist(touched&&changed);},
  updatedAt(){read();return updatedAt;},
  /** 다른 기기의 더 새 초안 묶음으로 바꾼다. 이 기기 것이 같거나 더 새면 바꾸지 않는다. */
  adopt(remote:{value:unknown;updatedAt:number}){read();const v=remote.value as SyncedOrderDrafts;if(remote.updatedAt<=updatedAt||!v||!Array.isArray(v.drafts))return false;const next=new Map<string,OrderDraft>();for(const d of v.drafts)if(valid(d))next.set(draftKey(d),copy(d));drafts.clear();for(const [k,d] of next)drafts.set(k,d);active=typeof v.active==='string'&&drafts.has(v.active)?v.active:undefined;independentActive=typeof v.independentActive==='string'&&drafts.has(v.independentActive)&&!drafts.get(v.independentActive)!.parent?v.independentActive:undefined;updatedAt=remote.updatedAt;persist();return true;},
  sent(draft:OrderDraft){read();const key=draftKey(draft);if(drafts.get(key)?.instruction!==draft.instruction)return;drafts.delete(key);if(active===key)active=undefined;if(independentActive===key)independentActive=undefined;persist(true);for(const listener of listeners)listener(copy(draft));},
 };
}
export const orderDrafts=createOrderDraftStore();
