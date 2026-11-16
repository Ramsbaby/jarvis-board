import * as THREE from 'three';

/** Fixed world-space shadow volume: never follows camera zoom, avoiding swimming edges. */
export function companyLight() {
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.5);
  sun.position.set(-24, 38, 22); sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -38, right: 38, top: 38, bottom: -38, near: 8, far: 95});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = .025;
  sun.shadow.bias = -.00008;
  sun.shadow.radius = 2;
  return sun;
}
export function resizeCompanyShadow(sun: THREE.DirectionalLight, detail: boolean) {
  const size = detail ? 2048 : 1024;
  if(sun.shadow.mapSize.x !== size || !sun.shadow.map) {
    sun.shadow.map?.dispose(); sun.shadow.map = null;
    sun.shadow.mapSize.set(size,size);
  }
  sun.shadow.needsUpdate = true;
}
