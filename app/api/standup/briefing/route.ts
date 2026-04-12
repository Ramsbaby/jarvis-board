export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { MAP_CACHE_TTL_MS } from '@/lib/cache-config';

/**
 * 스탠드업홀(standup) 브리핑 — 매일 09:15 KST 전사 모닝 브리핑
 *
 * 데이터 소스:
 *  - morning-standup / daily-summary / personal-schedule-daily 크론 실행 결과
 *  - ~/.jarvis/state/context/morning-standup.md (마지막 스탠드업 결과 파일)
 *
 * 인프라팀(태스크 #1)의 lib/map/rooms.ts 에서 standup 방의 entityId를
 * 이 엔드포인트로 매핑한다(해당 작업은 Wave 1 마지막에 함께 반영).
 */

const HOME = homedir();
const JARVIS = path.join(HOME, '.jarvis');
const CRON_LOG = path.join(JARVIS, 'logs', 'cron.log');
const STANDUP_CONTEXT_FILE = path.join(JARVIS, 'state', 'context', 'morning-standup.md');

const STANDUP_KEYWORDS = ['morning-standup', 'daily-summary', 'personal-schedule-daily'];

interface CronEntry { time: string; task: string; result: string; message: string }

function readSafe(p: string): string {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}

function parseRecent(keywords: string[], limit: number): CronEntry[] {
  const raw = readSafe(CRON_LOG);
  if (!raw) return [];
  const LOG_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[([^\]]+)\] (.+)$/;
  const lines = raw.split('\n').filter(Boolean).slice(-3000);
  const entries: CronEntry[] = [];
  for (const line of lines) {
    const m = line.match(LOG_RE);
    if (!m) continue;
    const [, ts, task, msg] = m;
    if (/^task_\d+_/.test(task)) continue;
    const lower = task.toLowerCase();
    if (!keywords.some(kw => lower.includes(kw))) continue;
    let result = 'unknown';
    if (/\bDONE\b|\bSUCCESS\b/.test(line)) result = 'SUCCESS';
    else if (/FAILED|ERROR|CRITICAL/.test(line)) result = 'FAILED';
    else if (/\bSKIPPED\b/.test(line)) result = 'SKIPPED';
    else if (/\bSTARTED?\b|\bRUNNING\b/.test(line)) result = 'RUNNING';
    if (result !== 'unknown') entries.push({ time: ts, task, result, message: msg.slice(0, 120) });
  }
  return entries.reverse().slice(0, limit);
}

function getLatestStandupContent(): string | null {
  try {
    if (!existsSync(STANDUP_CONTEXT_FILE)) return null;
    const content = readFileSync(STANDUP_CONTEXT_FILE, 'utf8');
    return content.slice(0, 1200);
  } catch { return null; }
}

// ── Route Handler ────────────────────────────────────────────────────────────

interface StandupBriefing {
  type: 'standup';
  id: 'standup';
  name: string;
  title: string;
  avatar: string;
  summary: string;
  recentActivity: CronEntry[];
  latestStandup: string | null;
  updatedAt: string;
}

let cache: { data: StandupBriefing; ts: number } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.ts < MAP_CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  const recent = parseRecent(STANDUP_KEYWORDS, 10);
  const latest = getLatestStandupContent();

  const successCount = recent.filter(r => r.result === 'SUCCESS').length;
  const failedCount = recent.filter(r => r.result === 'FAILED').length;
  const summary = recent.length === 0
    ? '오늘은 아직 스탠드업 실행 이력이 없어요.'
    : failedCount === 0
      ? `오늘 모닝 스탠드업 포함 ${successCount}건이 정상 전송됐어요.`
      : `스탠드업 관련 이벤트 ${recent.length}건 중 ${failedCount}건에서 문제가 있었어요.`;

  const data: StandupBriefing = {
    type: 'standup',
    id: 'standup',
    name: '스탠드업홀',
    title: '매일 09:15 KST 전사 모닝 브리핑',
    avatar: '🎤',
    summary,
    recentActivity: recent,
    latestStandup: latest,
    updatedAt: new Date().toISOString(),
  };

  cache = { data, ts: Date.now() };
  return NextResponse.json(data);
}
