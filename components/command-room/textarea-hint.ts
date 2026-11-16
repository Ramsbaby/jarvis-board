import type {KeyboardEvent} from 'react';

export const TEXTAREA_HINT_HELP='→ / Tab으로 힌트 채우기';

// Use the same controlled-value writer as typing, including its draft storage.
export function acceptTextareaHint(event:KeyboardEvent<HTMLTextAreaElement>,value:string,write:(text:string)=>void){
 const field=event.currentTarget;
 if(event.defaultPrevented||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||
    event.nativeEvent.isComposing||event.nativeEvent.keyCode===229||
    (event.key!=='ArrowRight'&&event.key!=='Tab')||field.disabled||field.readOnly||
    value!==''||field.value!=='')return;
 // 자리표시자는 '예:' 처럼 예시 표지를 달고 있다 — 표지까지 채우면 실제 지시 제목이 '예: …' 로 남아 예시처럼 보인다(11-15 실제 지시 f6c53140).
 const hint=field.placeholder.replace(/^\s*예(?:시)?\s*[:)]\s*/,'');
 if(!hint.trim()||(field.maxLength>=0&&hint.length>field.maxLength))return;
 event.preventDefault();
 write(hint);
}
