export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import type { CronItem } from '@/lib/map/rooms';
import { TEAM_REGISTRY } from '@/lib/map/team-registry';
import { MAP_CACHE_TTL_MS } from '@/lib/cache-config';
import { listAutomations, toCronItem } from '@/lib/openclaw-automations';

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

// ── 팀 분류 (SSoT: TEAM_REGISTRY) ──────────────────────────────
// 매칭 우선순위: finance → library 를 record 보다 먼저 시도해야 키워드 겹침 방지
const TEAM_CLASSIFY_ORDER = [
  'finance', 'infra-lead', 'trend-lead',
  'library', 'record-lead',
  'growth-lead', 'brand-lead', 'audit-lead',
  'secretary', 'standup', 'dev-queue', 'president',
] as const;

function classifyTeam(name: string): { label: string; emoji: string } {
  // 이관 후 job 이름 대부분이 'jarvis-' / 'openclaw-' 접두사를 단다.
  // 접두사는 팀 정보가 아니므로 떼고 분류한다 ('openclaw' 는 마케팅실 키워드와 겹친다).
  const lower = name.toLowerCase().replace(/^(jarvis|openclaw)-/, '');
  for (const key of TEAM_CLASSIFY_ORDER) {
    const entry = TEAM_REGISTRY[key];
    if (!entry) continue;
    if (entry.keywords.some(kw => lower.includes(kw))) {
      const label = entry.name.includes(' · ') ? entry.name.split(' · ')[0] : entry.name;
      const emoji = entry.avatar || entry.icon || '❓';
      return { label, emoji };
    }
  }
  return { label: '미분류', emoji: '❓' };
}

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
    .map(j => toCronItem(j, classifyTeam(j.name)))
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
