export interface LabelBox {x:number;y:number;w:number;h:number}
export interface LabelAnchor {id:string;x:number;y:number;w:number;h:number;visible:boolean;priority:number}
export const labelsOverlap=(a:LabelBox,b:LabelBox,gap=6)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
/** Place complete labels in screen space once, after the camera and all actors move. */
export function layoutCompanyLabels(anchors:LabelAnchor[],width:number,height:number,reserved:LabelBox[]=[]){
 const occupied=[...reserved],result=new Map<string,LabelBox>();
 for(const a of [...anchors].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id))){
  if(!a.visible||a.w>width-16||a.h>height-16)continue;
  const x=Math.max(8,Math.min(width-a.w-8,a.x-a.w/2));
  for(const dy of [0,-a.h-8,a.h+8,-2*(a.h+8),2*(a.h+8)]){
   const box={x,y:a.y-a.h+dy,w:a.w,h:a.h};
   if(box.y<8||box.y+box.h>height-8||occupied.some(b=>labelsOverlap(box,b)))continue;
   result.set(a.id,box);occupied.push(box);break;
  }
 }
 return result;
}
/** Keep names attached to their actor. Crowding hides a label instead of shuffling it. */
export function layoutCalmLabels(anchors:LabelAnchor[],width:number,height:number,reserved:LabelBox[]=[]){
 const occupied=[...reserved],result=new Map<string,LabelBox>();
 for(const a of [...anchors].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id))){
  if(!a.visible||a.w>width-16)continue;
  const box={x:a.x-a.w/2,y:a.y-a.h,w:a.w,h:a.h};
  if(box.x<8||box.x+box.w>width-8||box.y<8||box.y+box.h>height-8||occupied.some(b=>labelsOverlap(box,b)))continue;
  result.set(a.id,box);occupied.push(box);
 }
 return result;
}
