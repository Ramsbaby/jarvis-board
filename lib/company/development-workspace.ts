import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync,writeFileSync,mkdirSync,renameSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
import {runtimePath as join} from './runtime-path';

export const digest=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
export type Manifest=Record<string,string>;
const boardRoots=['app','components','lib','contexts','hooks','styles','tests','scripts','public'];
const boardConfig=['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','eslint.config.mjs','middleware.ts'];
export function editable(path:string,project='jarvis-board'){
 if(path.split('/').some(p=>p==='..'||p.startsWith('.')))return false;
 if(project==='gostop')return /^(lib|test)\/[\w./-]+\.dart$/.test(path)&&!/^lib\/(domain\/ai\/|.*(?:iap|purchase|billing|firebase|ads|mcts|ai_policy))/.test(path)||/^docs\/[\w./-]+\.md$/.test(path)||/^test\/goldens\/[\w/-]+\.png$/.test(path);
 if(!/^(app|components|lib|contexts|hooks|styles|tests)\/[\w./-]+\.(tsx?|css|json|mjs)$/.test(path)&&!/^scripts\/test-[\w-]+\.mjs$/.test(path))return false;
 if(path.split('/').some(p=>p==='..'||p.startsWith('.')))return false;
 return !/^(lib\/company\/(development-|project|runtime-path|order-|orders\.|modification-)|app\/api\/command-room\/orders\/|lib\/(auth|guest-guard|db|llm)|app\/api\/auth\/)/.test(path);
}
export function sourceFiles(root:string,project='jarvis-board'){
 const roots=project==='gostop'?['lib','test','assets','docs']:boardRoots;const config=project==='gostop'?['pubspec.yaml','pubspec.lock','analysis_options.yaml','android/app/src/main/AndroidManifest.xml','android/app/build.gradle','scripts/action-coverage-policy.json','scripts/action-coverage.py','scripts/prune-test-cache.sh','CLAUDE.md','.cursorrules','.claude/constitution/MANIFESTO.md','.claude/constitution/isolation-policy.md','.claude/constitution/visual-first-law.md','.claude/constitution/conflict-resolution.md']:boardConfig;
 const files:string[]=[];
 const walk=(path:string)=>{if(project==='gostop'&&path==='test/failures')return;const full=join(root,path);if(!existsSync(full))return;const stat=lstatSync(full);if(stat.isSymbolicLink())throw Error('심볼릭 링크는 개발 작업에서 지원하지 않습니다: '+path);if(stat.isDirectory()){for(const name of readdirSync(full)){if(!name.startsWith('.')&&!['node_modules','work'].includes(name))walk(path+'/'+name);}}else if(stat.isFile()&&stat.size<(project==='gostop'?50_000_000:2_000_000))files.push(path);};
 for(const dir of roots)walk(dir);for(const path of config)if(existsSync(join(root,path)))files.push(path);return files;
}
export function snapshotDevelopment(repo:string,workspace:string,project='jarvis-board'):Manifest{
 const manifest:Manifest={};for(const path of sourceFiles(repo,project)){const data=readFileSync(join(repo,path));manifest[path]=digest(data);mkdirSync(dirname(join(workspace,path)),{recursive:true});writeFileSync(join(workspace,path),data);}return manifest;
}
export function developmentChanges(workspace:string,before:Manifest,project='jarvis-board'){
 const after:Manifest={};for(const path of sourceFiles(workspace,project))after[path]=digest(readFileSync(join(workspace,path)));
 const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(p=>before[p]!==after[p]);
 if(changed.length>20)throw Error('한 업무에서 변경할 수 있는 파일 20개를 초과했습니다. 업무를 나누어 주세요.');
 for(const path of changed){if(!editable(path,project))throw Error('보호된 파일 변경은 적용하지 않습니다: '+path);if(!after[path])throw Error('파일 삭제는 자동 적용하지 않습니다: '+path);}
 return {files:changed,after};
}
function regularDestination(repo:string,path:string){let current=repo;for(const part of path.split('/')){current=join(current,part);try{if(lstatSync(current).isSymbolicLink())throw Error('원본 경로가 변경됐습니다: '+path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}}
/** Compare every source dependency, then apply only owned changes. Never reset an unrelated edit. */
export function applyDevelopment(repo:string,workspace:string,before:Manifest,files:string[],id:string){
 for(const [path,hash] of Object.entries(before)){regularDestination(repo,path);if(!existsSync(join(repo,path))||digest(readFileSync(join(repo,path)))!==hash)throw Error('다른 작업이 원본을 변경했습니다. 검증 후보를 보존하고 적용을 중단합니다: '+path);}
 const backup=new Map<string,Buffer|undefined>(),applied:string[]=[];
 try{for(const path of files){regularDestination(repo,path);const full=join(repo,path);if(!before[path]&&existsSync(full))throw Error('새 파일 충돌: '+path);backup.set(path,existsSync(full)?readFileSync(full):undefined);mkdirSync(dirname(full),{recursive:true});writeFileSync(full+'.'+id+'.tmp',readFileSync(join(workspace,path)));renameSync(full+'.'+id+'.tmp',full);applied.push(path);}}
 catch(e){for(const path of applied.reverse()){const full=join(repo,path);if(digest(readFileSync(full))!==digest(readFileSync(join(workspace,path))))continue;const original=backup.get(path);if(original)writeFileSync(full,original);else unlinkSync(full);}throw e;}
}
