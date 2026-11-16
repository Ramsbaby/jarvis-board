/** Shortest-arc, frame-rate independent steering; a stopped actor keeps its heading. */
export function movementHeading(current:number,dx:number,dz:number,dt:number):number {
  if((dx===0&&dz===0)||dt<=0)return current;
  const target=Math.atan2(-dx,-dz),difference=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+difference*(-Math.expm1(-18*Math.min(dt,.1)));
}
