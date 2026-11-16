/** The owner selects registered projects, never a filesystem path or executable command. */
export const PROJECTS={
 'jarvis-board':{id:'jarvis-board',name:'자비스보드',assignee:'본사 개발 담당',scope:'본사 화면·기능',checks:'회귀 검사 · TypeScript · 운영 빌드'},
 'gostop':{id:'gostop',name:'고스톱',assignee:'고스톱 Flutter 개발 담당',scope:'Flutter 화면·기능·테스트',checks:'Flutter 분석 · 전체 테스트 · 실행 번들'},
} as const;
export type ProjectId=keyof typeof PROJECTS;
export function projectInfo(id:unknown){if(typeof id!=='string'||!Object.prototype.hasOwnProperty.call(PROJECTS,id))throw Error('등록된 프로젝트를 선택하세요.');return PROJECTS[id as ProjectId];}
