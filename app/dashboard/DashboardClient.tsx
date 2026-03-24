'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useEvent } from '@/contexts/EventContext';
import { RefreshCw } from 'lucide-react';

// ── Types ──

interface DashboardData {
  ts: string;
  system: {
    discord_bot?: string;
    memory_mb?: number;
    crash_count?: number;
    stale_claude_killed?: number;
    last_check?: string;
  };
  cron: {
    todaySuccess: number;
    todayFail: number;
    todayTotal: number;
    successRate: number;
    recentFailures: string[];
    trend: Array<{ date: string; ok: number; fail: number }>;
  };
  claude: {
    todayCalls: number;
    lastHourCalls: number;
    totalTracked: number;
    hourly: number[];
  };
  tasks: {
    total: number;
    awaiting: number;
    approved: number;
    active: number;
    done: number;
    failed: number;
    rejected: number;
    groups: number;
  };
  board: {
    totalPosts: number;
    openPosts: number;
    resolvedPosts: number;
    totalComments: number;
    recentDays: Array<{ date: string; posts: number; comments: number }>;
  };
  agents: {
    top5: Array<{ agent_id: string; score: number; events: number }>;
    tierChanges: Array<{
      agent_id: string;
      from_tier: string;
      to_tier: string;
      reason: string | null;
      created_at: string;
    }>;
  };
  e2e: {
    passed: number;
    total: number;
    rate: number;
    lastRun: string;
    failures: string[];
  };
  teams: Array<{ name: string; merit: number; penalty: number; status: string }>;
  autonomy: {
    autonomy_rate?: string;
    total_decisions?: number;
    executed?: number;
    by_team?: Record<string, { total?: number; executed?: number }>;
  };
  errors: {
    total24h: number;
    totalAll: number;
    topErrors: Array<{ msg: string; count: number }>;
  };
}

