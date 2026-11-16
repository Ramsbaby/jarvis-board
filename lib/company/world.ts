export interface Point { x: number; z: number }
export const ROOM_LABELS = ['서관 업무석 1', '동관 업무석 1', '서관 업무석 2', '동관 업무석 2', '서관 업무석 3', '동관 업무석 3'];
export const deskPosition = (i: number): Point => i>=12?{x:0,z:i===12?0:-13}:({ x: (i % 4 < 2 ? -17 : 11) + (i % 2) * 6, z: -12 + Math.floor(i / 4) * 12 });
export const HOME: Point = { x: 0, z: 13 };
export const RECEPTION: Point = { x: 0, z: -3 };
export interface Block { x: number; z: number; w: number; d: number }
export const BLOCKS: Block[] = [
  ...Array.from({ length: 14 }, (_, i) => { const p = deskPosition(i); return { x: p.x, z: p.z - 1, w: 3.8, d: 1.6 }; }),
  ...[-14, 14].flatMap(x => [-12, 0, 12].flatMap(z => [
    { x, z: z - 4.5, w: 18, d: .25 },
    { x: Math.sign(x) * 5, z: z - 1.5, w: .25, d: 6 },
  ])),
  { x: 0, z: 4, w: 2, d: 3 },
  ...[-14, 14].flatMap(x => [-12, 0, 12].map(z => ({ x: x - 6, z: z - 3.5, w: 3, d: .65 }))),
  ...[-22, 22].flatMap(x => [-17, -7, 5, 17].map(z => ({ x, z, w: 1.2, d: 1.2 }))),
  { x: 0, z: -6, w: 4, d: 1.8 }, { x: 0, z: 16, w: 4, d: 1.6 },
];
export function walkable(p: Point) {
  return Math.abs(p.x) < 23.3 && Math.abs(p.z) < 18.3 && !BLOCKS.some(b => Math.abs(p.x - b.x) < b.w / 2 + .6 && Math.abs(p.z - b.z) < b.d / 2 + .6);
}
export function route(from: Point, to: Point, occupied: Point[] = []): Point[] {
  const free=(p:Point)=>walkable(p)&&!occupied.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<.9);
  const start = { x: Math.round(from.x), z: Math.round(from.z) }, end = { x: Math.round(to.x), z: Math.round(to.z) };
  if (!free(end)) return [];
  const key = (p: Point) => `${p.x},${p.z}`, queue = [start], seen = new Map<string, Point | null>([[key(start), null]]);
  for (let index = 0; index < queue.length; index++) {
    const p = queue[index];
    if (p.x === end.x && p.z === end.z) {
      const result: Point[] = []; let cursor: Point | null = p;
      while (cursor && key(cursor) !== key(start)) { result.unshift(cursor); cursor = seen.get(key(cursor)) ?? null; }
      return result;
    }
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const next = { x: p.x + dx, z: p.z + dz };
      if (free(next) && !seen.has(key(next))) { seen.set(key(next), p); queue.push(next); }
    }
  }
  return [];
}

export function reportMeetingPoint(p:Point):Point {
  // Stay in the owner's reachable patch, including corners; never fall back to a distant office.
  for(const radius of [2.5,1.5]) for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]]) {
    const target={x:Math.round(p.x+dx*radius),z:Math.round(p.z+dz*radius)};
    if(walkable(target)&&Array.from({length:10},(_,i)=>(i+1)/10).every(f=>walkable({x:p.x+(target.x-p.x)*f,z:p.z+(target.z-p.z)*f})))return target;
  }
  return {...p};
}

/** Delivery can start in clear speaking range; an occupied waypoint must not trap the secretary. */
export function canDeliverReport(from:Point,owner:Point):boolean {
  return Math.hypot(from.x-owner.x,from.z-owner.z)<=3.8&&Array.from({length:12},(_,i)=>(i+1)/12).every(f=>walkable({x:from.x+(owner.x-from.x)*f,z:from.z+(owner.z-from.z)*f}));
}

/** A document changes hands only at arm's length, with no furniture between actors. */
export function canHandDocument(from:Point,recipient:Point):boolean {
  const distance=Math.hypot(from.x-recipient.x,from.z-recipient.z);
  return distance>=.85&&distance<=1.8&&Array.from({length:16},(_,i)=>(i+1)/16).every(f=>walkable({x:from.x+(recipient.x-from.x)*f,z:from.z+(recipient.z-from.z)*f}));
}
export function staffReportRoute(from:Point,recipient:Point,occupied:Point[]=[]):Point[] {
  const candidates:Point[][]=[];
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
    const end={x:Math.round(recipient.x)+dx,z:Math.round(recipient.z)+dz};
    if(!canHandDocument(end,recipient))continue;
    const path=route(from,end,occupied);
    if(path.length)candidates.push(path);
  }
  return candidates.sort((a,b)=>a.length-b.length)[0]??[];
}
