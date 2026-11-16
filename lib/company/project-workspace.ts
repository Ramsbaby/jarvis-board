import {runtimePath as join} from './runtime-path';
import {homedir} from 'node:os';
import {copyFileSync,mkdirSync,readFileSync,writeFileSync,existsSync,symlinkSync} from 'node:fs';
import {projectInfo,type ProjectId} from './projects';
export function projectRoot(id:ProjectId){projectInfo(id);return id==='gostop'?join(homedir(),'projects/gostop_app'):process.env.JARVIS_ORDER_SOURCE_ROOT||process.cwd();}
export function prepareProject(id:ProjectId,repo:string,workspace:string){
 if(id==='jarvis-board'){symlinkSync(join(repo,'node_modules'),join(workspace,'node_modules'),'dir');return;}
 // Reuse resolved dependency locations without installing packages or sharing mutable project state.
 mkdirSync(join(workspace,'.dart_tool'),{recursive:true});
 const config=JSON.parse(readFileSync(join(repo,'.dart_tool/package_config.json'),'utf8'));
 for(const pkg of config.packages)if(pkg.name==='gostop_app')pkg.rootUri='../';
 writeFileSync(join(workspace,'.dart_tool/package_config.json'),JSON.stringify(config));
 for(const name of ['package_graph.json'])if(existsSync(join(repo,'.dart_tool',name)))copyFileSync(join(repo,'.dart_tool',name),join(workspace,'.dart_tool',name));
}
export function projectRules(id:ProjectId){return id==='gostop'?
 '프로젝트는 고스톱 Flutter입니다. CLAUDE.md 및 관련 docs를 읽으세요. 한글 문서·주석. Visual-First, Safe Sync, 규칙 집행 타임아웃을 지키세요. lib/test Dart와 관련 docs를 수정하세요. 기존 test/goldens PNG 갱신은 실제 픽셀 차이와 원인을 문서화하고 시각 검토한 경우만 허용합니다. 골든 허용 오차 확대와 비교 생략은 금지합니다. 게임 AI 정책/MCTS, 결제/IAP, 광고, Firebase, 인증, 패키지·설정·플랫폼 파일은 수정 금지. 외부 통신, git, 배포, 앱 출시, 의존성 설치, 에뮬레이터 실행 금지. 오케스트레이터가 Flutter 분석·전체 테스트·실행 번들을 검사합니다. 테스트 생략/삭제/skip 금지. 기존 릴리스 전체 기능 QA를 이 작업 검사로 대체하지 마세요.':
 'Project: JARVIS Board Next16/React/TypeScript. Edit app/components/lib/contexts/hooks/styles/tests or scripts/test-*.mjs only. Do not modify auth, database access, company order/execution infrastructure, package/config files. The orchestrator runs regression tests, tsc and production build. Do not run Next, tsc, npm, or builds yourself.';}
