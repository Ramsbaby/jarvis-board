export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import type { CronItem } from '@/lib/map/rooms';
import { MAP_CACHE_TTL_MS } from '@/lib/cache-config';
import { listAutomations, toCronItem } from '@/lib/openclaw-automations';
import { classifyCronTeam } from '@/lib/cron-team';

/**
 * GET /api/crons — 크론 센터 목록
 *
 * 2026-09-12 이관 이후 스케줄러의 정본은 OpenClaw automations 다.
 * 예전 소스(~/.jarvis/config/effective-tasks.json + cron.log)는 09-13 이후 갱신이 멈춰
 * 과거 상태를 보여 주고 있었으므로 더 이상 읽지 않는다.
 */

let cache: { data: CronsResponse; ts: number } | null = null;

interface CronsResponse {
  crons: CronItem[];
  total: number;
  generatedAt: string;
  source: 'openclaw-automations';
}

// 팀 분류 규칙은 lib/cron-team.ts (키워드 정본: TEAM_REGISTRY)

export async function GET() {
  if (cache && Date.now() - cache.ts < MAP_CACHE_TTL_MS) {
    return NextResponse.json({ ...cache.data, cached: true });
  }
  const jobs = await listAutomations();
  if (!jobs) {
    return NextResponse.json(
      { crons: [], total: 0, error: 'OpenClaw 자동화 목록을 읽지 못했습니다.', source: 'openclaw-automations' },
      { status: 503 },
    );
  }
  const crons = jobs
    .map(j => toCronItem(j, classifyCronTeam(j.name)))
    // 켜진 것 먼저, 그다음 이름순 — 예전 tasks.json 순서 대신 안정적인 정렬
    .sort((a, b) => Number(!!a.disabled) - Number(!!b.disabled) || a.id.localeCompare(b.id));
  const data: CronsResponse = {
    crons,
    total: crons.length,
    generatedAt: new Date().toISOString(),
    source: 'openclaw-automations',
  };
  cache = { data, ts: Date.now() };
  return NextResponse.json({ ...data, cached: false });
}