// ── Helpers ──

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function BigNumber({ value, unit }: { value: string | number; unit?: string }) {
  return (
    <span className="text-3xl font-black tabular-nums text-zinc-900">
      {value}
      {unit && <span className="text-lg font-semibold text-zinc-400 ml-1">{unit}</span>}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
      {children}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === 'NORMAL' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    status === 'AT_RISK' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    status === 'PENALTY' ? 'bg-red-50 text-red-700 border-red-200' :
    'bg-zinc-50 text-zinc-500 border-zinc-200';
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border ${cls}`}>
      {status}
    </span>
  );
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// ── Card Components ──

function SystemCard({ data }: { data: DashboardData['system'] }) {
  const isHealthy = data.discord_bot === 'healthy';
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🖥</span>
        <Label>시스템 상태</Label>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-zinc-700">
            Discord Bot: {isHealthy ? 'healthy' : (data.discord_bot || 'unknown')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>메모리</Label>
            <div className="text-lg font-bold tabular-nums text-zinc-800">{data.memory_mb ?? '-'} <span className="text-xs text-zinc-400">MB</span></div>
          </div>
          <div>
            <Label>크래시</Label>
            <div className="text-lg font-bold tabular-nums text-zinc-800">{data.crash_count ?? 0}<span className="text-xs text-zinc-400">회</span></div>
          </div>
        </div>
        {(data.stale_claude_killed ?? 0) > 0 && (
          <div className="text-xs text-amber-600">⚡ Stale Claude 정리: {data.stale_claude_killed}건</div>
        )}
        <div className="text-[10px] text-zinc-400">마지막 체크: {formatTime(data.last_check)}</div>
      </div>
    </Card>
  );
}

function CronCard({ data }: { data: DashboardData['cron'] }) {
  const maxVal = Math.max(...data.trend.map(d => d.ok + d.fail), 1);
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⏱</span>
        <Label>크론 파이프라인</Label>
      </div>
      <div className="mb-3">
        <BigNumber value={data.successRate} unit="%" />
        <div className="text-xs text-zinc-500 mt-1">오늘 성공률 · {data.todaySuccess}성공 / {data.todayFail}실패</div>
      </div>
      {/* 7-day trend mini bar chart */}
      <div className="flex items-end gap-1 h-12 mb-3">
        {data.trend.map((d) => {
          const total = d.ok + d.fail;
          const h = total > 0 ? (total / maxVal) * 100 : 2;
          const failH = d.fail > 0 ? (d.fail / maxVal) * 100 : 0;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-stretch justify-end h-full" title={`${d.date}: ${d.ok}ok / ${d.fail}fail`}>
              <div className="rounded-t" style={{ height: `${h}%`, minHeight: '2px' }}>
                {failH > 0 && <div className="bg-red-400 rounded-t" style={{ height: `${failH}%`, minHeight: '1px' }} />}
                <div className="bg-emerald-400 rounded-t flex-1" style={{ height: `${h - failH}%`, minHeight: '1px' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-zinc-400 mb-2">
        {data.trend.map((d) => (
          <span key={d.date}>{d.date.slice(5)}</span>
        ))}
      </div>
      {data.recentFailures.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.recentFailures.map((f, i) => (
            <div key={i} className="text-[11px] text-red-500 truncate">• {f}</div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ClaudeCard({ data }: { data: DashboardData['claude'] }) {
  const maxH = Math.max(...data.hourly, 1);
  const currentHour = new Date().getHours();
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🤖</span>
        <Label>Claude 사용량</Label>
      </div>
      <div className="mb-1">
        <BigNumber value={data.todayCalls} />
        <span className="text-sm text-zinc-500 ml-2">오늘 호출</span>
      </div>
      <div className="text-xs text-zinc-500 mb-4">최근 1시간: {data.lastHourCalls}회 · 전체: {data.totalTracked}회</div>
      {/* 24h heatmap */}
      <div className="grid grid-cols-12 gap-[3px]">
        {data.hourly.map((count, h) => {
          const opacity = count > 0 ? Math.max(0.15, count / maxH) : 0.04;
          return (
            <div
              key={h}
              className={`aspect-square rounded-sm ${h === currentHour ? 'ring-1 ring-indigo-400' : ''}`}
              style={{ backgroundColor: `rgba(99, 102, 241, ${opacity})` }}
              title={`${h}시: ${count}회`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[8px] text-zinc-400 mt-1">
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
    </Card>
  );
}

function TasksCard({ data }: { data: DashboardData['tasks'] }) {
  const slices = [
    { label: '대기', value: data.awaiting, color: '#f59e0b' },
    { label: '승인', value: data.approved, color: '#14b8a6' },
    { label: '진행', value: data.active, color: '#6366f1' },
    { label: '완료', value: data.done, color: '#10b981' },
    { label: '실패', value: data.failed, color: '#ef4444' },
    { label: '반려', value: data.rejected, color: '#a1a1aa' },
  ].filter(s => s.value > 0);

  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  let cumDeg = 0;
  const gradientParts = slices.map(s => {
    const start = cumDeg;
    cumDeg += (s.value / total) * 360;
    return `${s.color} ${start}deg ${cumDeg}deg`;
  });
  const gradient = gradientParts.length > 0
    ? `conic-gradient(${gradientParts.join(', ')})`
    : 'conic-gradient(#e4e4e7 0deg 360deg)';

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📋</span>
        <Label>Dev Task</Label>
      </div>
      <div className="flex items-center gap-4">
        {/* Mini donut */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <div
            className="w-full h-full rounded-full"
            style={{ background: gradient }}
          />
          <div className="absolute inset-2.5 bg-white rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-zinc-700">{data.total}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {slices.map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-zinc-500">{s.label}</span>
              <span className="font-semibold text-zinc-700 tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 text-[11px] text-zinc-400">그룹: {data.groups}개</div>
    </Card>
  );
}

function BoardCard({ data }: { data: DashboardData['board'] }) {
  const maxDay = Math.max(...data.recentDays.map(d => d.posts + d.comments), 1);
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💬</span>
        <Label>Board 활동</Label>
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        <BigNumber value={data.totalPosts} />
        <span className="text-sm text-zinc-500">포스트</span>
      </div>
      <div className="text-xs text-zinc-500 mb-4">
        활성 {data.openPosts} · 해결 {data.resolvedPosts} · 댓글 {data.totalComments}
      </div>
      {/* 7-day activity bar chart */}
      <div className="flex items-end gap-1.5 h-14">
        {data.recentDays.map((d) => {
          const pH = d.posts > 0 ? (d.posts / maxDay) * 100 : 0;
          const cH = d.comments > 0 ? (d.comments / maxDay) * 100 : 0;
          return (
            <div key={d.date} className="flex-1 flex gap-[2px] items-end h-full" title={`${d.date}: ${d.posts}posts, ${d.comments}comments`}>
              <div className="flex-1 bg-blue-400 rounded-t" style={{ height: `${pH}%`, minHeight: d.posts > 0 ? '2px' : '0' }} />
              <div className="flex-1 bg-violet-400 rounded-t" style={{ height: `${cH}%`, minHeight: d.comments > 0 ? '2px' : '0' }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-zinc-400 mt-1">
        {data.recentDays.map((d) => (
          <span key={d.date}>{d.date.slice(5)}</span>
        ))}
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400" /> 포스트</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-400" /> 댓글</span>
      </div>
    </Card>
  );
}

function AgentsCard({ data }: { data: DashboardData['agents'] }) {
  const maxScore = Math.max(...data.top5.map(a => a.score), 1);
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🏆</span>
        <Label>에이전트 Top 5</Label>
      </div>
      <div className="space-y-2 mb-3">
        {data.top5.length === 0 && <div className="text-xs text-zinc-400">데이터 없음</div>}
        {data.top5.map((agent, i) => (
          <div key={agent.agent_id} className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400 w-4 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-700 truncate">{agent.agent_id}</span>
                <span className="text-[10px] text-zinc-400 tabular-nums">{agent.events}건</span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full mt-0.5">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${(agent.score / maxScore) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-bold tabular-nums text-zinc-700 w-10 text-right">{agent.score}</span>
          </div>
        ))}
      </div>
      {data.tierChanges.length > 0 && (
        <div className="border-t border-zinc-100 pt-2 space-y-1">
          <Label>최근 티어 변동</Label>
          {data.tierChanges.map((tc, i) => {
            const isPromotion = tierRank(tc.to_tier) > tierRank(tc.from_tier);
            return (
              <div key={i} className="text-[11px] text-zinc-600 flex items-center gap-1.5">
                <span>{isPromotion ? '🟢' : '🔴'}</span>
                <span className="font-medium">{tc.agent_id}</span>
                <span className="text-zinc-400">{tc.from_tier} → {tc.to_tier}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function tierRank(tier: string): number {
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  return tiers.indexOf(tier.toLowerCase());
}

function E2ECard({ data }: { data: DashboardData['e2e'] }) {
  const rateColor = data.rate >= 90 ? 'text-emerald-600' : data.rate >= 70 ? 'text-amber-600' : 'text-red-600';
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">✅</span>
        <Label>E2E 테스트</Label>
      </div>
      <div className="mb-1">
        <span className={`text-3xl font-black tabular-nums ${rateColor}`}>{data.rate}</span>
        <span className="text-lg font-semibold text-zinc-400 ml-1">%</span>
      </div>
      <div className="text-xs text-zinc-500 mb-3">
        {data.passed}/{data.total} 통과 · 마지막: {formatTime(data.lastRun)}
      </div>
      {data.failures.length > 0 && (
        <div className="space-y-1">
          {data.failures.map((f, i) => (
            <div key={i} className="text-[11px] text-red-500 truncate">• {f}</div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TeamsCard({ data }: { data: DashboardData['teams'] }) {
  const maxMerit = Math.max(...data.map(t => t.merit), 1);
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">👥</span>
        <Label>팀 스코어</Label>
      </div>
      {data.length === 0 && <div className="text-xs text-zinc-400">데이터 없음</div>}
      <div className="space-y-2.5">
        {data.map((team) => (
          <div key={team.name}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-zinc-700">{team.name}</span>
              <StatusChip status={team.status} />
            </div>
            <div className="flex gap-1 h-2">
              <div
                className="bg-emerald-400 rounded-l"
                style={{ width: `${(team.merit / maxMerit) * 100}%`, minWidth: team.merit > 0 ? '2px' : '0' }}
                title={`Merit: ${team.merit}`}
              />
              <div
                className="bg-red-300 rounded-r"
                style={{ width: `${(team.penalty / maxMerit) * 100}%`, minWidth: team.penalty > 0 ? '2px' : '0' }}
                title={`Penalty: ${team.penalty}`}
              />
            </div>
            <div className="flex gap-3 mt-0.5 text-[10px] text-zinc-400">
              <span>+{team.merit}</span>
              <span>-{team.penalty}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AutonomyCard({ data }: { data: DashboardData['autonomy'] }) {
  const rate = parseFloat(data.autonomy_rate ?? '0');
  const byTeam = data.by_team ?? {};
  const teamEntries = Object.entries(byTeam);
  const maxTeamTotal = Math.max(...teamEntries.map(([, v]) => v.total ?? 0), 1);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🤖</span>
        <Label>자율운영</Label>
      </div>
      <div className="mb-1">
        <BigNumber value={rate.toFixed(0)} unit="%" />
      </div>
      <div className="text-xs text-zinc-500 mb-4">
        총 결정 {data.total_decisions ?? 0}건 · 실행 {data.executed ?? 0}건
      </div>
      {teamEntries.length > 0 && (
        <div className="space-y-2">
          {teamEntries.map(([name, v]) => {
            const total = v.total ?? 0;
            const executed = v.executed ?? 0;
            return (
              <div key={name}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-zinc-600">{name}</span>
                  <span className="text-zinc-400 tabular-nums">{executed}/{total}</span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full">
                  <div
                    className="h-full bg-indigo-400 rounded-full"
                    style={{ width: `${(total / maxTeamTotal) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ErrorsCard({ data }: { data: DashboardData['errors'] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⚠️</span>
        <Label>에러 트래커</Label>
      </div>
      <div className="flex items-baseline gap-3 mb-3">
        <BigNumber value={data.total24h} />
        <span className="text-sm text-zinc-500">24h 에러</span>
      </div>
      <div className="text-xs text-zinc-400 mb-3">전체 누적: {data.totalAll}건</div>
      {data.topErrors.length > 0 && (
        <div className="space-y-1.5">
          {data.topErrors.map((e, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs font-bold text-red-400 tabular-nums w-6 text-right flex-shrink-0">{e.count}×</span>
              <span className="text-[11px] text-zinc-600 break-all leading-tight">{e.msg}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main Dashboard Client ──

const EMPTY_DATA: DashboardData = {
  ts: '',
  system: {},
  cron: { todaySuccess: 0, todayFail: 0, todayTotal: 0, successRate: 0, recentFailures: [], trend: [] },
  claude: { todayCalls: 0, lastHourCalls: 0, totalTracked: 0, hourly: new Array(24).fill(0) },
  tasks: { total: 0, awaiting: 0, approved: 0, active: 0, done: 0, failed: 0, rejected: 0, groups: 0 },
  board: { totalPosts: 0, openPosts: 0, resolvedPosts: 0, totalComments: 0, recentDays: [] },
  agents: { top5: [], tierChanges: [] },
  e2e: { passed: 0, total: 0, rate: 0, lastRun: '', failures: [] },
  teams: [],
  autonomy: {},
  errors: { total24h: 0, totalAll: 0, topErrors: [] },
};

export default function DashboardClient({ initialData }: { initialData: DashboardData | null }) {
  const [data, setData] = useState<DashboardData>(initialData ?? EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { subscribe } = useEvent();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      }
    } catch {
      // Silently fail, keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  // 30-second polling
  useEffect(() => {
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // SSE: refresh on dev_task_updated
  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === 'dev_task_updated') {
        fetchData();
      }
    });
  }, [subscribe, fetchData]);

  const d = data;

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors">
            ← 홈
          </Link>
          <h1 className="text-sm font-semibold text-zinc-900">📊 Jarvis Dashboard</h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-zinc-400 tabular-nums">
              {lastRefresh.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Row 1 — 시스템 운영 */}
          <SystemCard data={d.system} />
          <CronCard data={d.cron} />
          <ClaudeCard data={d.claude} />

          {/* Row 2 — 업무 & 팀 */}
          <TasksCard data={d.tasks} />
          <BoardCard data={d.board} />
          <AgentsCard data={d.agents} />

          {/* Row 3 — 품질 & 자율성 */}
          <E2ECard data={d.e2e} />
          <TeamsCard data={d.teams} />
          <AutonomyCard data={d.autonomy} />

          {/* Row 4 — 오류 (full width) */}
          <div className="md:col-span-2 lg:col-span-3">
            <ErrorsCard data={d.errors} />
          </div>
        </div>
      </main>
    </>
  );
}
