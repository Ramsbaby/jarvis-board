export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import {
  listAutomations, lastRunAtMs, runStatus, lastMessage, toKstString, type AutomationJob,
} from '@/lib/openclaw-automations';

/**
 * 실시간 활동 피드 + 긴급 알림 트레이 데이터
 * - 최근 24시간 자동화 실행 (최대 20건, 자동화별 최신 1건)
 * - 최근 24시간 실패 중인 팀 목록 (RED 상태)
 * - 연속 실패 3회 이상 자동화 (예전 서킷브레이커 자리)
 *
 * 소스: OpenClaw automations (2026-09-12 이관 후 정본).
 * 예전 cron.log 는 09-10 이후 거의 기록되지 않아, 시간 제한 없이 읽으면
 * 3주 전 실패가 '최근 실행 ❌'로 계속 떠 있었다.
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

const WINDOW_MS = 24 * 3600_000;

function recentRuns(jobs: AutomationJob[]): AutomationJob[] {
  const cutoff = Date.now() - WINDOW_MS;
  return jobs
    .filter(j => (lastRunAtMs(j) ?? 0) >= cutoff)
    .sort((a, b) => (lastRunAtMs(b) ?? 0) - (lastRunAtMs(a) ?? 0));
}

function buildFeed(recent: AutomationJob[], limit = 20): FeedItem[] {
  const out: FeedItem[] = [];
  for (const j of recent) {
    const st = runStatus(j);
    if (st === 'unknown') continue;
    const ts = toKstString(lastRunAtMs(j)!);
    out.push({
      cronId: j.name,
      status: st,
      time: ts.slice(11, 16),
      timeIso: ts,
      message: lastMessage(j).slice(0, 80),
    });
    if (out.length >= limit) break;
  }
  return out;
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

function detectAlertTeams(recent: AutomationJob[]): AlertTeam[] {
  const fails = recent.filter(j => j.enabled && runStatus(j) === 'failed');
  if (fails.length === 0) return [];
  const alerts: AlertTeam[] = [];
  for (const [teamId, { label, keywords }] of Object.entries(TEAM_KEYWORDS)) {
    const teamFails = fails.filter(j => {
      const n = j.name.toLowerCase().replace(/^(jarvis|openclaw)-/, '');
      return keywords.some(kw => n.includes(kw));
    });
    if (teamFails.length === 0) continue;
    alerts.push({
      teamId,
      teamLabel: label,
      failCount: teamFails.length,
      failingCronIds: teamFails.map(j => j.name).slice(0, 5),
      topError: lastMessage(teamFails[0]).slice(0, 120),
    });
  }
  return alerts.sort((a, b) => b.failCount - a.failCount);
}

function detectRepeatedFailures(jobs: AutomationJob[]): CircuitBroken[] {
  return jobs
    .filter(j => j.enabled && (j.state?.consecutiveErrors ?? 0) >= 3)
    .map(j => ({
      taskId: j.name,
      failures: j.state?.consecutiveErrors ?? 0,
      state: 'repeated-failure',
      lastFailureAt: lastRunAtMs(j) ? toKstString(lastRunAtMs(j)!) : undefined,
    }))
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 10);
}

export async function GET() {
  const jobs = await listAutomations();
  if (!jobs) {
    return NextResponse.json(
      { feed: [], alertTeams: [], circuitBreakers: [], error: 'OpenClaw 자동화 목록을 읽지 못했습니다.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const recent = recentRuns(jobs);
  return NextResponse.json({
    feed: buildFeed(recent, 20),
    alertTeams: detectAlertTeams(recent),
    circuitBreakers: detectRepeatedFailures(jobs),
    source: 'openclaw-automations',
    generatedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
