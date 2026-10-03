export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { listAutomations, nextRunAtMs, toKstString } from '@/lib/openclaw-automations';

/**
 * 앞으로 24시간 안에 실행될 자동화 (가장 가까운 6개)
 *
 * 소스: OpenClaw automations 의 nextRunAtMs (스케줄러가 직접 계산한 값).
 * 예전에는 ~/.jarvis/config/effective-tasks.json 의 cron 식을 직접 풀었는데,
 * 그 파일은 2026-09-13 이후 갱신이 멈췄다.
 * 한 시간에 한 번 이상 도는 반복 작업은 '예정'으로서 정보가 없으므로 제외한다.
 */

interface UpcomingItem {
  id: string;
  name: string;
  nextRun: string;       // ISO
  minutesUntil: number;
  priority: string;
  humanTime: string;     // "15:30" 형식 (KST)
}

const HOURLY_MS = 60 * 60_000;

/** 한 시간에 한 번 이상 도는 반복 작업 — '오늘 예정'으로 보여 줄 정보가 없다. */
function isHighFrequency(expr: string | undefined, everyMs: number | undefined): boolean {
  if (typeof everyMs === 'number') return everyMs <= HOURLY_MS;
  if (!expr) return false;
  const hour = expr.trim().split(/\s+/)[1] ?? '';
  return hour === '*' || hour.startsWith('*/');
}

let cache: { data: { upcoming: UpcomingItem[]; total: number; source: string }; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }
  const jobs = await listAutomations();
  if (!jobs) {
    return NextResponse.json({ error: 'OpenClaw 자동화 목록을 읽지 못했습니다.', upcoming: [] }, { status: 503 });
  }
  const now = Date.now();
  const items: UpcomingItem[] = [];
  for (const j of jobs) {
    if (!j.enabled) continue;
    if (isHighFrequency(j.schedule?.expr, j.schedule?.everyMs)) continue;
    const next = nextRunAtMs(j);
    if (!next) continue;
    const minutesUntil = Math.round((next - now) / 60_000);
    if (minutesUntil < 0 || minutesUntil > 24 * 60) continue;
    items.push({
      id: j.name,
      name: j.displayName || j.name,
      nextRun: new Date(next).toISOString(),
      minutesUntil,
      priority: 'normal',
      humanTime: toKstString(next).slice(11, 16),
    });
  }
  items.sort((a, b) => a.minutesUntil - b.minutesUntil);
  const data = { upcoming: items.slice(0, 6), total: items.length, source: 'openclaw-automations' };
  cache = { data, ts: Date.now() };
  return NextResponse.json(data);
}
