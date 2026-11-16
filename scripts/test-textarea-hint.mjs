import test from 'node:test';
import assert from 'node:assert/strict';
import {load,hintKey} from './test-support.mjs';
const {acceptTextareaHint}=load('components/command-room/textarea-hint.ts');

test('hint acceptance requires an empty editable field, a valid hint and an unmodified non-IME key',()=>{
 for(const key of ['ArrowRight','Tab']){
  let written='';
  const props={value:'',placeholder:'지금 필요한 결정을 알려줘',maxLength:1200,onKeyDown:e=>acceptTextareaHint(e,'',v=>{written=v;})};
  assert.equal(hintKey(props,key),true);assert.equal(written,props.placeholder);
 }
 for(const extra of [{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true},{defaultPrevented:true},
  {nativeEvent:{isComposing:true,keyCode:0}},{nativeEvent:{isComposing:false,keyCode:229}}]){
  for(const key of ['ArrowRight','Tab']){
   let writes=0;
   assert.equal(hintKey({value:'',placeholder:'유효한 힌트',onKeyDown:e=>acceptTextareaHint(e,'',()=>writes++)},key,extra),false);
   assert.equal(writes,0);
  }
 }
 for(const change of [{value:'기존 입력'},{value:' '},{placeholder:''},{placeholder:' \n '},{maxLength:2},{disabled:true},{readOnly:true}]){
  const props={value:'',placeholder:'유효한 힌트',...change,onKeyDown:e=>acceptTextareaHint(e,change.value??'',()=>assert.fail('must preserve input'))};
  assert.equal(hintKey(props),false);
 }
 for(const key of ['Enter','ArrowLeft','Escape','a'])assert.equal(hintKey({value:'',placeholder:'힌트',onKeyDown:e=>acceptTextareaHint(e,'',()=>assert.fail())},key),false);
 // A native value changed before React renders must also be preserved.
 assert.equal(hintKey({value:'새 글',placeholder:'힌트',onKeyDown:e=>acceptTextareaHint(e,'',()=>assert.fail())}),false);
 // A controlled value not yet reflected in the DOM must be preserved too.
 assert.equal(hintKey({value:'',placeholder:'힌트',onKeyDown:e=>acceptTextareaHint(e,'기존 글',()=>assert.fail())}),false);
});

test('an example-labelled hint fills only the instruction, never the "예:" label',()=>{
 for(const [placeholder,expected] of [['예: 목록이 비어 보이지 않게 고쳐줘.','목록이 비어 보이지 않게 고쳐줘.'],['예시) 재시도 버튼 추가','재시도 버튼 추가'],['예 : 로딩 표시','로딩 표시'],['예약 화면 고쳐줘','예약 화면 고쳐줘']]){
  let written='';
  assert.equal(hintKey({value:'',placeholder,maxLength:1200,onKeyDown:e=>acceptTextareaHint(e,'',v=>{written=v;})},'Tab'),true);
  assert.equal(written,expected);
 }
 // A hint that is only the label has nothing to fill.
 assert.equal(hintKey({value:'',placeholder:'예:',onKeyDown:e=>acceptTextareaHint(e,'',()=>assert.fail())},'Tab'),false);
});
