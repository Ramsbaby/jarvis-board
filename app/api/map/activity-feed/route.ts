export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { CRON_LOG, CIRCUIT_BREAKER_DIR } from '@/lib/jarvis-paths';

/**
 * 실시간 활동 피드 + 긴급 알림 트레이 데이터
 * - 최근 크론 실행 이력 (최대 20건)
 * - 현재 실패 중인 팀 목록 (RED 상태)
 * - 서킷브레이커 발동 태스크
 */

interface FeedItem {
  cronId: string;
  status: 'success' | 'failed' | 'skipped' | 'running';
  time: string;       // KST HH:mm
  timeIso: string;
  message: string;
}

interface AlertTeam {
  teamId: string;
  teamLabel: string;
  failCount: number;
  failingCronIds: string[];
  topError: string;
}

interface CircuitBroken {
  taskId: string;
  failures: number;
  state: string;
  lastFailureAt?: string;
}

function safeRead(file: string, maxBytes = 128_000): string {
  try {
    if (!existsSync(file)) return '';
    const buf = readFileSync(file, 'utf8');
    return buf.length > maxBytes ? buf.slice(-maxBytes) : buf;
  } catch { return ''; }
}

// cron.log 파싱 → 최근 20건 실행 이력
function parseFeed(cronLog: string, limit = 20): FeedItem[] {
  if (!cronLog) return [];
  const lines = cronLog.split('\n').filter(Boolean);
  const seen = new Map<string, FeedItem>();
  const result: FeedItem[] = [];

  for (let i = lines.length - 1; i >= 0 && result.length < limit * 3; i--) {
    const line = lines[i];
    const m = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[([^\]]+)\] (.+)$/);
    if (!m) continue;
    const [, ts, cronId, msg] = m;
    // task_N_ 패턴 제외 (내부 서브태스크)
    if (/^task_\d+_/.test(cronId)) continue;

    let status: FeedItem['status'] = 'running';
    if (/\bSUCCESS\b|\bDONE\b/.test(line)) status = 'success';
    else if (/FAILED|ERROR|CRITICAL/.test(line)) status = 'failed';
    else if (/SKIP|skipped/i.test(line)) status = 'skipped';
    else continue; // 중간 로그 라인은 제외, 완료/실패 라인만

    if (seen.has(cronId)) continue; // 같은 크론의 가장 최근 것만
    const item: FeedItem = {
      cronId,
      status,
      time: ts.slice(11, 16),
      timeIso: ts,
      message: msg.slice(0, 80),
    };
    seen.set(cronId, item);
    result.push(item);
  }
  return result.slice(0, limit);
}

// 팀별 키워드 → 최근 24h 실패 집계
const TEAM_KEYWORDS: Record<string, { label: string; keywords: string[] }> = {
  'infra-lead':   { label: 'SRE실',     keywords: ['infra', 'disk', 'monitor', 'watchdog', 'health'] },
  'finance':      { label: '재무실',    keywords: ['tqqq', 'trading', 'portfolio', 'preply', 'finance'] },
  'trend-lead':   { label: '전략기획실', keywords: ['trend', 'market', 'github', 'hacker'] },
  'record-lead':  { label: '데이터실',  keywords: ['rag', 'index', 'archive', 'record'] },
  'growth-lead':  { label: '성장팀',    keywords: ['career', 'academy', 'blog', 'growth'] },
  'secretary':    { label: '비서실',    keywords: ['secretary', 'standup', 'brief', 'skill-eval'] },
  'audit-lead':   { label: 'QA감사실',  keywords: ['audit', 'qa', 'check', 'e2e'] },
  'president':    { label: '대표실',    keywords: ['president', 'report', 'digest'] },
};

function detectAlertTeams(cronLog: string): AlertTeam[] {
  if (!cronLog) return [];
  const cutoffMs = Date.now() - 24 * 3600_000;
  const lines = cronLog.split('\n').filter(Boolean).slice(-3000);
  const failMap = new Map<string, { time: string; msg: string }>();

  for (const line of lines) {
    if (!/FAILED|ERROR|CRITICAL/.test(line)) continue;
    const m = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[([^\]]+)\] (.+)$/);
    if (!m) continue;
    const [, ts, cronId, msg] = m;
    if (/^task_\d+_/.test(cronId)) continue;
    const tsMs = Date.parse(ts + '+09:00');
    if (!isNaN(tsMs) && tsMs < cutoffMs) continue;
    failMap.set(cronId, { time: ts, msg: msg.slice(0, 120) });
  }

  const alerts: AlertTeam[] = [];
  for (const [teamId, { label, keywords }] of Object.entries(TEAM_KEYWORDS)) {
    const kwLower = keywords.map(k => k.toLowerCase());
    const teamFails = Array.from(failMap.entries())
      .filter(([cid]) => kwLower.some(kw => cid.toLowerCase().includes(kw)));
    if (teamFails.length === 0) continue;
    alerts.push({
      teamId,
      teamLabel: label,
      failCount: teamFails.length,
      failingCronIds: teamFails.map(([id]) => id).slice(0, 5),
      topError: teamFails[0]?.[1].msg ?? '',
    });
  }
  return alerts.sort((a, b) => b.failCount - a.failCount);
}

function detectCircuitBreakers(): CircuitBroken[] {
  if (!existsSync(CIRCUIT_BREAKER_DIR)) return [];
  try {
    const files = readdirSync(CIRCUIT_BREAKER_DIR).filter(f => f.endsWith('.json'));
    const broken: CircuitBroken[] = [];
    for (const f of files) {
      try {
        const data = JSON.parse(readFileSync(path.join(CIRCUIT_BREAKER_DIR, f), 'utf8')) as {
          failures?: number; state?: string; lastFailureAt?: string;
        };
        if ((data.failures || 0) >= 3) {
          broken.push({
            taskId: f.replace('.json', ''),
            failures: data.failures || 0,
            state: data.state || 'unknown',
            lastFailureAt: data.lastFailureAt,
          });
        }
      } catch { /* skip */ }
    }
    return broken.sort((a, b) => b.failures - a.failures).slice(0, 10);
  } catch { return []; }
}

export async function GET() {
  const cronLog = safeRead(CRON_LOG);
  const feed = parseFeed(cronLog, 20);
  const alertTeams = detectAlertTeams(cronLog);
  const circuitBreakers = detectCircuitBreakers();

  return NextResponse.json({
    feed,
    alertTeams,
    circuitBreakers,
    generatedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
