import type {OwnerOrder} from '@/lib/company/orders';

export type FollowupAction = 'browser'|'development'|'checks'|'note'|'execute'|'prepare';

/** Legacy review prose is not an executable command or a reliable capability label.
 * Only the owner's explicit instruction starts development. No keyword guesses.
 */
export function followupAction(order:OwnerOrder,_action:string,actionIndex?:number):FollowupAction {
 if(order.kind!=='development')return 'execute';
 const index=actionIndex??order.review?.actions.indexOf(_action)??-1;
 const kind=order.review?.actionKinds?.[index];
 return kind==='development'?'development':kind==='browser-check'?'browser':kind==='verification'?'checks':kind==='reference'?'note':'prepare';
}

export function hasPreservedChanges(order:OwnerOrder):boolean {
 return !!order.execution?.files.length;
}

export function canResumeChanges(order:OwnerOrder):boolean {
 return order.stage==='failed'&&order.kind==='development'&&hasPreservedChanges(order)&&!!order.execution?.beforeHash;
}

export function misassignedBrowserCheck(order:OwnerOrder):boolean {
 return order.stage==='failed'&&order.kind==='development'&&!!order.execution&&!hasPreservedChanges(order)&&!!order.parent;
}

/** Recheck at the send boundary as well as hiding assignment controls. */
export function canAssignFollowup(order:OwnerOrder,index:number):boolean {
 if(index===-1)return canResumeChanges(order);
 if(order.stage==='failed'&&order.kind==='office-render-fix'&&order.execution?.reviewedCandidate)return index===0&&hasPreservedChanges(order);
 const action=order.review?.actions[index];
 return Number.isInteger(index)&&index>=0&&!!action&&['development','execute'].includes(followupAction(order,action,index));
}
