import type { person } from './company-people';
type Actor=ReturnType<typeof person>;
/** A seat is a physical posture, not evidence of active work. */
export function poseActor(a:Actor,walking:boolean,working:boolean,seated:boolean,time:number,presenting=false){
 a.body.position.y=seated?-.36:0;
 a.body.position.z=seated?-.45:0;
 a.body.rotation.x=seated&&working?.04+Math.sin(time*1.8)*.025:0;
 a.head.rotation.y=seated&&working?Math.sin(time*.9)*.12:0;
 a.head.rotation.x=seated?(working?.08+Math.sin(time*1.5)*.025:.03):0;
 a.legs.forEach((leg,i)=>{leg.rotation.x=seated?Math.PI/2:walking?Math.sin(time*11+i*Math.PI)*.5:0;a.knees[i].rotation.x=seated?-Math.PI/2:walking?Math.max(0,-Math.sin(time*11+i*Math.PI))*.35:0;});
 a.arms.forEach((arm,i)=>{arm.rotation.x=seated?(working?1.05+Math.sin(time*5+i*Math.PI)*.18:.25):walking?Math.sin(time*11+i*Math.PI)*.5:working?.8:0;a.elbows[i].rotation.x=seated?(working?.5+Math.sin(time*5+i*Math.PI)*.16:.85):working?.5:0;});
 // A report is held by the right hand; presenting never implies task completion.
 if(presenting&&!walking&&!seated){a.arms[1].rotation.x=.65;a.elbows[1].rotation.x=.65;}
}
