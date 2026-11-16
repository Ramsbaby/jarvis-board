import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { deskPosition, ROOM_LABELS } from '@/lib/company/world';
export const COLORS = [0x456479, 0x537f79, 0x685f7d, 0x927853, 0x547a86, 0x83646c, 0x6b7962, 0x856c5a, 0x586c88, 0x77687d, 0x557c6e, 0x8b805f];
export function geometry(scene: THREE.Scene, roomLabels: string[] = ROOM_LABELS) {
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  function mat(c: number) { if (!materials.has(c)) materials.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: .82 })); return materials.get(c)!; }
  function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, c: number) {
    const mesh = new THREE.Mesh((w>2&&w<6&&h<.4?new RoundedBoxGeometry(w,h,d,2,Math.min(.08,h/3)):new THREE.BoxGeometry(w, h, d)), mat(c)); mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function sphere(parent: THREE.Object3D, r: number, x: number, y: number, z: number, c: number) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r,16,12),mat(c)); m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
  }
  function sign(text: string, x: number, y: number, z: number, width = 5) {
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#233b46';ctx.fillRect(0,0,768,128);ctx.font='600 44px sans-serif';ctx.fillStyle='#d9e9df';ctx.textAlign='center';ctx.fillText(text,384,81);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/6),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));m.position.set(x,y,z);scene.add(m);
  }
  box(scene,49,.8,39,0,-.5,0,0x263b47);box(scene,48,.12,38,0,-.04,0,0xd4cbbd);
  box(scene,9,.025,37,0,.04,0,0xc1b49e);
  for(let x=-23;x<24;x+=2)box(scene,.025,.012,38,x,.04,0,0xc4baa9);
  box(scene,48,3.2,.25,0,1.5,-19,0xd9e2dd);box(scene,.25,3.2,38,-24,1.5,0,0xb9cbcb);
  for(let x=-20;x<=20;x+=8){box(scene,6.4,2,.08,x,1.8,-18.82,0x9bb5bb);box(scene,.08,2.1,.1,x,1.8,-18.72,0xf0e8d7);box(scene,6.5,.07,.1,x,1.8,-18.72,0xf0e8d7);}
  [-14,14].forEach((x,side)=>[-12,0,12].forEach((z,row)=>{
    const c=[0x899a9c,0xaaa89a,0x91a39c][row];box(scene,17.8,.035,8.7,x,.07,z, c);
    box(scene,18,1.4,.25,x,.7,z-4.5,0xe0ddd3);box(scene,18,.07,.34,x,1.43,z-4.5,0x6a7d80);
    box(scene,.2,1.6,6,Math.sign(x)*5,.8,z-1.5,0xa5b9bc);
    sign(roomLabels[row*2+side] || '공용 공간',x,1.1,z-4.32,5.5);
    box(scene,3,2,.65,x-6,1,z-3.5,0x526d75);
    for(let i=0;i<5;i++)box(scene,.36,1.3,.48,x-7+i*.48,1.25,z-3.1,[0xd6bb90,0xa9c6b5,0x93aac5][i%3]);
  }));
  for(let i=0;i<14;i++){
    const {x,z}=deskPosition(i),color=0x365665;
    box(scene,3.8,.18,1.6,x,1.25,z-1,0xc8ae87);
    [-1.5,1.5].forEach(dx=>[-1.5,-.5].forEach(dz=>box(scene,.12,1.2,.12,x+dx,.6,z+dz,0x566972)));
    box(scene,1.2,.8,.1,x,1.85,z-1.3,0x263d49);box(scene,1.05,.65,.04,x,1.85,z-1.23,0x27434e);
    box(scene,.12,.3,.12,x,1.4,z-1.3,0x475b65);box(scene,.7,.06,.3,x,1.38,z-.6,0x718481);
    box(scene,.27,.32,.27,x+1.2,1.48,z-1,0xf1ece1);box(scene,.65,.04,.8,x-1.2,1.38,z-.9,0xeae4d6);box(scene,.045,.045,.5,x-1.15,1.43,z-.9,0x3e5865);
    box(scene,.8,.15,.7,x,.65,z+.55,0x45616e);box(scene,.8,.7,.15,x,1,z+.95,0x45616e);
  }
  box(scene,4,.25,1.8,0,1.3,-6,0xc8d4c8);box(scene,3.7,1.2,1.5,0,.6,-6,0x4c726e);sign('JARVIS',0,1.0,-5.08,2.8);
  // The owner's desk is the report interaction surface; props are furniture, not fabricated task counts.
  box(scene,1.1,.08,.75,-.95,1.46,16,0x36594b);box(scene,.85,.035,.58,-.95,1.52,16,0xe6dfc6);box(scene,.74,.025,.5,-.9,1.55,15.98,0xf2eddd);
  box(scene,.45,.12,.6,.9,1.5,16.05,0x293b40);box(scene,.35,.08,.16,.9,1.59,15.9,0x627779);
  box(scene,4,.2,1.6,0,1.3,16,0xcfae7d);box(scene,3.5,1.2,1.3,0,.6,16,0x6a6460);sign('주인님의 자리',0,1.0,16.82,2.8);
  // Central review table and report trays remain out of the main walking lane.
  box(scene,2,.15,3,0,1.1,4,0xdec9a3);
  [-22,22].forEach(x=>[-17,-7,5,17].forEach(z=>{box(scene,.7,.7,.7,x,.35,z,0xe0d7c9);sphere(scene,.7,x,1.4,z,0x669777);sphere(scene,.45,x,2,z,0x7ca986);}));
  // Static furniture is drawn once per material rather than once per desk leg/book.
  // Actors remain independent so their real report animations are unchanged.
  const batches=new Map<THREE.Material,THREE.Mesh[]>();
  for(const child of [...scene.children])if(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshStandardMaterial){const batch=batches.get(child.material)||[];batch.push(child);batches.set(child.material,batch);}
  for(const [material,meshes] of batches){const parts=meshes.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});const merged=mergeGeometries(parts);parts.forEach(part=>part.dispose());if(!merged)continue;const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);for(const old of meshes){scene.remove(old);old.geometry.dispose();}}
  return { box,sphere };
}
export { person } from './company-people';
