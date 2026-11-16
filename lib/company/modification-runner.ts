import {spawn,type ChildProcess} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {runtimePath as join} from './runtime-path';
import {homedir} from 'node:os';
import {advanceOrder,listOrders,type OwnerOrder,type OrderResult} from './orders';
const stages=['received','assigned','running','reviewing','building'] as const;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const target='components/office/actor-batches.ts';

/** One bounded editing session. Review and execution are independent executable gates, not a second LLM opinion. */
export async function executeModificationOrder(item:OwnerOrder){
 const root=process.env.JARVIS_ORDER_LAB_DIR;if(!root)return;
 const db=join(root,'orders.sqlite'),repo=resolve(process.env.JARVIS_ORDER_SOURCE_ROOT||process.cwd());
 const dir=join(root,item.id),capsule=join(dir,'workspace');mkdirSync(capsule,{recursive:true,mode:0o700});
 const file=join(repo,target),before=readFileSync(file,'utf8'),beforeHash=hash(before),candidate=join(capsule,'actor-batches.ts');
 const execution:NonNullable<OwnerOrder['execution']>={files:[target],beforeHash,applied:false,modelCalls:0,checks:[]};
 let child:ChildProcess|undefined,usage:unknown,stopped=false;
 const terminate=()=>{if(!child?.pid)return;try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}};
 const alive=()=>listOrders(db).some(o=>o.id===item.id&&stages.includes(o.stage as typeof stages[number]));
 const move=(stage:OwnerOrder['stage'],message:string,patch:Partial<OwnerOrder>={})=>{if(!advanceOrder(db,item.id,[...stages],{stage,execution:{...execution},...patch},message))throw Error('Execution stopped');};
 const env:NodeJS.ProcessEnv={NODE_ENV:'production',HOME:homedir(),PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,LANG:'en_US.UTF-8'};
 const run=(label:string,exe:string,args:string[],cwd:string,timeout:number,input?:string,extraEnv:Record<string,string>={})=>new Promise<string>((accept,reject)=>{
  if(!alive()){reject(Error('Execution stopped'));return;}
  let out='',tail='',partial='',turnComplete=false,settled=false;
  const proc=spawn(/* turbopackIgnore: true */ exe,args,{cwd,env:{...env,...extraEnv},stdio:['pipe','pipe','pipe'],detached:true});child=proc;
  const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else accept(out);};
  const timer=setTimeout(()=>{terminate();const pid=proc.pid;setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL');}catch{}},2000).unref();finish(Error(label+' timed out'));},timeout);
  proc.on('spawn',()=>advanceOrder(db,item.id,[...stages],{},`${label} · PID ${proc.pid}`));
  proc.stdout?.on('data',(chunk:Buffer)=>{out+=chunk.toString();if(out.length>2_000_000){terminate();finish(Error('Execution output limit'));return;}if(!input)return;partial+=chunk.toString();const lines=partial.split('\n');partial=lines.pop()||'';for(const line of lines){try{const e=JSON.parse(line);if(e.type==='thread.started')advanceOrder(db,item.id,[...stages],{},'Codex session '+String(e.thread_id).slice(0,80));if(e.type==='item.completed'&&['file_change','command_execution'].includes(e.item?.type))advanceOrder(db,item.id,[...stages],{},e.item.type==='file_change'?'수정 담당이 후보 코드를 작성했습니다.':'수정 담당의 작업 명령 종료');if(e.type==='turn.completed'){turnComplete=true;usage=e.usage;}}catch{}}});
  proc.stderr?.on('data',(chunk:Buffer)=>{tail=(tail+chunk.toString()).slice(-8000);});
  proc.on('error',()=>finish(Error(label+' process unavailable')));
  proc.on('close',code=>{if(child===proc)child=undefined;writeFileSync(join(dir,label+'.log'),out+'\n'+tail);if(code!==0||input&&!turnComplete)finish(Error(`${label} failed (${code}); see execution evidence`));else finish();});
  proc.stdin?.end(input);
 });
 const heartbeat=setInterval(()=>{if(!advanceOrder(db,item.id,[...stages],{})){stopped=true;terminate();}},2000);
 try{
  move('assigned','자비스가 렌더링 수정과 독립 검증을 배정했습니다.');
  writeFileSync(join(dir,'before.ts'),before);writeFileSync(candidate,before);
  if(item.kind==='office-render-fix'){
   writeFileSync(join(capsule,'AGENTS.md'),'Only edit actor-batches.ts in this workspace. Do not inspect profiles, credentials, memories or other projects. No external requests, deployments, package installs, git writes or source repository writes. The orchestrator performs independent tests and applies a validated candidate.');
   const prompt='Optimize the supplied actor-batches.ts actual Three.js renderer. Preserve API batchActors(scene,roots), articulated transforms, hidden ancestry and report document visibility, quality shadow flags, exact part colors and shading semantics. Compatible MeshStandardMaterial Box/Sphere parts currently split by color/material UUID, wasting draw calls. Use per-instance colors to combine compatible colors into at most TWO batches for 12 differently colored identical-standard-material box/sphere pairs. Keep incompatible alpha/roughness/metalness/textures separate (or unbatched). Preserve nonstandard materials. Do not erase colors or reduce geometry/detail. Only edit actor-batches.ts. Read it once, edit it, then finish; external orchestrator tests it. Do not run commands to inspect system/environment. Brief final summary only. Owner request within this scope: '+JSON.stringify(item.instruction);
   execution.modelCalls=1;move('running','Codex 담당이 실제 렌더링 코드를 수정 중입니다.');
   await run('codex-edit',process.env.JARVIS_CODEX_EXECUTABLE||'/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',['exec','--sandbox','workspace-write','--ephemeral','--ignore-user-config','--skip-git-repo-check','--json','--color','never','-c','model_reasoning_effort="low"','-C',capsule,'-'],capsule,180000,prompt);
   if(lstatSync(candidate).isSymbolicLink())throw Error('Candidate must be a regular file');
   const code=readFileSync(candidate,'utf8');if(hash(code)===beforeHash)throw Error('No code change produced');execution.afterHash=hash(code);
  }else {
   const parent=item.parent&&listOrders(db).find(o=>o.id===item.parent!.id);
   if(parent&&parent.stage==='failed'&&parent.execution?.reviewedCandidate){
    if(parent.execution.beforeHash!==beforeHash)throw Error('Source changed since reviewed correction');
    const prepared=join(root,parent.id,'workspace','actor-batches.ts');
    if(lstatSync(prepared).isSymbolicLink())throw Error('Reviewed candidate must be a regular file');
    const code=readFileSync(prepared,'utf8');
    if(hash(code)!==parent.execution.reviewedCandidate.hash)throw Error('Reviewed candidate changed');
    writeFileSync(candidate,code);execution.afterHash=hash(code);
    move('running','주 담당 Codex가 보정한 수정안을 AI 재호출 없이 실행 검증합니다.');
   }else {execution.afterHash=beforeHash;move('running','독립 검증 담당이 현재 수정본을 실행 검사합니다.');}
  }
  const worker:OrderResult={summary:item.kind==='office-render-fix'?'담당자가 렌더링 수정 후보를 제출했습니다. 독립 실행 검증 전입니다.':'현재 로컬 수정본의 실행 검증을 요청했습니다.',findings:[target],actions:['독립 실행 검증 후 로컬 적용 여부 판정'],limitations:['이 업무는 운영 배포를 수행하지 않습니다.'],evidence:[beforeHash,execution.afterHash!]};
  move('reviewing','독립 검증 워커가 색상·동작·그림자·그리기 묶음을 검사합니다.',{worker,usage:{worker:usage,reviewer:{input_tokens:0,output_tokens:0,method:'executable_checks'}}});
  await run('candidate-check',process.execPath,[join(repo,'scripts/verify-actor-candidate.mjs'),candidate],repo,30000);execution.checks!.push('candidate: colors, transforms, visibility, shading, <=2 compatible batches');
  if(!alive())throw Error('Execution stopped');if(hash(readFileSync(file,'utf8'))!==beforeHash)throw Error('Source changed concurrently; candidate not applied');
  if(execution.afterHash!==beforeHash){const temp=file+'.'+item.id+'.tmp';writeFileSync(temp,readFileSync(candidate));renameSync(temp,file);execution.applied=true;move('reviewing','검증된 수정본을 로컬 코드에 적용했습니다. 배포하지 않았습니다.');}
  await run('repository-check',process.execPath,[join(repo,'scripts/verify-actor-candidate.mjs'),file],repo,30000);execution.checks!.push('repository: independent execution passed');
  await run('types',process.execPath,[join(repo,'node_modules/typescript/bin/tsc'),'--noEmit'],repo,120000);execution.checks!.push('TypeScript passed');
  execution.buildDir='.next-order-'+item.id;move('building','자비스가 수정본의 격리 빌드를 검증 중입니다.');
  await run('build',process.execPath,[join(repo,'node_modules/next/dist/bin/next'),'build'],repo,300000,undefined,{JARVIS_BUILD_DIR:execution.buildDir});execution.checks!.push('isolated production build passed (not deployed)');
  move('reported','수정·실행 검사·빌드 검토 결과를 사장 보고함에 등록했습니다.',{review:{verdict:'accepted',summary:execution.applied?'캐릭터 렌더링 수정본을 로컬에 적용하고 색상·동작 검사, 타입 검사, 격리 빌드를 통과했습니다.':'현재 로컬 수정본의 실행 검사와 격리 빌드를 다시 통과했습니다.',findings:execution.checks!,actions:[],actionKinds:[],limitations:['이 업무에서 생성한 검증 빌드는 자동 배포하지 않았습니다.','프레임 개선 수치는 같은 조건의 브라우저 실측으로 별도 확인','AI 재검토가 아닌 독립 실행 검사에 의한 검토'],evidence:[target,execution.beforeHash,execution.afterHash!,execution.buildDir]}});
 }catch(e){
  if(execution.applied&&execution.afterHash&&hash(readFileSync(file,'utf8'))===execution.afterHash){writeFileSync(file,before);execution.applied=false;execution.checks!.push('rolled back exact owned change after interruption/failure');}
  if(stopped||!alive()){
   // Cancellation is terminal; preserve its receipt and attach only execution evidence.
   const Database=(await import('better-sqlite3')).default;const handle=new Database(db);try{handle.transaction(()=>{const row=handle.prepare('SELECT data FROM owner_orders WHERE id=?').get(item.id) as {data:string}|undefined;if(row){const old=JSON.parse(row.data);old.execution=execution;handle.prepare('UPDATE owner_orders SET data=? WHERE id=?').run(JSON.stringify(old),item.id);}})();}finally{handle.close();}
  }else advanceOrder(db,item.id,[...stages],{stage:'failed',execution,usage:{worker:usage??{status:'not_reported'},reviewer:{input_tokens:0,output_tokens:0,method:'executable_checks'}},error:e instanceof Error?e.message:'Execution failure'},'검증 실패 · 자동 재시도 없음 · 적용된 자체 수정은 안전하게 복원');
 }finally{clearInterval(heartbeat);terminate();}
}
