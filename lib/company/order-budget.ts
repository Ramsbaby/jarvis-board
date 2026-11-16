import type {OwnerOrder,OrderKind} from './orders';
/** Reserve worst-case calls up front; cancellation/failure never refunds this hour. */
export function orderExecutionBudget(rows:OwnerOrder[],kind:OrderKind,actionIndex:number|undefined,now=Date.now()){
 const cost=(index:number|undefined)=>kind==='development'?(index===-1?1:2):1;
 const limit=kind==='development'?6:3,requested=cost(actionIndex);
 const recent=rows.filter(r=>!r.validationRun&&(r.kind||'qa-source-readonly')===kind&&Date.parse(r.createdAt)>now-3600000).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 const used=recent.reduce((sum,r)=>sum+cost(r.parent?.actionIndex),0);
 let remaining=used,retryAt:number|undefined;
 for(const row of recent){if(remaining+requested<=limit)break;remaining-=cost(row.parent?.actionIndex);retryAt=Date.parse(row.createdAt)+3600000;}
 return {allowed:kind==='office-render-verify'||used+requested<=limit,used,requested,limit,retryAt};
}
