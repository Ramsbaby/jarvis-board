import {canHandDocument,staffReportRoute,route,type Point} from '@/lib/company/world';
export type CallPhase='waiting'|'going'|'presenting'|'returning'|'blocked';
export type CallStatus={id:string;phase:CallPhase;message:string}|null;
interface Actor {id:string;position:Point;home:Point;path:Point[]}
/** A requested meeting is a visual inspection of live work, never a task completion. */
export function createStaffCall(o:{find:(id:string)=>Actor|undefined;owner:()=>Point;occupied:(id:string)=>Point[];available:()=>boolean;notify:(state:CallStatus)=>void;arrived:(id:string)=>void}){
 let plannedOwner:Point|undefined;
 let current:{id:string;phase:CallPhase;elapsed:number;plan:number}|null=null;
 const status=(phase:CallPhase,message:string)=>{if(!current)return;current.phase=phase;o.notify({id:current.id,phase,message});};
 const plan=()=>{if(!current)return;const a=o.find(current.id);if(a){plannedOwner={...o.owner()};a.path=staffReportRoute(a.position,plannedOwner,o.occupied(a.id));}};
 return {
  release(){if(current){const a=o.find(current.id);if(a)a.path=[];current=null;o.notify(null);}},
  id(){return current?.id;},
  phase(){return current?.phase;},
  request(id:string){if(current||!o.find(id))return false;current={id,phase:'waiting',elapsed:0,plan:0};status('waiting','진행 중인 보고가 끝나면 주인님께 이동합니다.');return true;},
  owns(id:string){return current?.id===id&&current.phase!=='waiting';},
  active(){return !!current&&current.phase!=='presenting'&&current.phase!=='blocked';},
  busy(){return !!current;},
  finish(){if(!current)return;const a=o.find(current.id);if(current.phase==='waiting'){current=null;o.notify(null);return;}if(a)a.path=route(a.position,a.home,o.occupied(a.id));current.elapsed=0;current.plan=0;status('returning','보고를 마치고 업무 자리로 돌아갑니다.');},
  tick(dt:number){if(!current)return;const a=o.find(current.id);if(!a){current=null;o.notify(null);return;}current.elapsed+=dt;
   if(current.phase==='waiting'){if(!o.available())return;current.elapsed=0;plan();status('going','주인님 호출 · 현재 업무를 보고하러 이동 중');}
   if(current.phase==='going'){
    if(canHandDocument(a.position,o.owner())){a.path=[];status('presenting','도착했습니다. 현재 업무와 다음 행동을 확인하세요.');o.arrived(a.id);return;}
    if(current.elapsed>25){a.path=[];status('blocked','이동 경로가 막혔습니다. 업무 보고를 바로 열거나 복귀를 지시하세요.');return;}
    if(current.elapsed>=current.plan&&(!a.path.length||!plannedOwner||Math.hypot(plannedOwner.x-o.owner().x,plannedOwner.z-o.owner().z)>1)){current.plan=current.elapsed+1;plan();}
   }else if(current.phase==='returning'){
    if(Math.hypot(a.position.x-a.home.x,a.position.z-a.home.z)<.15){a.path=[];current=null;o.notify(null);return;}
    if(current.elapsed>25){a.path=[];status('blocked','복귀 경로가 막혔습니다. 다시 복귀를 지시할 수 있습니다.');return;}
    if(!a.path.length&&current.elapsed>=current.plan){current.plan=current.elapsed+1;a.path=route(a.position,a.home,o.occupied(a.id));}
   }
  }
 };
}
