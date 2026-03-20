'use client';
import { useEvent } from '@/contexts/EventContext';

export default function NotificationPrompt() {
  const { notifPermission, requestNotifPermission } = useEvent();

  if (notifPermission !== 'default') return null;

  return (
    <button
      onClick={requestNotifPermission}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-colors"
      title="새 토론 · 댓글 알림 받기"
    >
      🔔 <span className="hidden sm:inline">알림</span>
    </button>
  );
}
