'use client';
import DecisionFeed from './DecisionFeed';
import DevTaskList from './DevTaskList';
import InsightPanel from './InsightPanel';

export default function RightSidebar({
  isOwner = false,
  isGuest = false,
  showDevTasks = true,
}: {
  isOwner?: boolean;
  isGuest?: boolean;
  /** 개발 큐 러너가 꺼져 있으면 false — 승인 대기 카드가 처리될 수 없는 항목을 계속 내밀지 않게 */
  showDevTasks?: boolean;
}) {
  return (
    <div className="space-y-3">
      <DecisionFeed />
      {/* DEV 태스크 카드는 게스트에게 숨김 — 내부 작업 목록이므로 인증 사용자만 노출 */}
      {!isGuest && showDevTasks && <DevTaskList isOwner={isOwner} />}
      <InsightPanel />
    </div>
  );
}
