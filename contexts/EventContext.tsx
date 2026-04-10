'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface BoardEventData {
  id?: string;
  title?: string;
  author?: string;
  author_display?: string;
  content?: string;
  is_resolution?: number;
  status?: string;
  task?: Record<string, unknown>;
  comment_id?: string;
  consensus_summary?: string;
  paused?: boolean;
  expires_at?: string;
  agent?: string;
  extra_ms?: number;
  restarted_at?: string | null;
  [key: string]: unknown;
}

export interface BoardEvent {
  type: string;
  post_id?: string;
  data?: BoardEventData;
}

export type Listener = (ev: BoardEvent) => void;

interface EventContextValue {
  connected: boolean;
  disconnected: boolean;
  subscribe: (fn: Listener) => () => void;
  reconnect: () => void;
  notifPermission: NotifPermission;
  requestNotifPermission: () => Promise<void>;
}

const EventContext = createContext<EventContextValue>({
  connected: false,
  disconnected: false,
  subscribe: () => () => {},
  reconnect: () => {},
  notifPermission: 'unsupported',
  requestNotifPermission: async () => {},
});

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotifPermission>('unsupported');
  const listenersRef = useRef<Set<Listener>>(new Set());
  const retryRef = useRef(1000);
  const retryCountRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const destroyedRef = useRef(false);
  const connectFnRef = useRef<(() => void) | null>(null);
  const pathname = usePathname();

  const shouldSkipSSE = pathname === '/login' || pathname.startsWith('/agents');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifPermission(Notification.permission as NotifPermission);
    }
  }, []);

  const requestNotifPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result as NotifPermission);
  }, []);

  useEffect(() => {
    if (shouldSkipSSE) {
      esRef.current?.close();
      esRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnected(false);
       
      setDisconnected(false);
      return;
    }

    destroyedRef.current = false;
    function connect() {
      if (destroyedRef.current) return;
      const es = new EventSource('/api/events');
      esRef.current = es;
      es.onopen = () => {
        setConnected(true);
        setDisconnected(false);
        retryRef.current = 1000;
        retryCountRef.current = 0;
      };
      es.onerror = () => {
        setConnected(false);
        es.close();
        retryCountRef.current += 1;
        if (retryCountRef.current >= 5) {
          setDisconnected(true);
          return; // stop auto-retry after 5 failures
        }
        retryRef.current = Math.min(retryRef.current * 2, 30000);
        if (!destroyedRef.current) setTimeout(connect, retryRef.current + Math.random() * 1000);
      };
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          listenersRef.current.forEach(fn => fn(ev));

          // 페이지가 백그라운드일 때만 브라우저 알림 발송
          if (typeof document !== 'undefined' && document.hidden && Notification.permission === 'granted') {
            if (ev.type === 'new_post') {
              new Notification('📋 새 토론', {
                body: ev.data?.title ?? '새 포스트가 등록되었습니다.',
                tag: `post-${ev.data?.id}`,
              });
            } else if (ev.type === 'new_comment') {
              const author = ev.data?.author_display ?? '누군가';
              const body = (ev.data?.content ?? '').slice(0, 80);
              new Notification(`💬 ${author}`, {
                body: body || '새 댓글이 달렸습니다.',
                tag: `comment-${ev.data?.id}`,
              });
            }
          }
        } catch {}
      };
    }
    connectFnRef.current = connect;
    connect();
    return () => { destroyedRef.current = true; esRef.current?.close(); };
  }, [shouldSkipSSE]);

  const reconnect = useCallback(() => {
    esRef.current?.close();
    retryRef.current = 1000;
    retryCountRef.current = 0;
    setDisconnected(false);
    destroyedRef.current = false;
    connectFnRef.current?.();
  }, []);

  const subscribe = useCallback((fn: Listener) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  return (
    <EventContext.Provider value={{ connected, disconnected, subscribe, reconnect, notifPermission, requestNotifPermission }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() { return useContext(EventContext); }
