'use client';
import DeploymentBadge from './DeploymentBadge';
import {PROJECTS} from '@/lib/company/projects';
import type {OwnerOrder} from '@/lib/company/orders';
import {ORDER_LABELS,orderNextAction} from '@/lib/company/order-presentation';
import type {CompanyTask,CompanyIssue,CompanyReport} from '@/lib/company/types';
import {readableText,workTitle,reportSummary} from '@/lib/company/display';

type Props={onDiscuss:(orderId:string)=>void;taskOwner?:(task:CompanyTask)=>string;onOrder:(id?:string)=>void;latestOrder?:OwnerOrder;ready:boolean;active:CompanyTask[];issues:CompanyIssue[];tasks:CompanyTask[];reports:CompanyReport[];onTask:(task:CompanyTask)=>void;onReport:(report:CompanyReport)=>void};
export default function JarvisBrief({onDiscuss,ready,active,issues,tasks,reports,latestOrder,onOrder,onTask,onReport,taskOwner}:Props){
 const decision=tasks.find(t=>t.state==='decision'&&!t.archived);
 const problem=decision?undefined:issues.find(i=>i.state!=='recovered'&&i.state!=='grouped'&&i.triage?.category==='current');
 const problemTask=tasks.find(t=>t.id===(problem?problem.taskId:undefined));
 const reportTaskId=decision?.id||problem?.taskId;
 const reportOrderId=reportTaskId?(reportTaskId.startsWith('order:')?reportTaskId.slice(6):undefined):latestOrder?.id;
 const pending=!!latestOrder&&['received','assigned','running','reviewing','building'].includes(latestOrder.stage);
 const sameProblem=!!problem&&problem.taskId==='order:'+latestOrder?.id;
 const current=active.find(t=>t.id!=='order:'+latestOrder?.id&&t.id!==problem?.taskId);
 const oldProblems=issues.filter(i=>i.state!=='recovered'&&i.state!=='grouped'&&i!==problem);
 const orderCard=latestOrder&&<article className="brief-order"><h3>{pending?'담당자가 처리 중':latestOrder.stage==='failed'?'수정 지시가 필요한 업무':'맡기신 업무의 결과가 나왔습니다'}</h3><small>{PROJECTS[latestOrder.projectId||'jarvis-board'].name} · {latestOrder.assignee}</small><strong className="brief-goal">{latestOrder.goal.length>100?latestOrder.goal.slice(0,100)+'…':latestOrder.goal}</strong>{latestOrder.goal.length>100&&<details><summary>받은 지시 전문</summary><p>{latestOrder.goal}</p></details>}<DeploymentBadge order={latestOrder}/><label>{pending?'지금 하는 일':latestOrder.stage==='failed'?'막힌 문제':'처리 결과'}</label><p className="brief-result-summary">{latestOrder.stage==='reported'?reportSummary(latestOrder.review?.summary||ORDER_LABELS[latestOrder.stage]):ORDER_LABELS[latestOrder.stage]}</p>{latestOrder.review?.summary&&<details className="brief-full-report"><summary>검토 보고 전체 읽기</summary><p>{readableText(latestOrder.review.summary)}</p></details>}{latestOrder.execution?.progress&&pending&&<p role="status">{readableText(latestOrder.execution.progress)}</p>}{latestOrder.error&&<details className="brief-error"><summary>막힌 이유 확인</summary><p>{readableText(latestOrder.error)}</p></details>}<p className="brief-next"><b>주인님의 다음 행동</b> {orderNextAction(latestOrder)}</p><button className="company-primary" onClick={()=>onDiscuss(latestOrder.id)}>이 업무에 질문·후속 수정 지시</button><button className="jarvis-order-link" onClick={()=>onOrder(latestOrder.id)}>{pending?'진행 확인·실행 중단 →':latestOrder.stage==='failed'?'실패 근거·수정 지시 →':'결과 확인·다음 지시 →'}</button></article>;
 return <section className="jarvis-owner-brief" aria-label="자비스의 핵심 보고"><span className="company-state">총괄비서 자비스</span><h2>주인님께 드리는 보고</h2>{!ready?<p role="status">실제 업무 기록을 확인하고 있습니다.</p>:<>
 {decision&&<article className="brief-priority"><h3>주인님 결정이 필요합니다</h3><strong className="brief-goal">{workTitle(decision.title,decision.summary)}</strong><small>담당: {taskOwner?.(decision)||'담당 확인 필요'}</small><p>{readableText(decision.summary)}</p><p className="brief-next"><b>다음 행동</b>{readableText(decision.next)}</p><button className="jarvis-order-link" onClick={()=>onTask(decision)}>근거·선택지 확인 →</button></article>}
 {problem&&<article className="brief-priority"><h3>먼저 해결할 문제</h3><strong className="brief-goal">{workTitle(problemTask?.title||problem.title,problemTask?.summary||problem.title)}</strong><small>담당: {problemTask?taskOwner?.(problemTask)||'담당 확인 필요':'연결 확인 필요'}</small><p>{readableText(sameProblem?(latestOrder?.review?.summary||latestOrder?.error||problem.impact):problem.impact)}</p><p className="brief-next"><b>다음 행동</b> {readableText((sameProblem?latestOrder?.review?.actions?.[0]:undefined)||problem.triage?.next||problem.next||problemTask?.next||'원본 근거를 확인하고 수정 범위를 정하세요.')}</p>{problemTask?<button className="jarvis-order-link" onClick={()=>onTask(problemTask)}>실패 근거·수정 지시 →</button>:problem.taskId.startsWith('order:')?<button className="jarvis-order-link" onClick={()=>onOrder(problem.taskId.slice(6))}>실패 근거·수정 지시 →</button>:<p>연결된 업무 상세가 없습니다. 원본 연결을 먼저 확인해야 합니다.</p>}</article>}
 {!sameProblem&&(pending||latestOrder?.stage==='failed')&&orderCard}
 {!decision&&!problem&&latestOrder?.stage==='reported'&&orderCard}
 {current&&<details><summary>그밖에 진행 중인 일</summary><strong>{workTitle(current.title,current.summary)}</strong><p>{readableText(current.summary)}</p><button className="company-primary" onClick={()=>onTask(current)}>담당·실행 상황 확인</button></details>}
 {!decision&&!problem&&!pending&&!latestOrder&&<p className="brief-clear">현재 개입이 필요한 것으로 분류된 문제가 없습니다. 미확인 기록까지 정상이라는 뜻은 아닙니다.</p>}
 {latestOrder&&!pending&&latestOrder.stage!=='failed'&&(!!decision||!!problem)&&<details className="brief-completed"><summary>도착한 결과 · {ORDER_LABELS[latestOrder.stage]}</summary>{orderCard}</details>}
 {(!latestOrder||decision||problem)&&<button className="company-primary" disabled={!reportOrderId} onClick={()=>{if(reportOrderId)onDiscuss(reportOrderId);}}>이 보고에 질문·수정 지시하기</button>}{!reportOrderId&&<p>이 보고에 연결된 실행 업무가 없어 면담을 연결할 수 없습니다. 업무 근거를 먼저 확인해주세요.</p>}<button className="company-primary brief-new-order" onClick={()=>onOrder()}>새 업무 지시<small>원하는 결과와 완료 조건을 알려주세요</small></button>
 {!!oldProblems.length&&<details><summary>다른 문제·과거 기록 ({oldProblems.length})</summary>{oldProblems.slice(0,8).map(i=>{const task=tasks.find(t=>t.id===i.taskId);return <div key={i.id}><p>{i.triage?.category==='current'?'현재 문제':i.triage?.category==='history'?'과거 기록':'현재 상태 확인 필요'} · {workTitle(task?.title||i.title,task?.summary||i.title)}</p>{task&&<button className="company-mini" onClick={()=>onTask(task)}>근거와 다음 행동 확인</button>}</div>;})}</details>}
 <details><summary>이전 결과 보고</summary>{reports.filter(r=>r.taskId!=='order:'+latestOrder?.id).slice(0,8).map(r=><button className="company-mini" key={r.id} onClick={()=>onReport(r)}>{workTitle(r.title,r.assessment?.summary||r.summary)}</button>)}</details>
 </>}</section>;
}
