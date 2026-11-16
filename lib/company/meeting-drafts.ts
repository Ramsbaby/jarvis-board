export type MeetingDraft={question:string;instruction:string;askKey:string|null;executeKey:string|null;orderId?:string;meetingId?:string};
const prefix='jarvis.meeting-draft.v1:';
const memory=new Map<string,MeetingDraft>();
export const meetingDraftKey=(employee:string,project:string)=>prefix+JSON.stringify([employee,project]);
export function readMeetingDraft(key:string):MeetingDraft|undefined{
 try{const d=JSON.parse(window.localStorage.getItem(key)||'null');if(d&&typeof d.question==='string'&&typeof d.instruction==='string'){const value={question:d.question.slice(0,1200),instruction:d.instruction.slice(0,1200),askKey:typeof d.askKey==='string'?d.askKey:null,executeKey:typeof d.executeKey==='string'?d.executeKey:null,orderId:typeof d.orderId==='string'?d.orderId:undefined,meetingId:typeof d.meetingId==='string'?d.meetingId:undefined};memory.set(key,value);return value;}}catch{}
 return memory.get(key);
}
export function saveMeetingDraft(key:string,draft:MeetingDraft){memory.set(key,{...draft});try{window.localStorage.setItem(key,JSON.stringify(draft));return true;}catch{return false;}}
export function readMeetingProject(employee:string){try{const p=window.localStorage.getItem('jarvis.meeting-project.v1:'+employee);return p==='gostop'||p==='jarvis-board'?p:undefined;}catch{return undefined;}}
export function saveMeetingProject(employee:string,project:string){try{window.localStorage.setItem('jarvis.meeting-project.v1:'+employee,project);}catch{}}
