type ClockOptions={now:()=>number;request:(callback:(time:number)=>void)=>number;cancel:(id:number)=>void;delay:(callback:()=>void)=>number;clear:(id:number)=>void;active:()=>boolean;draw:(time:number)=>void};
/** RAF remains primary. Recover visible motion without postponing its pending callback. */
export function frameClock(o:ClockOptions){
 let frame:number|undefined,timer:number|undefined,last=0,stopped=true;
 const paint=(time:number)=>{last=Math.max(time,last);o.draw(last);};
 const arm=()=>{if(timer!==undefined||!o.active()||stopped)return;timer=o.delay(()=>{timer=undefined;if(stopped||!o.active())return;if(o.now()-last>=45)paint(o.now());arm();});};
 const tick=(time:number)=>{frame=undefined;if(stopped)return;paint(time);if(stopped)return;frame=o.request(tick);arm();};
 return {start(){if(!stopped)return;stopped=false;frame=o.request(tick);},wake(){if(stopped)return;paint(o.now());if(frame===undefined)frame=o.request(tick);arm();},stop(){stopped=true;if(frame!==undefined)o.cancel(frame);if(timer!==undefined)o.clear(timer);frame=timer=undefined;}};
}
