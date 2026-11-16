import {movementHeading} from '@/lib/company/animation';
import type {Point} from '@/lib/company/world';
/** Listen to the present speaker without moving the owner or overriding input. */
export function reportFacing(heading:number,owner:Point,speaker:Point|undefined,manualMovement:boolean,dt:number){
 if(manualMovement||!speaker)return heading;
 return movementHeading(heading,speaker.x-owner.x,speaker.z-owner.z,dt);
}
