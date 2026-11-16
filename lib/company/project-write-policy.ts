import {existsSync,readFileSync} from 'node:fs';
import {runtimePath} from './runtime-path';

// This legacy marker protects released APK/AAB outputs from cleanup. It is
// deliberately retained; development applies only manifest-checked source files.
const artifactMarker='v83 release verification in progress; owner wl-1025-1552-ddf7; preserve build outputs until deployment verified';
export function projectWriteBlock(root:string):string|undefined {
 const path=runtimePath(root,'.jarvis-busy');
 if(!existsSync(path))return;
 if(readFileSync(path,'utf8').trim()===artifactMarker)return;
 return '다른 프로젝트 작업의 보호 표시가 있어 원본 적용을 보류합니다. 수정 후보와 검사 결과를 보존합니다.';
}
