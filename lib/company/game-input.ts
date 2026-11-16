/** Browser shortcuts, composing text and controls must never become avatar input. */
export function gameInputAllowed(event:Pick<KeyboardEvent,'metaKey'|'ctrlKey'|'altKey'|'isComposing'>,focused:boolean,editable:boolean,modal:boolean):boolean {
 return focused&&!editable&&!modal&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.isComposing;
}
