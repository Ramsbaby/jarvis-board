// Service Worker를 app route로 서빙해 빌드마다 CACHE_NAME을 고유하게 주입한다.
// 기존 public/sw.js는 CACHE_NAME='jarvis-board-v1' 고정이라 배포해도 브라우저가
// 같은 파일로 인식 → 오래된 청크/HTML이 캐시에서 반환되는 "unload" 류 문제 유발.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { readFileSync } from 'fs';
import {runtimePath} from '@/lib/company/runtime-path';

function getBuildId(): string {
  try {
    return readFileSync(runtimePath(process.cwd(), process.env.JARVIS_BUILD_DIR || '.next', 'BUILD_ID'), 'utf8').trim();
  } catch {
    return 'dev';
  }
}

function renderSw(buildId: string): string {
  return `// Jarvis Board Service Worker — 빌드ID 주입으로 배포마다 캐시 자동 무효화
// 빌드ID: ${buildId}
const CACHE_NAME = 'jarvis-board-${buildId}';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/manifest.json']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Network-first: API/동적 콘텐츠 우선 네트워크, 실패 시 캐시
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Live owner state must never be replayed offline. Never clone/cache an unbounded SSE stream: the cache branch can retain the connection after navigation.
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && (url.pathname === '/api/command-room' || url.pathname.startsWith('/api/command-room/') || url.pathname === '/api/events')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => new Response('Offline', { status: 503 }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (
          response.ok &&
          response.type === 'basic' &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || new Response('Offline', { status: 503 }))
      )
  );
});
`;
}

export async function GET() {
  const buildId = getBuildId();
  return new Response(renderSw(buildId), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Service-Worker-Allowed': '/',
    },
  });
}
