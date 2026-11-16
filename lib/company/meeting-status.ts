import type {OwnerOrder} from './orders';
import {ORDER_LABELS,orderNextAction} from './order-presentation';
/** Explicit status questions use the linked receipt, not a second model interpretation. */
export function meetingExecutionAnswer(question:string,order:OwnerOrder|undefined){
 if(!order||/추가해|수정해|만들어|구현해|개선해|바꿔|고쳐|배포해/.test(question)||!/배포|외부.{0,8}반영|끝났|완료.{0,8}(됐|되|했)|어디까지|진행\s*상황|적용.{0,6}(됐|되)|검토.{0,10}(결과|판정)|무엇을\s*고쳤|다음.{0,10}(무엇|뭘|행동|결정)|내가.{0,8}(결정|할\s*일)/.test(question))return null;
 const applied=order.execution?.applied===true,reviewed=order.review?.verdict==='accepted',checks=order.execution?.checks||[];
 const facts=[order.execution?.files.length?`수정 파일 ${order.execution.files.length}개`:'수정 파일 제출 전',reviewed?'독립 코드 검토 통과':order.review?'독립 검토에서 추가 확인 요청':'독립 검토 완료 전',checks.length?`기록된 검사 ${checks.length}항목 통과`:'실행 검사 완료 기록 없음',applied?'로컬 소스 적용 완료':'로컬 소스 적용 전'];
 const next=order.stage==='reported'?'실제 화면에서 요청한 동작을 확인하고 추가 변경이 필요하면 아래에서 이어서 지시해주세요.':order.error?`중단 원인: ${/다른 작업이 원본을 변경/.test(order.error)?'다른 수정과 겹쳐 적용을 멈췄습니다. 수정안은 보존되어 있습니다.':order.error}\n다음 조치: ${orderNextAction(order)}`:'같은 업무의 실행 상태를 확인하고 있습니다. 추가 지시는 현재 업무가 끝난 뒤 배정할 수 있습니다.';
 return {answer:`“${order.goal}” 업무는 ${ORDER_LABELS[order.stage]} 상태입니다.\n${facts.join(' · ')}.\n${next}\n외부 반영: ${order.deployment?.label||'확인 기록 없음'}${order.deployment?.verifiedAt?' · 확인 시각 '+new Date(order.deployment.verifiedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):''}. ${order.deployment?.detail||'배포 검증 근거가 없어 외부 반영을 확정하지 않습니다.'}`,proposal:''};
}
