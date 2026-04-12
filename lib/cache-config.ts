/**
 * Cache TTL SSoT — 캐시 만료 시간을 환경변수로 통일
 *
 * 모든 캐시 만료값은 이 파일에서 읽어온다. 각 API가 각자 상수를 정의하던
 * 기존 방식을 대체한다.
 *
 * 환경변수로 덮어쓰기 가능 (단위: 밀리초):
 *   CHAT_CONTEXT_TTL_MS   게임 채팅 컨텍스트 캐시 (기본 60s)
 *   STATS_CACHE_TTL_MS    /api/stats 캐시 (기본 30s)
 *   BRIEFING_CACHE_TTL_MS /api/entity/[id]/briefing 캐시 (기본 15s)
 */

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const CHAT_CONTEXT_TTL_MS = readIntEnv('CHAT_CONTEXT_TTL_MS', 60_000);
export const STATS_CACHE_TTL_MS = readIntEnv('STATS_CACHE_TTL_MS', 30_000);
export const BRIEFING_CACHE_TTL_MS = readIntEnv('BRIEFING_CACHE_TTL_MS', 15_000);
