import {listenerIdentity} from './listener-evidence';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import type {OwnerOrder} from './orders';

/** Fixed local deployment sources. Never accepts a path/command from an instruction. */
export function captureFollowupEvidence(dir:string,item:OwnerOrder) {
  if(!item.parent)return;
  writeFileSync(join(dir,'parent-report.json'),JSON.stringify(item.parent,null,2));
  const repo=resolve(process.env.JARVIS_ORDER_SOURCE_ROOT||process.cwd());
  const plist=join(homedir(),'Library/LaunchAgents/ai.jarvis.board.plist');
  const field=(key:string)=>execFileSync('/usr/bin/plutil',['-extract',key,'raw','-o','-',plist],{encoding:'utf8',timeout:5000,maxBuffer:8192}).trim();
  const release=resolve(field('WorkingDirectory')),build=field('EnvironmentVariables.JARVIS_BUILD_DIR');
  if(!release.startsWith(join(repo,'.releases')+'/')||basename(build)!==build)throw Error('운영 배포 경로 검증 실패');
  const chunks=join(release,build,'server/chunks');let scanned=0;const excerpts:{file:string;sha256:string;text:string}[]=[];
  for(const name of readdirSync(chunks).filter(n=>n.endsWith('.js')).slice(0,200)){
    const path=join(chunks,name),size=statSync(path).size;if(size>3_000_000||scanned+size>30_000_000)continue;scanned+=size;
    const text=readFileSync(path,'utf8'),pos=text.indexOf('qa-state');if(pos<0)continue;
    excerpts.push({file:name,sha256:createHash('sha256').update(text).digest('hex'),text:text.slice(Math.max(0,pos-1400),pos+1800)});
  }
  let listener:'matched'|'different_directory'|'unknown'='unknown';
  try {
    const pids=execFileSync('/usr/sbin/lsof',['-t','-iTCP:3100','-sTCP:LISTEN'],{encoding:'utf8',timeout:5000,maxBuffer:1024}).trim().split(/\s+/).filter(p=>/^\d+$/.test(p));
    for(const pid of pids){
      const command=execFileSync('/bin/ps',['-p',pid,'-o','command='],{encoding:'utf8',timeout:5000,maxBuffer:4096});
      let cwd:string|null=null;
      try{cwd=execFileSync('/usr/sbin/lsof',['-a','-p',pid,'-d','cwd','-Fn'],{encoding:'utf8',timeout:5000,maxBuffer:4096}).split('\n').find(line=>line.startsWith('n'))?.slice(1)||null;}catch{}
      listener=listenerIdentity(command,cwd,release);if(listener==='matched')break;
    }
  }catch{}
  writeFileSync(join(dir,'deployment-evidence.json'),JSON.stringify({capturedAt:new Date().toISOString(),release:basename(release),buildId:readFileSync(join(release,build,'BUILD_ID'),'utf8').trim(),listenerIdentity:listener,listenerMethod:'포트3100 리스너의 명령 또는 실제 작업 디렉터리 대조. 프로세스 이름만으로 불일치를 판단하지 않음',excerpts,limits:['원본 운영 로그와 브라우저 화면은 이 조사에서 읽지 않음','현재 배포 파일·리스너 대조이며 과거 장애 시점 원인 확정이 아님','후속 조치는 읽기 전용 확인이며 수정·배포를 수행하지 않음']},null,2));
}
