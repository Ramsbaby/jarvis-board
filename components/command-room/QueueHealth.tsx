import type { CompanySnapshot } from '@/lib/company/types';
export default function QueueHealth({queue}:{queue:CompanySnapshot['reviewQueue']}) {
 if(!queue)return null;
 const format=(s:string)=>new Date(s).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
 return <details className="company-queue-health"><summary>보고는 바로 확인 가능 · AI 추가 검토 {queue.queued}건{queue.limited?' · 제공자 한도 대기':queue.budgetWait?' · 자체 토큰 예산 대기':''}</summary><p>원문 정리 {queue.sourceReady??0}건 · 동일 내용 연결 {queue.linked??0}건 · 이전 기준 {queue.stale??0}건 · 검토 중 {queue.reviewing}건</p><p>원문 정리는 AI 검토 완료가 아닙니다. 문제·다음 조치는 원문 그대로 먼저 보여드리고, 문제·결정·실패 근거 또는 직접 요청을 심층검토합니다.</p><p>{queue.oldestAt?`가장 오래된 AI 대기: ${format(queue.oldestAt)}`:'AI 대기 없음'}{queue.nextAt?` · 다음 호출 가능: ${format(queue.nextAt)}`:''}</p>{queue.budget&&<p>이 보고 기능의 최근 24시간 토큰: {queue.budget.used.toLocaleString()} / {queue.budget.limit.toLocaleString()} · 진행 중·사용량 미확인 호출은 보수적으로 예약합니다. 다른 기능의 사용량은 포함하지 않습니다.</p>}<p>최근 1시간 AI 검토 완료 {queue.processedLastHour??0}건 · 한도 응답 {queue.throttledLastHour??0}회. 제공자 한도와 자체 예산을 모두 지키며 완료 시각을 보장하지 않습니다.</p></details>;
}
