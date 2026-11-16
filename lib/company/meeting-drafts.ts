import {pushDraft} from './draft-sync-client';
export type MeetingDraft={question:string;instruction:string;askKey:string|null;executeKey:string|null;orderId?:string;meetingId?:string;updatedAt?:number};
/** 기기 사이에 오가는 것은 글자뿐이다. 중복 접수 방지 표식과 업무 연결은 이 기기에만 둔다. */
export type SyncedMeetingText={question:string;instruction:string};
const prefix='jarvis.meeting-draft.v1:';
const memory=new Map<string,MeetingDraft>();
export const meetingDraftKey=(employee:string,project:string)=>prefix+JSON.stringify([employee,project]);
export function readMeetingDraft(key:string):MeetingDraft|undefined{
 try{const d=JSON.parse(window.localStorage.getItem(key)||'null');if(d&&typeof d.question==='string'&&typeof d.instruction==='string'){const value={question:d.question.slice(0,1200),instruction:d.instruction.slice(0,1200),askKey:typeof d.askKey==='string'?d.askKey:null,executeKey:typeof d.executeKey==='string'?d.executeKey:null,orderId:typeof d.orderId==='string'?d.orderId:undefined,meetingId:typeof d.meetingId==='string'?d.meetingId:undefined,updatedAt:typeof d.updatedAt==='number'?d.updatedAt:undefined};memory.set(key,value);return value;}}catch{}
 return memory.get(key);
}
/** touched=주인님이 실제로 글자를 바꾼 경우만. 자동 추천 채우기·복원·열기는 시각을 바꾸지 않아 다른 기기의 초안을 덮지 않는다. */
export function saveMeetingDraft(key:string,draft:MeetingDraft,touched=false){
 const previous=memory.get(key);
 const updatedAt=touched?Date.now():Math.max(draft.updatedAt??0,previous?.updatedAt??0)||undefined;
 const value={...draft,updatedAt};memory.set(key,value);
 if(touched&&updatedAt)pushDraft(key,{question:draft.question,instruction:draft.instruction} satisfies SyncedMeetingText,updatedAt);
 try{window.localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
}
export function validMeetingText(v:unknown):v is SyncedMeetingText{return !!v&&typeof v==='object'&&typeof (v as SyncedMeetingText).question==='string'&&typeof (v as SyncedMeetingText).instruction==='string'&&(v as SyncedMeetingText).question.length<=1200&&(v as SyncedMeetingText).instruction.length<=1200;}
export function readMeetingProject(employee:string){try{const p=window.localStorage.getItem('jarvis.meeting-project.v1:'+employee);return p==='gostop'||p==='jarvis-board'?p:undefined;}catch{return undefined;}}
export function saveMeetingProject(employee:string,project:string){try{window.localStorage.setItem('jarvis.meeting-project.v1:'+employee,project);}catch{}}
