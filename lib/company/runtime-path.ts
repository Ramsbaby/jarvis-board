import {join} from 'node:path';
/** Runtime workspaces/logs are host resources, not deployment assets. An opaque join
 * prevents Next's asset tracer from expanding an env-dependent path into repo/**. */
export function runtimePath(...parts:string[]):string{return Reflect.apply(join,undefined,parts);}
