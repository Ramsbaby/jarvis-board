import * as THREE from 'three';
import type { geometry } from './company-geometry';

/** Articulated, human-proportioned office characters. Forward is -Z. */
export function person(scene: THREE.Scene, color: number, x: number, z: number, build: ReturnType<typeof geometry>) {
  const group = new THREE.Group(); group.position.set(x, .1, z); scene.add(group);
  const body = new THREE.Group(); group.add(body);
  const skin = 0xdba887, hair = 0x302c30, suit = color, white = 0xf3eee5, dark = 0x253443;
  const ellipsoid = (parent: THREE.Object3D, sx: number, sy: number, sz: number, px: number, py: number, pz: number, c: number) => {
    const m = build.sphere(parent, 1, px, py, pz, c); m.scale.set(sx, sy, sz); return m;
  };
  // Shaped jacket, shirt, collar, tie and lapels rather than a single cube torso.
  ellipsoid(body, .36, .52, .22, 0, 1.48, 0, suit);
  build.box(body, .23, .48, .035, 0, 1.64, -.205, white);
  for (const s of [-1, 1]) {
    const lapel = build.box(body, .13, .42, .05, s * .13, 1.62, -.23, suit); lapel.rotation.z = -s * .23;
  }
  build.box(body, .055, .30, .04, 0, 1.57, -.24, 0xbda16c);
  ellipsoid(body, .13, .17, .13, 0, 2.01, 0, skin);
  const head = new THREE.Group(); head.position.y = 2.27; body.add(head);
  ellipsoid(head, .285, .35, .265, 0, 0, 0, skin);
  for (const s of [-1, 1]) {
    ellipsoid(head, .058, .095, .065, s * .275, -.015, 0, skin);
    ellipsoid(head, .066, .044, .026, s * .105, .035, -.247, white);
    ellipsoid(head, .026, .032, .017, s * .102, .032, -.269, 0x253447);
    ellipsoid(head, .008, .009, .009, s * .108, .043, -.284, 0xffffff);
    const brow = build.box(head, .13, .025, .025, s * .106, .12, -.247, hair); brow.rotation.z = s * .06;
  }
  ellipsoid(head, .047, .074, .065, 0, -.055, -.26, 0xce9473);
  ellipsoid(head, .085, .018, .02, 0, -.15, -.239, 0x965e55);
  ellipsoid(head, .292, .16, .27, 0, .245, .015, hair);
  ellipsoid(head, .29, .21, .13, 0, .15, .17, hair);
  const fringe = ellipsoid(head, .21, .095, .11, -.085, .22, -.17, hair); fringe.rotation.z = -.2;
  // Shoulder / hip pivots keep hands and shoes attached while walking and typing.
  const elbows: THREE.Group[] = [], knees: THREE.Group[] = [];
  const arms = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * .39, 1.78, 0); body.add(pivot);
    ellipsoid(pivot, .13, .23, .13, 0, -.20, 0, suit);
    const elbow=new THREE.Group();elbow.position.y=-.4;pivot.add(elbow);elbows.push(elbow);
    ellipsoid(elbow, .115, .20, .115, 0, -.18, 0, suit);
    build.box(elbow,.18,.08,.19,0,-.36,0,white);
    ellipsoid(elbow,.105,.13,.095,0,-.47,-.025,skin);
    return pivot;
  });
  const legs = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * .17, 1.05, 0); body.add(pivot);
    ellipsoid(pivot,.155,.27,.155,0,-.24,0,dark);
    const knee=new THREE.Group();knee.position.y=-.48;pivot.add(knee);knees.push(knee);
    ellipsoid(knee,.14,.23,.14,0,-.20,0,dark);
    ellipsoid(knee,.155,.11,.26,0,-.45,-.08,0x18232d);
    return pivot;
  });
  const badge = build.box(body, .13, .17, .035, -.22, 1.57, -.235, white);
  badge.rotation.z = -.08;
  build.box(body, .08, .025, .04, -.22, 1.57, -.26, 0x77b6b6);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.72, .77, 48), new THREE.MeshBasicMaterial({color, side: THREE.DoubleSide}));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .018; group.add(ring);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(32,32,3,32,32,31);
  gradient.addColorStop(0,'rgba(16,28,36,.32)'); gradient.addColorStop(1,'rgba(16,28,36,0)'); ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));
  contact.rotation.x=-Math.PI/2;contact.position.y=.012;group.add(contact);
  const reportDocument = build.box(elbows[1],.38,.5,.045,.06,-.46,-.08,0xf4e9d5);reportDocument.visible=false;
  return {group, body, arms, elbows, legs, knees, ring, document: reportDocument, head};
}
