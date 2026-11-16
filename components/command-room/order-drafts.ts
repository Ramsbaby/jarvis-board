import type {OrderKind} from '@/lib/company/orders';
import type {ProjectId} from '@/lib/company/projects';

export interface OrderDraft {
 projectId:ProjectId;
 kind:OrderKind;
 instruction:string;
 projectManual:boolean;
 parent?:{parentId:string;actionIndex:number};
}
export const ORDER_DRAFTS_KEY='jarvis.order-drafts.v1';
type StorageAccess=()=>Pick<Storage,'getItem'|'setItem'>;
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
export function createOrderDraftStore(storage:StorageAccess=browserStorage){
 let loaded=false,active:string|undefined,independentActive:string|undefined;
 const drafts=new Map<string,OrderDraft>();
 const listeners=new Set<(sent:OrderDraft)=>void>();
 function read(){
  if(loaded)return;loaded=true;
  try{
   const data:unknown=JSON.parse(storage().getItem(ORDER_DRAFTS_KEY)||'null');
   if(!data||typeof data!=='object')return;
   const saved=data as {drafts?:unknown;active?:unknown;independentActive?:unknown};
   if(!Array.isArray(saved.drafts))return;
   for(const draft of saved.drafts)if(valid(draft))drafts.set(draftKey(draft),copy(draft));
   if(typeof saved.active==='string'&&drafts.has(saved.active))active=saved.active;
   if(typeof saved.independentActive==='string'&&drafts.has(saved.independentActive)&&!drafts.get(saved.independentActive)!.parent)independentActive=saved.independentActive;
   // Older stores only tracked the last active draft, which may be a follow-up.
   else if(saved.independentActive!==null)independentActive=active&&!drafts.get(active)!.parent?active:[...drafts.keys()].reverse().find(key=>!drafts.get(key)!.parent);
  }catch{/* Malformed or inaccessible storage must not block the desk. */}
 }
 function persist(){try{storage().setItem(ORDER_DRAFTS_KEY,JSON.stringify({active,independentActive:independentActive??null,drafts:[...drafts.values()]}));return true;}catch{return false;}}
 return {
  subscribe(listener:(sent:OrderDraft)=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
  restore(context?:OrderDraft){read();const value=drafts.get(context?draftKey(context):active||'');return value?copy(value):undefined;},
  restoreIndependent(){read();const value=drafts.get(independentActive||'');return value?copy(value):undefined;},
  save(draft:OrderDraft){read();active=draftKey(draft);if(!draft.parent)independentActive=active;drafts.set(active,copy(draft));return persist();},
  sent(draft:OrderDraft){read();const key=draftKey(draft);if(drafts.get(key)?.instruction!==draft.instruction)return;drafts.delete(key);if(active===key)active=undefined;if(independentActive===key)independentActive=undefined;persist();for(const listener of listeners)listener(copy(draft));},
 };
}
export const orderDrafts=createOrderDraftStore();
