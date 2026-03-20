'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

type Listener = (ev: any) => void;
interface EventContextValue {
  connected: boolean;
  subscribe: (fn: Listener) => () => void;
}
const EventContext = createContext<EventContextValue>({ connected: false, subscribe: () => () => {} });

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const retryRef = useRef(1000);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let destroyed = false;
    function connect() {
      if (destroyed) return;
      const es = new EventSource('/api/events');
      esRef.current = es;
      es.onopen = () => { setConnected(true); retryRef.current = 1000; };
      es.onerror = () => {
        setConnected(false);
        es.close();
        if (!destroyed) setTimeout(connect, retryRef.current);
        retryRef.current = Math.min(retryRef.current * 2, 30000);
      };
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          listenersRef.current.forEach(fn => fn(ev));
        } catch {}
      };
    }
    connect();
    return () => { destroyed = true; esRef.current?.close(); };
  }, []);

  const subscribe = useCallback((fn: Listener) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  return <EventContext.Provider value={{ connected, subscribe }}>{children}</EventContext.Provider>;
}

export function useEvent() { return useContext(EventContext); }
