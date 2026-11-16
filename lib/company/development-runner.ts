import {flutterTestProgress} from './development-progress';
import {projectWriteBlock} from './project-write-policy';
import {projectRoot,prepareProject,projectRules} from './project-workspace';
import {projectInfo} from './projects';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,symlinkSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {runtimePath as join} from './runtime-path';
import {homedir} from 'node:os';
import {advanceOrder,listOrders,validateOrderResult,type OwnerOrder,type OrderReview} from './orders';
import {snapshotDevelopment,developmentChanges,applyDevelopment,digest,sourceFiles,editable} from './development-workspace';
const active=['received','assigned','running','reviewing','building'] as const;
const resultSchema={type:'object',additionalProperties:false,required:['summary','findings','actions','limitations','evidence','verdict','actionKinds'],properties:{actionKinds:{type:'array',items:{type:'string',enum:['development','browser-check','verification','reference']}},summary:{type:'string'},verdict:{type:'string',enum:['accepted','needs_followup']},...Object.fromEntries(['findings','actions','limitations','evidence'].map(k=>[k,{type:'array',items:{type:'string'}}]))}};

export async function executeDevelopmentOrder(item:OwnerOrder){
 const root=process.env.JARVIS_ORDER_LAB_DIR;if(!root)return;
 const projectId=item.projectId||'jarvis-board',project=projectInfo(projectId);
 const db=join(root,'orders.sqlite'),repo=resolve(projectRoot(projectId)),dir=join(root,item.id),workspace=join(dir,'workspace');
 mkdirSync(workspace,{recursive:true,mode:0o700});
 const execution:NonNullable<OwnerOrder['execution']>={files:[],beforeHash:'',applied:false,modelCalls:0,checks:[]};
 let child:ChildProcess|undefined,workerUsage:unknown,reviewerUsage:unknown;
 const alive=()=>listOrders(db).some(o=>o.id===item.id&&active.includes(o.stage as typeof active[number]));
 const stop=()=>{if(child?.pid)try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}};
 const move=(stage:OwnerOrder['stage'],message:string,extra:Partial<OwnerOrder>={})=>{if(!advanceOrder(db,item.id,[...active],{stage,execution:{...execution},...extra},message))throw Error('실행 중단됨');};
 const heartbeat=setInterval(()=>{if(!advanceOrder(db,item.id,[...active],{}))stop();},2000);
 const run=(label:string,exe:string,args:string[],timeout:number,input?:string)=>new Promise<{usage?:unknown}>((resolveRun,reject)=>{
  if(!alive()){reject(Error('실행 중단됨'));return;}
  let output='',tail='',partial='',completed=false,usage:unknown,settled=false,lastProgressAt=0,progress:string|undefined;
  const proc=spawn(/* turbopackIgnore: true */ exe,args,{cwd:workspace,detached:true,env:{HOME:homedir(),PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,LANG:'en_US.UTF-8',NODE_ENV:'production',NODE_OPTIONS:'--max-old-space-size=8192',JARVIS_BUILD_DIR:'.next-development-check'},stdio:['pipe','pipe','pipe']});child=proc;
  const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolveRun({usage});};
  const timer=setTimeout(()=>{stop();const pid=proc.pid;setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL');}catch{}},2000).unref();finish(Error(label+' 시간 제한 초과 · 자동 재시도 없음'));},timeout);
  proc.on('spawn',()=>advanceOrder(db,item.id,[...active],{},label+' 프로세스 시작'));
  proc.on('error',()=>finish(Error(label+' 실행 연결 실패')));
  proc.stdout?.on('data',(chunk:Buffer)=>{output+=chunk.toString();if(output.length>4_000_000){stop();finish(Error('실행 기록 크기 초과'));return;}if(label==='tests'&&projectId==='gostop'){progress=flutterTestProgress(output)||progress;if(progress&&Date.now()-lastProgressAt>10000){lastProgressAt=Date.now();execution.progress=progress;advanceOrder(db,item.id,[...active],{execution:{...execution}},progress);}}if(!input)return;partial+=chunk.toString();const lines=partial.split('\n');partial=lines.pop()||'';for(const line of lines)try{const e=JSON.parse(line);if(e.type==='turn.completed'){completed=true;usage=e.usage;}if(e.type==='item.completed'&&['file_change','command_execution'].includes(e.item?.type))advanceOrder(db,item.id,[...active],{},e.item.type==='file_change'?'개발 담당이 실제 코드 변경을 제출했습니다.':'담당자의 작업 명령 종료');}catch{}});
  proc.stderr?.on('data',(chunk:Buffer)=>{tail=(tail+chunk.toString()).slice(-8000);});
  proc.on('close',code=>{if(progress)execution.progress=progress;if(child===proc)child=undefined;writeFileSync(join(dir,label+'.log'),output+'\n'+tail,{mode:0o600});finish(code!==0||input&&!completed?Error(label+' 실패'+(progress?' · '+progress:'')+' · 실행 근거를 보존했습니다'):undefined);});proc.stdin?.end(input);
 });
 try{
  move('assigned','자비스가 '+project.name+' 개발 담당과 별도 코드 검토 담당을 배정했습니다.');
  const original=listOrders(db).find(o=>o.id===item.parent?.id);
  const resume=item.parent?.actionIndex===-1&&original?.stage==='failed'&&original.kind==='development'&&original.execution?.beforeHash;
  const before=snapshotDevelopment(repo,workspace,projectId);execution.beforeHash=digest(JSON.stringify(before));
  writeFileSync(join(dir,'source-manifest.json'),JSON.stringify(before));
  prepareProject(projectId,repo,workspace);
  const rules=projectRules(projectId)+' Work only in this isolated project. Never inspect profiles, credentials, memories, other projects, or parent directories. No network, deployment, git, dependency installation, deleting files, external messages, or modifying shared dependency caches. Preserve unrelated behavior. Implement the actual owner request, not a mock/report-only substitute. No fake data/status. Read only relevant files. Keep output concise.';
  writeFileSync(join(workspace,'AGENTS.md'),rules);
  writeFileSync(join(workspace,'owner-task.json'),JSON.stringify({instruction:resume?original!.instruction:item.instruction,parent:item.parent||null},null,2));
  const cli=process.env.JARVIS_CODEX_EXECUTABLE||'/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
  const args=['exec','--ephemeral','--ignore-user-config','--skip-git-repo-check','--json','--color','never','-c','model_reasoning_effort="medium"','-C',workspace];
  execution.modelCalls=resume?0:1;move('running','개발 담당이 지시와 완료 조건을 읽고 실제 코드를 수정합니다.');
  const worker=resume?{usage:{resumedCandidate:original!.id}}:await run('development',cli,[...args,'--sandbox','workspace-write','-'],360000,rules+'\nRead owner-task.json and implement it. If scope cannot be fulfilled, explain precisely; do not substitute a rendering task. End with a concise Korean summary.');workerUsage=worker.usage;
  if(resume){const previous=join(root,original!.id,'workspace'),prior=JSON.parse(readFileSync(join(root,original!.id,'source-manifest.json'),'utf8')) as Record<string,string>;for(const path of sourceFiles(previous,projectId)){const data=readFileSync(join(previous,path));if(digest(data)===prior[path]||['next-env.d.ts','tsconfig.json'].includes(path))continue;if(!editable(path,projectId))throw Error('보존 후보의 보호 파일 변경: '+path);if((existsSync(join(repo,path))?digest(readFileSync(join(repo,path))):undefined)!==prior[path])throw Error('수정 대상이 변경돼 후보를 재사용하지 않았습니다: '+path);mkdirSync(join(workspace,path,'..'),{recursive:true});writeFileSync(join(workspace,path),data);}}
  // Next regenerates these during checks; preserve the trusted source configuration.
  for(const path of projectId==='jarvis-board'?['next-env.d.ts','tsconfig.json']:[]){if(digest(readFileSync(join(repo,path)))!==before[path])throw Error('타입 설정이 동시에 변경됐습니다.');writeFileSync(join(workspace,path),readFileSync(join(repo,path)));}
  const candidate=developmentChanges(workspace,before,projectId);execution.files=candidate.files;execution.afterHash=digest(JSON.stringify(candidate.files.map(p=>[p,candidate.after[p]])));
  if(!candidate.files.length)throw Error('개발 담당이 실제 코드 변경을 제출하지 않았습니다. 완료로 처리하지 않았습니다.');
  writeFileSync(join(dir,'candidate-manifest.json'),JSON.stringify(candidate));
  const changes=candidate.files.map(path=>path.endsWith('.png')?{path,beforeHash:before[path],afterHash:candidate.after[path],note:'Golden PNG: inspect this candidate image and the documented pixel comparison; do not approve an unexplained baseline update.'}:{path,before:before[path]?readFileSync(join(repo,path),'utf8'):null,after:readFileSync(join(workspace,path),'utf8')});
  writeFileSync(join(workspace,'review-changes.json'),JSON.stringify(changes));writeFileSync(join(dir,'review-schema.json'),JSON.stringify(resultSchema));
  execution.modelCalls+=1;move('reviewing','별도 검토 담당이 원래 지시와 실제 변경 내용을 대조합니다.',{worker:{summary:'개발 담당이 '+candidate.files.length+'개 파일의 수정안을 제출했습니다.',findings:candidate.files,actions:['독립 검토와 실행 검사'],limitations:['검토·적용 전 후보'],evidence:[execution.afterHash]},usage:{worker:workerUsage}});
  const reviewRun=await run('review',cli,[...args,'--sandbox','read-only','--output-schema',join(dir,'review-schema.json'),'-o',join(dir,'review.json'),'-'],240000,'Independently review owner-task.json and review-changes.json against the actual candidate source. Do not edit. Check whether the owner request is really implemented, UI/UX, regressions, security, and fake status. Return verdict accepted only if code satisfies the request with no material issue; needs_followup otherwise. Do not claim tests/build passed; orchestrator runs them after you. Korean summary naming the actual changed user-visible behavior (not generic acceptance), findings, 0-3 necessary next actions and matching actionKinds (development = concrete code change, browser-check = manual visual check, verification = checks the orchestrator runs next, reference = informational). Do not invent follow-ups; use empty actions and actionKinds when nothing remains. The browser is not available to the development worker, limitations, evidence paths. No external requests or private context.');reviewerUsage=reviewRun.usage;
  const review=validateOrderResult(JSON.parse(readFileSync(join(dir,'review.json'),'utf8')),true) as OrderReview;
  if(review.verdict!=='accepted'){move('failed','자비스가 검토에서 발견한 문제 때문에 적용을 보류했습니다.',{review,error:review.summary,usage:{worker:workerUsage,reviewer:reviewerUsage}});return;}
  execution.checks!.push('별도 코드 검토: 지시·변경 내용 대조 통과');
  move('reviewing','독립 코드 검토 통과 · 실제 실행 검사 시작',{review,usage:{worker:workerUsage,reviewer:reviewerUsage}});
  if(projectId==='gostop'){
   const flutter='/opt/homebrew/bin/flutter';
   await run('analysis',flutter,['analyze','--no-pub','--no-fatal-infos','--no-fatal-warnings'],180000);execution.checks!.push('Flutter 정적 분석: 오류 없음 (기존 경고·정보 로그 보존)');
   await run('tests',flutter,['test','--no-pub','--reporter','expanded'],900000);execution.checks!.push('Flutter 전체 테스트 명령 통과 · 실제 실행 로그 보존');
   move('building','고스톱 실행 번들을 격리 빌드로 검사합니다.');
   await run('build',flutter,['build','bundle','--no-pub'],300000);execution.checks!.push('Flutter 실행 번들 빌드 통과 · 에뮬레이터 전체 QA·출시 검사와 구분');
  }else{
   const tests=readdirSync(join(workspace,'scripts')).filter(p=>/^test-.*\.mjs$/.test(p)&&p!=='test-support.mjs');
   await run('tests',process.execPath,['--test',...tests.map(p=>'scripts/'+p)],120000);execution.checks!.push('업무·게임 회귀 및 변경 테스트 통과');
   await run('types',process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],120000);execution.checks!.push('TypeScript 검사 통과');
   move('building','자비스가 개발 수정본을 격리 빌드로 검사합니다.');
   await run('build',process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],300000);execution.checks!.push('격리 운영 빌드 통과 · 배포와 구분');
  }
  if(!alive())return;
  for(const path of candidate.files)if(digest(readFileSync(join(workspace,path)))!==candidate.after[path])throw Error('검토 후 후보가 변경돼 적용을 중단했습니다.');
  if(projectId==='gostop'){const blocked=projectWriteBlock(repo);if(blocked)throw Error(blocked);}
  applyDevelopment(repo,workspace,before,candidate.files,item.id);execution.applied=true;execution.buildDir=join(workspace,projectId==='gostop'?'build/flutter_assets':'.next-development-check');
  move('reported','검증된 개발 수정본을 로컬에 적용하고 결과·다음 조치를 보고했습니다.',{review:{...review,summary:review.summary+' 실제 검사와 빌드를 통과해 로컬 코드에 적용했습니다.',findings:[...review.findings,...execution.checks!].slice(0,12),limitations:[...review.limitations,'이 업무의 변경은 로컬 적용이며 운영 사이트 배포는 별도입니다.'].slice(0,12)},usage:{worker:workerUsage,reviewer:reviewerUsage}});
 }catch(e){advanceOrder(db,item.id,[...active],{stage:'failed',execution,usage:{worker:workerUsage,reviewer:reviewerUsage},error:e instanceof Error?e.message:'개발 실행 실패'},'완료 조건 미충족 · 후보와 실행 근거 보존 · 자동 재시도 없음');}
 finally{clearInterval(heartbeat);stop();}
}
