import * as THREE from 'three';
/** Keep the original articulated hierarchy for animation; render compatible parts in batches. */
export function batchActors(scene:THREE.Scene,roots:THREE.Group[]){
 const box=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,16,12);
 const groups=new Map<string,{geometry:THREE.BufferGeometry;material:THREE.Material;colored:boolean;parts:{mesh:THREE.Mesh;scale:THREE.Matrix4;world:THREE.Matrix4;visible:boolean;initialized:boolean;color:THREE.Color|null}[]}>();
 for(const root of roots)root.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||Array.isArray(object.material))return;
  const g=object.geometry as THREE.BufferGeometry&{parameters?:Record<string,number>};
  if(g.type!=='BoxGeometry'&&g.type!=='SphereGeometry')return;
  const material=object.material;
  const colored=material instanceof THREE.MeshStandardMaterial&&material.type==='MeshStandardMaterial'&&material.onBeforeCompile===THREE.Material.prototype.onBeforeCompile&&material.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey;
  // Only color may differ. Textures, transparency, roughness and all other shader settings stay distinct.
  let materialKey=material.uuid;
  if(colored){const data:Record<string,unknown>={...material.toJSON()};for(const k of ['uuid','name','metadata','color'])delete data[k];materialKey=JSON.stringify(data);}
  const p=g.parameters!,key=g.type+':'+materialKey;
  const existing=groups.get(key);
  const batchMaterial=existing?.material||(colored?material.clone():material);
  if(colored)(batchMaterial as THREE.MeshStandardMaterial).color.setRGB(1,1,1);
  const batch:NonNullable<ReturnType<typeof groups.get>>=groups.get(key)||{geometry:g.type==='BoxGeometry'?box:sphere,material:batchMaterial,colored,parts:[]};
  const scale=g.type==='BoxGeometry'?new THREE.Matrix4().makeScale(p.width,p.height,p.depth):new THREE.Matrix4().makeScale(p.radius,p.radius,p.radius);
  batch.parts.push({mesh:object,scale,world:new THREE.Matrix4(),visible:true,initialized:false,color:colored?(material as THREE.MeshStandardMaterial).color.clone():null});groups.set(key,batch);object.layers.set(31);
 });
 const batches=[...groups.values()].map(b=>{const mesh=new THREE.InstancedMesh(b.geometry,b.material,b.parts.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.receiveShadow=false;if(b.colored)b.parts.forEach((p,i)=>mesh.setColorAt(i,(p.mesh.material as THREE.MeshStandardMaterial).color));scene.add(mesh);return {...b,mesh};});
 const transform=new THREE.Matrix4(),hidden=new THREE.Matrix4().makeScale(0,0,0);
 return {
  partCount:batches.reduce((n,b)=>n+b.parts.length,0),batchCount:batches.length,
  update(){
   for(const root of roots)root.updateMatrixWorld(true);
   for(const b of batches){
    let matricesChanged=false,colorsChanged=false;
    b.parts.forEach((p,i)=>{
     let visible=p.mesh.visible;for(let parent=p.mesh.parent;parent&&visible;parent=parent.parent)visible=parent.visible;
     // Compare cached source transforms before multiplying or copying GPU data.
     // Most employees stand still while the owner moves; their matrices and
     // colors need neither conversion nor another upload.
     if(!p.initialized||visible!==p.visible||(visible&&!p.world.equals(p.mesh.matrixWorld))){
      const matrix=visible?transform.multiplyMatrices(p.mesh.matrixWorld,p.scale):hidden;
      b.mesh.setMatrixAt(i,matrix);b.mesh.instanceMatrix.addUpdateRange(i*16,16);matricesChanged=true;
      p.world.copy(p.mesh.matrixWorld);p.visible=visible;p.initialized=true;
     }
     if(b.colored&&b.mesh.instanceColor&&p.color){
      const color=(p.mesh.material as THREE.MeshStandardMaterial).color;
      if(!p.color.equals(color)){
       b.mesh.setColorAt(i,color);b.mesh.instanceColor.addUpdateRange(i*3,3);colorsChanged=true;p.color.copy(color);
      }
     }
    });
    if(matricesChanged)b.mesh.instanceMatrix.needsUpdate=true;
    if(colorsChanged&&b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;
   }
  },
  setShadows(enabled:boolean){for(const b of batches)b.mesh.castShadow=enabled;},
 };
}
