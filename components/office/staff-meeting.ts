import {route,walkable,canDeliverReport,type Point} from '@/lib/company/world';
interface Actor {id:string;position:Point;home:Point;path:Point[]}
export type MeetingMotion={phase:'waiting'|'gathering'|'meeting'|'returning'|'blocked';ids:string[];arrived:string[]}|null;
/** Visual attendance follows explicit owner intent; never advances real execution. */
export function createStaffMeeting(o:{find:(id:string)=>Actor|undefined;owner:()=>Point;occupied:(id:string)=>Point[];available:()=>boolean;notify:(s:MeetingMotion)=>void}){
 let state:MeetingMotion=null,elapsed=0,replan=0,center:Point|undefined;let next:string[]|undefined;const slots=new Map<string,Point>();
 const emit=(phase:NonNullable<MeetingMotion>['phase'],arrived:string[]=[])=>{if(!state)return;state={...state,phase,arrived};o.notify(state);};
 const plan=()=>{if(!state)return;slots.clear();center={...o.owner()};const taken:Point[]=[];for(const id of state.ids){const a=o.find(id);if(!a)continue;let chosen:Point|undefined;for(const radius of [1.7,2.7,3.7]){for(let i=0;i<12;i++){const angle=(i/12)*Math.PI*2,p={x:Math.round(center.x+Math.cos(angle)*radius),z:Math.round(center.z+Math.sin(angle)*radius)};if(!walkable(p)||!canDeliverReport(p,center)||taken.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<1.1)||o.occupied(id).some(t=>Math.hypot(t.x-p.x,t.z-p.z)<.95))continue;const path=route(a.position,p,o.occupied(id));if(path.length||Math.hypot(a.position.x-p.x,a.position.z-p.z)<.2){chosen=p;a.path=path;break;}}if(chosen)break;}if(chosen){slots.set(id,chosen);taken.push(chosen);}}};
 const start=(ids:string[])=>{state={phase:'waiting',ids:[...new Set(ids)].filter(id=>o.find(id)).slice(0,4),arrived:[]};elapsed=0;replan=0;o.notify(state);};
 const finish=()=>{if(!state)return;if(state.phase==='waiting'){state=null;o.notify(null);if(next){const ids=next;next=undefined;start(ids);}return;}for(const id of state.ids){const a=o.find(id);if(a)a.path=route(a.position,a.home,o.occupied(id));}elapsed=0;emit('returning');};
 return {request(ids:string[]){if(state){next=ids;finish();}else start(ids);},finish(){next=undefined;finish();},busy(){return !!state;},owns(id:string){return !!state&&state.phase!=='waiting'&&state.ids.includes(id);},active(){return !!state&&state.phase!=='meeting'&&state.phase!=='blocked';},phase(){return state?.phase;},tick(dt:number){if(!state)return;elapsed+=dt;if(state.phase==='waiting'){if(!o.available())return;elapsed=0;plan();emit('gathering');}
 if(state.phase==='gathering'){
  const arrived=state.ids.filter(id=>{const a=o.find(id),p=slots.get(id);return !!a&&!!p&&Math.hypot(a.position.x-p.x,a.position.z-p.z)<.2;});
  if(arrived.length===state.ids.length){for(const id of state.ids){const a=o.find(id);if(a)a.path=[];}emit('meeting',arrived);return;}
  if(arrived.join()!==state.arrived.join())emit('gathering',arrived);
  if(elapsed>35){for(const id of state.ids){const a=o.find(id);if(a)a.path=[];}emit('blocked',arrived);return;}
  if(center&&Math.hypot(center.x-o.owner().x,center.z-o.owner().z)>1){plan();}
  else if(elapsed>=replan){replan=elapsed+1;for(const id of state.ids){const a=o.find(id),p=slots.get(id);if(a&&p&&!a.path.length&&!arrived.includes(id))a.path=route(a.position,p,o.occupied(id));}}
 }else if(state.phase==='returning'){
  if(state.ids.every(id=>{const a=o.find(id);return !a||Math.hypot(a.position.x-a.home.x,a.position.z-a.home.z)<.2;})){state=null;o.notify(null);if(next){const ids=next;next=undefined;start(ids);}return;}
  if(elapsed>35){emit('blocked');return;}if(elapsed>=replan){replan=elapsed+1;for(const id of state.ids){const a=o.find(id);if(a&&!a.path.length)a.path=route(a.position,a.home,o.occupied(id));}}
 }
 }};
}
