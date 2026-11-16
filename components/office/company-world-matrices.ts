import type {Scene} from 'three';
/** The building and lights are fixed. batchActors.update owns every moving actor's
 * world matrix, so the renderer must not recalculate the same hierarchy again.
 * Call only after the static scene and actor batches have all been attached. */
export function prepareCompanyWorld(scene:Scene){
 scene.updateMatrixWorld(true);
 scene.matrixWorldAutoUpdate=false;
}
