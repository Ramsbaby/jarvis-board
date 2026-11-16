import {withDeployment} from '@/lib/company/deployment-store';
import {NextResponse,type NextRequest,after} from 'next/server';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {getRequestAuth} from '@/lib/guest-guard';
import {sameOrderOrigin} from '@/lib/company/order-origin';
import {orderConfig,executeOrder} from '@/lib/company/order-runner';
import {createOrder,listOrders} from '@/lib/company/orders';
import {projectInfo,type ProjectId} from '@/lib/company/projects';
import {readMeetings,meeting,saveMeeting,beginInterview,finishInterview} from '@/lib/company/meetings';
import {meetingExecutionAnswer} from '@/lib/company/meeting-status';
import {validateMeetingAnswer,groundedMeetingProposal,interviewSystem} from '@/lib/company/meeting-answer';
import {callLLM,LLMError} from '@/lib/llm';
import {buildCommandRoom} from '@/lib/command-room/server';
import {loadCompany} from '@/lib/company/server';
import {companyEmployees} from '@/lib/company/employees';
import {listAutomationsSnapshot} from '@/lib/openclaw-automations';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){if(!getRequestAuth(req).isOwner)return NextResponse.json({error:'소유자 로그인 필요'},{status:401,headers});const c=orderConfig();return NextResponse.json(c?{items:readMeetings(join(c.root,'meetings.sqlite'))}:{error:'실행 연결 필요'},{status:c?200:503,headers});}
export async function POST(req:NextRequest){
 if(!getRequestAuth(req).isOwner)return NextResponse.json({error:'소유자 로그인 필요'},{status:401,headers});
 if(!sameOrderOrigin(req.headers.get('origin'),req.headers.get('host'),req.nextUrl.protocol))return NextResponse.json({error:'동일 출처 요청 필요'},{status:403,headers});
 const c=orderConfig();if(!c)return NextResponse.json({error:'실행 연결 필요'},{status:503,headers});
 const text=await req.text();if(text.length>8000)return NextResponse.json({error:'입력 크기 초과'},{status:413,headers});
 let b;try{b=JSON.parse(text);}catch{return NextResponse.json({error:'요청 형식 오류'},{status:400,headers});}
 const file=join(c.root,'meetings.sqlite');
 try{
  if(!b||typeof b.requestId!=='string'||! /^[a-f0-9-]{36}$/.test(b.requestId))throw Error('요청 번호를 확인하세요.');
  projectInfo(b.projectId);
  if(b.orderId!==undefined&&(typeof b.orderId!=='string'||!b.orderId))throw Error('보고의 업무 식별자를 확인하세요.');
  const orders=withDeployment(listOrders(c.db),c.root);
  const linked=b.orderId?orders.find(o=>o.id===b.orderId):undefined;
  if(b.orderId&&(!linked||(linked.projectId||'jarvis-board')!==b.projectId))throw Error('보고의 업무와 프로젝트가 일치하지 않습니다. 다른 업무로 연결하지 않았습니다.');
  if(b.operation==='open'){
   if(typeof b.employeeId!=='string'||! /^[a-z0-9-]{1,80}$/.test(b.employeeId))throw Error('직원 식별자를 확인하세요.');
   // A reload may follow a committed dispatch whose HTTP response never arrived.
   // Recover by the original durable request and meeting; never create another job.
   if(b.resumeRequestId!==undefined){
    if(typeof b.resumeRequestId!=='string'||typeof b.id!=='string'||typeof b.instruction!=='string')throw Error('미확인 접수의 원래 면담과 지시를 확인하세요.');
    const receipt=orders.find(o=>o.requestId===b.resumeRequestId),original=meeting(file,b.id);
    if(!original||original.employeeId!==b.employeeId||original.projectId!==b.projectId)throw Error('미확인 접수의 면담이 다릅니다. 초안을 유지했습니다.');
    if(receipt){
     if(receipt.instruction!==b.instruction.trim()||(receipt.projectId||'jarvis-board')!==b.projectId||original.orderId!==receipt.id||(b.orderId!==receipt.id&&b.orderId!==receipt.parent?.id))throw Error('미확인 접수의 내용이 달라 자동 연결하지 않았습니다.');
     return NextResponse.json({meeting:original,recoveredOrder:receipt},{headers});
    }
   }
   const records=readMeetings(file);
   let m=typeof b.id==='string'?meeting(file,b.id):records.find(x=>x.employeeId===b.employeeId&&x.projectId===b.projectId&&(b.orderId===undefined||x.orderId===b.orderId));
   if(b.id&&(!m||m.employeeId!==b.employeeId||m.projectId!==b.projectId||m.orderId!==b.orderId))throw Error('요청한 면담과 보고의 직원·프로젝트·업무가 다릅니다. 기존 면담을 유지했습니다.');
   const conflict=records.find(x=>x.id!==m?.id&&x.employeeId===b.employeeId&&(x.pending||orders.some(o=>o.id===x.orderId&&['received','assigned','running','reviewing','building'].includes(o.stage))));
   if(conflict)throw Error('다른 업무의 면담 답변 또는 실행이 진행 중입니다. 기존 면담이 끝난 뒤 보고를 연결해주세요.');
   if(!m){m={id:randomUUID(),employeeId:b.employeeId,projectId:b.projectId,...(linked?{orderId:linked.id}:{}),messages:[],proposal:'',updatedAt:new Date().toISOString()};saveMeeting(file,m);}return NextResponse.json({meeting:m},{headers});
  }
  if(b.operation==='execute'){
   const m=typeof b.id==='string'?meeting(file,b.id):undefined;if(!m||m.projectId!==b.projectId)throw Error('면담 프로젝트를 확인하세요.');
   if(m.pending)throw Error('면담 답변 작성이 끝난 뒤 실행해주세요.');
   if(typeof b.instruction!=='string')throw Error('지시 내용을 입력하세요.');
   const existing=listOrders(c.db).find(o=>o.requestId===b.requestId);if(existing){if(m.orderId!==existing.id||existing.instruction!==b.instruction.trim()||(existing.projectId||'jarvis-board')!==m.projectId||(b.orderId!==existing.id&&b.orderId!==existing.parent?.id))throw Error('같은 요청 번호의 내용이 다릅니다.');return NextResponse.json({meeting:m,order:existing},{headers});}
   if(m.orderId!==b.orderId)throw Error('면담에 연결된 업무가 바뀌었습니다. 기존 입력을 유지하고 면담을 다시 확인해주세요.');
   const parent=m.orderId?orders.find(o=>o.id===m.orderId):undefined;
   if(m.orderId&&(!parent||(parent.projectId||'jarvis-board')!==m.projectId))throw Error('면담 업무와 프로젝트가 일치하지 않습니다.');
   if(parent&&(!parent.review||!['reported','failed'].includes(parent.stage)))throw Error('연결된 업무의 완료·검토 보고가 있어야 후속 수정을 배정할 수 있습니다.');
   const followup=parent?.review&&['reported','failed'].includes(parent.stage)?{parentId:parent.id,actionIndex:-2}:undefined;
   const result=createOrder(c.db,b.requestId,b.instruction,followup,'development',m.projectId);m.orderId=result.item.id;m.proposal='';m.updatedAt=new Date().toISOString();saveMeeting(file,m);if(result.created)after(()=>executeOrder(result.item));return NextResponse.json({meeting:m,order:result.item},{status:result.created?202:200,headers});
  }
  if(b.operation!=='ask'||typeof b.employeeId!=='string'||typeof b.question!=='string'||b.question.trim().length<2||b.question.length>1200||b.id!==undefined&&typeof b.id!=='string')throw Error('질문을 2~1200자로 입력하세요.');
  const previous=b.id?meeting(file,b.id):undefined;
  if((b.id&&!previous)||(previous&&(previous.employeeId!==b.employeeId||previous.projectId!==b.projectId||previous.orderId!==b.orderId))||(b.orderId&&!previous))throw Error('면담과 보고의 직원·프로젝트·업무가 다릅니다. 면담을 다시 열어주세요.');
  if(previous?.orderId){const source=orders.find(o=>o.id===previous.orderId);if(!source||(source.projectId||'jarvis-board')!==b.projectId)throw Error('면담 업무와 프로젝트가 일치하지 않습니다.');}
  const direct=meetingExecutionAnswer(b.question,orders.find(o=>o.id===previous?.orderId));
  if(direct){const input={...(b.id?{id:b.id}:{}),employeeId:b.employeeId,projectId:b.projectId as ProjectId,orderId:b.orderId,question:b.question.trim(),requestId:b.requestId};const turn=beginInterview(file,input,0);if(turn.created)finishInterview(file,turn.id,b.requestId,direct,0);return NextResponse.json({meeting:meeting(file,turn.id),source:'execution-receipt'},{headers});}
  const source=await listAutomationsSnapshot(),base=await buildCommandRoom(async()=>source),company=await loadCompany(base,source),employees=companyEmployees(base.employees??[],company);
  const employee=employees.find(e=>e.id===b.employeeId);
  if(!employee&&!['jarvis','owner-order-worker','owner-order-reviewer'].includes(b.employeeId))throw Error('등록된 직원을 선택하세요.');
  const facts={executionPlan:{developer:projectInfo(b.projectId).assignee,reviewer:'독립 코드 검토 담당 (별도 Codex 실행)',secretary:'자비스 · 검사·적용 근거를 종합해 주인님께 보고',trigger:'관련 담당 모아 수정·검토 실행 버튼',checks:projectInfo(b.projectId).checks,sourceCode:'이 면담은 소스 코드를 읽지 않음. 개발 담당이 실제 파일을 조사하여 수정함.'},employee:employee?{name:employee.name,role:employee.role,status:employee.status,task:employee.task,next:employee.next,observedAt:employee.observedAt}:b.employeeId,project:projectInfo(b.projectId),tasks:company.tasks.filter(t=>b.employeeId==='jarvis'||t.ownerId===b.employeeId).slice(0,4).map(t=>({title:t.title.slice(0,180),state:t.state,next:t.next.slice(0,300),observedAt:t.observedAt})),linkedOrderId:previous?.orderId,orders:(previous?.orderId?orders.filter(o=>o.id===previous.orderId):orders.filter(o=>(o.projectId||'jarvis-board')===b.projectId).slice(0,2)).map(o=>({id:o.id,stage:o.stage,goal:o.goal,summary:o.review?.summary.slice(0,600),error:o.error?.slice(0,300),applied:o.execution?.applied,changedFiles:o.execution?.files,reviewVerdict:o.review?.verdict,checks:o.execution?.checks,deployment:'실행기는 자동 배포하지 않음. 별도 운영 배포 상태는 이 원장에 연결되지 않음'})),history:previous?.messages.slice(-6).map(m=>({role:m.role,text:m.text.slice(0,600)})),question:b.question};
  const prompt=JSON.stringify(facts),reserve=Buffer.byteLength(prompt+interviewSystem)+1100;
  const input={...(b.id?{id:b.id}:{}),employeeId:b.employeeId,projectId:b.projectId as ProjectId,orderId:b.orderId,question:b.question.trim(),requestId:b.requestId};
  const turn=beginInterview(file,input,reserve);if(!turn.created)return NextResponse.json({meeting:meeting(file,turn.id)},{headers});
  let tokens:number|undefined;
  try{const raw=await callLLM(prompt,{model:process.env.JARVIS_INTERVIEW_MODEL||process.env.JARVIS_REVIEW_MODEL||'openai/gpt-oss-120b',reasoningEffort:'low',maxTokens:900,timeoutMs:40000,systemPrompt:interviewSystem,responseFormat:{type:'json_object'},temperature:.2,onUsage:u=>{tokens=u.totalTokens;}});const answer=validateMeetingAnswer(raw);answer.proposal=groundedMeetingProposal(b.question,answer.proposal);finishInterview(file,turn.id,b.requestId,answer,tokens);}
  catch(e){finishInterview(file,turn.id,b.requestId,{error:e instanceof LLMError&&e.status===429?'면담 AI 제공자 한도에 도달했습니다. 질문은 보존했습니다. 자동 재시도 없이 직접 지시할 수 있습니다.':e instanceof LLMError?`면담 제공자 연결 오류 (${e.status||'시간 초과'}). 질문은 보존했습니다. 직접 지시는 가능합니다.`:e instanceof Error?e.message:'면담 답변 형식 확인 필요'},e instanceof LLMError&&[400,401,403,404,429].includes(e.status||0)?0:tokens);}
  return NextResponse.json({meeting:meeting(file,turn.id)},{headers});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'면담 요청 실패'},{status:409,headers});}
}
