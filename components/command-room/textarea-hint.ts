import type {KeyboardEvent} from 'react';

export const TEXTAREA_HINT_HELP='→ / Tab으로 힌트 채우기';

// Use the same controlled-value writer as typing, including its draft storage.
export function acceptTextareaHint(event:KeyboardEvent<HTMLTextAreaElement>,value:string,write:(text:string)=>void){
 const field=event.currentTarget;
 if(event.defaultPrevented||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||
    event.nativeEvent.isComposing||event.nativeEvent.keyCode===229||
    (event.key!=='ArrowRight'&&event.key!=='Tab')||field.disabled||field.readOnly||
    value!==''||field.value!=='')return;
 const hint=field.placeholder;
 if(!hint.trim()||(field.maxLength>=0&&hint.length>field.maxLength))return;
 event.preventDefault();
 write(hint);
}
