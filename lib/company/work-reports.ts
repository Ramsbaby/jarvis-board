import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readJsonSource } from '../command-room/server';
import { deriveCurrentWork, safeText } from '../command-room/derive';
import { stationTasks } from './derive';
import type { CompanySnapshot, CompanyTask } from './types';
export async function readWorkReports(directory: string, now: number): Promise<{ tasks: CompanyTask[]; coverage: CompanySnapshot['coverage'][number] }> {
  try {
    const files=(await readdir(directory)).filter(f=>f.endsWith('.json')).sort();
    const inputs=await Promise.all(files.slice(0,100).map(f=>readJsonSource(join(directory,f),'work','등록된 병행 작업 보고',now/1000)));
    const tasks=inputs.filter(i=>typeof i.value?.id==='string').flatMap(i=>stationTasks([deriveCurrentWork(i,now/1000)],safeText(i.value?.id,'unknown',100)));
    return { tasks,coverage:{source:'병행 작업 보고',status:files.length>100||tasks.some(t=>t.state==='unknown')||inputs.some(i=>i.source.freshness!=='fresh')?'partial':'connected',detail:`등록된 ${tasks.length}개 작업 보고 연결 · 전체 대화 자동 수집이 아님${files.length>100?' · 첫 100개 파일 범위':''}`} };
  } catch { return { tasks:[],coverage:{source:'병행 작업 보고',status:'unavailable',detail:'보고 디렉터리 미연결 · 다른 작업이 없다는 뜻은 아님'} }; }
}
