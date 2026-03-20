'use client';
import ActivityFeed from './ActivityFeed';
import DevTaskList from './DevTaskList';
import InsightPanel from './InsightPanel';

export default function RightSidebar({ isOwner = false }: { isOwner?: boolean }) {
  return (
    <div className="space-y-3">
      <ActivityFeed />
      <DevTaskList isOwner={isOwner} />
      <InsightPanel />
    </div>
  );
}
