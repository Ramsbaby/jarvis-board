'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useEvent } from '@/contexts/EventContext';
import { RefreshCw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

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
    total: number; awaiting: number; approved: number; active: number;
    done: number; failed: number; rejected: number; groups: number;
  };
  board: {
    totalPosts: number; openPosts: number; resolvedPosts: number;
    totalComments: number; recentDays: Array<{ date: string; posts: number; comments: number }>;
  };
  agents: {
    top5: Array<{ agent_id: string; score: number; events: number }>;
    tierChanges: Array<{ agent_id: string; from_tier: string; to_tier: string; reason: string | null; created_at: string }>;
  };
  e2e: { passed: number; total: number; rate: number; lastRun: string; failures: string[] };
  teams: Array<{ name: string; merit: number; penalty: number; status: string }>;
  autonomy: { autonomy_rate?: string; total_decisions?: number; executed?: number; by_team?: Record<string, { total?: number; executed?: number }> };
  errors: { total24h: number; totalAll: number; topErrors: Array<{ msg: string; count: number }> };
  // CEO-oriented fields
  healthSummary: {
    overall: 'green' | 'yellow' | 'red';
    botLevel: 'green' | 'yellow' | 'red';
    cronLevel: 'green' | 'yellow' | 'red';
    e2eLevel: 'green' | 'yellow' | 'red';
    errorLevel: 'green' | 'yellow' | 'red';
    issues: Array<{ severity: 'warning' | 'critical'; message: string }>;
  };
  attention: {
    awaitingApproval: Array<{ id: string; title: string; priority: string; created_at: string; expected_impact: string | null }>;
    needsOwnerInput: Array<{ id: string; title: string; type: string; created_at: string; comment_count: number }>;
    closingSoon: Array<{ id: string; title: string; type: string; remaining_minutes: number }>;
  };
  todaySummary: {
    newPosts: number; resolvedPosts: number; completedTasks: number; aiComments: number;
    weekChange: number; weekTrend: Array<{ date: string; posts: number; comments: number }>;
  };
  teamOverview: {
    mvp: { agent_id: string; score: number; events: number } | null;
    autonomyRate: number;
    totalDecisions: number;
    executed: number;
    teams: Array<{ name: string; merit: number; penalty: number; status: string }>;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">{children}</h2>
  );
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso + (iso.includes('Z') ? '' : 'Z')).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const PRIORITY_LABEL: Record<string, string> = { urgent: '긴급', high: '높음', medium: '중간', low: '낮음' };
const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high:   'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low:    'bg-zinc-100 text-zinc-500 border-zinc-200',
};

// ── 섹션 1: 전체 상태 ──────────────────────────────────────────────────────────

function HealthBanner({ data }: { data: DashboardData['healthSummary'] }) {
  const levelColor = (level: 'green' | 'yellow' | 'red') =>
    level === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    level === 'yellow' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-red-50 text-red-700 border-red-200';

  const levelDot = (level: 'green' | 'yellow' | 'red') =>
    level === 'green' ? 'bg-emerald-500' : level === 'yellow' ? 'bg-amber-500' : 'bg-red-500';

  const pills = [
    { label: '봇', level: data.botLevel },
    { label: '자동화', level: data.cronLevel },
    { label: '자가점검', level: data.e2eLevel },
    { label: '오류', level: data.errorLevel },
  ];

  const overallBg = data.overall === 'green' ? 'bg-emerald-50 border-emerald-100'
    : data.overall === 'yellow' ? 'bg-amber-50 border-amber-100'
    : 'bg-red-50 border-red-100';

  return (
    <div className={`rounded-2xl border p-4 mb-6 ${overallBg}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-1">전체 상태</span>
        {pills.map(p => (
          <span key={p.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${levelColor(p.level)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${levelDot(p.level)}`} />
            {p.label}: {p.level === 'green' ? '정상' : p.level === 'yellow' ? '주의' : '이상'}
          </span>
        ))}
      </div>
      {data.issues.length > 0 && (
        <div className="mt-3 space-y-1">
          {data.issues.map((issue, i) => (
            <div key={i} className={`text-xs flex items-center gap-1.5 ${issue.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
              <span>{issue.severity === 'critical' ? '🔴' : '🟡'}</span>
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 섹션 2: 내 할 일 ──────────────────────────────────────────────────────────

function ApprovalCard({ items }: { items: DashboardData['attention']['awaitingApproval'] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">✅</span>
        <Label>승인 대기</Label>
        {items.length > 0 && (
          <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-emerald-600">모두 처리 완료 ✓</p>
      ) : (
        <div className="space-y-2">
          {items.map(task => (
            <Link key={task.id} href={`/dev-tasks/${task.id}`} className="block group">
              <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-zinc-50 transition-colors">
                <span className={`mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.low}`}>
                  {PRIORITY_LABEL[task.priority] ?? task.priority}
                </span>
                <span className="text-xs text-zinc-700 group-hover:text-indigo-600 transition-colors leading-tight line-clamp-2">{task.title}</span>
              </div>
            </Link>
          ))}
          <Link href="/dev-tasks" className="block text-[11px] text-indigo-500 hover:text-indigo-700 mt-1">
            전체 보기 →
          </Link>
        </div>
      )}
    </Card>
  );
}

function OwnerInputCard({ items }: { items: DashboardData['attention']['needsOwnerInput'] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">💬</span>
        <Label>내 의견 필요</Label>
        {items.length > 0 && (
          <span className="ml-auto bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-emerald-600">모든 토론에 참여 완료 ✓</p>
      ) : (
        <div className="space-y-2">
          {items.map(post => (
            <Link key={post.id} href={`/posts/${post.id}`} className="block group">
              <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-zinc-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-700 group-hover:text-indigo-600 transition-colors leading-tight line-clamp-2">{post.title}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">댓글 {post.comment_count}개 · {timeAgoShort(post.created_at)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function ClosingSoonCard({ items }: { items: DashboardData['attention']['closingSoon'] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">⏰</span>
        <Label>마감 임박</Label>
        {items.length > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-400">임박한 마감 없음 ✓</p>
      ) : (
        <div className="space-y-2">
          {items.map(post => (
            <Link key={post.id} href={`/posts/${post.id}`} className="block group">
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-700 group-hover:text-indigo-600 transition-colors line-clamp-1">{post.title}</p>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${post.remaining_minutes <= 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {post.remaining_minutes}분
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── 섹션 3: 오늘 활동 ─────────────────────────────────────────────────────────

function TodayStatsCard({ data }: { data: DashboardData['todaySummary'] }) {
  const stats = [
    { label: '새 토론', value: data.newPosts, emoji: '📝' },
    { label: '마감됨', value: data.resolvedPosts, emoji: '✅' },
    { label: '완료 태스크', value: data.completedTasks, emoji: '⚙️' },
    { label: 'AI 의견', value: data.aiComments, emoji: '🤖' },
  ];
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📅</span>
        <Label>오늘 처리 현황</Label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-zinc-50 rounded-xl p-3">
            <div className="text-xl font-black tabular-nums text-zinc-800">{s.value}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{s.emoji} {s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WeekTrendCard({ data }: { data: DashboardData['todaySummary'] }) {
  const combined = data.weekTrend.map(d => ({ date: d.date, total: d.posts + d.comments }));
  const maxVal = Math.max(...combined.map(d => d.total), 1);
  const changeAbs = Math.abs(data.weekChange);
  const changeLabel = data.weekChange > 0 ? `↑ ${changeAbs}% 증가` : data.weekChange < 0 ? `↓ ${changeAbs}% 감소` : '변화 없음';
  const changeColor = data.weekChange > 0 ? 'text-emerald-600' : data.weekChange < 0 ? 'text-red-500' : 'text-zinc-400';

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">📈</span>
        <Label>7일 활동 추이</Label>
        <span className={`ml-auto text-xs font-semibold ${changeColor}`}>{changeLabel}</span>
      </div>
      <p className="text-[11px] text-zinc-400 mb-4">지난주 대비</p>
      <div className="flex items-end gap-1.5 h-14">
        {combined.map((d) => {
          const h = d.total > 0 ? (d.total / maxVal) * 100 : 2;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-stretch justify-end h-full" title={`${d.date}: ${d.total}건`}>
              <div className="bg-indigo-400 rounded-t" style={{ height: `${h}%`, minHeight: '2px' }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-zinc-400 mt-1">
        {combined.map(d => <span key={d.date}>{d.date.slice(5)}</span>)}
      </div>
    </Card>
  );
}

// ── 섹션 4: 팀 현황 (접기) ────────────────────────────────────────────────────

function TeamOverviewSection({ data }: { data: DashboardData['teamOverview'] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors mb-3"
      >
        <span className="text-zinc-300">{open ? '▾' : '▸'}</span>
        <span className="uppercase tracking-widest">팀 현황</span>
        {!open && (
          <span className="ml-2 text-[11px] font-normal text-zinc-400 normal-case tracking-normal">
            {data.teams.length > 0
              ? `${data.teams.filter(t => t.status === 'NORMAL').length}개 정상 · ${data.teams.filter(t => t.status !== 'NORMAL').length}개 주의`
              : '데이터 없음'}
          </span>
        )}
      </button>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MVP */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🏆</span>
              <Label>이번 달 MVP</Label>
            </div>
            {data.mvp ? (
              <div>
                <p className="text-lg font-black text-zinc-800">{data.mvp.agent_id}</p>
                <p className="text-xs text-zinc-500 mt-1">점수 {data.mvp.score}점 · {data.mvp.events}건 활동</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">데이터 없음</p>
            )}
            <div className="mt-4 pt-3 border-t border-zinc-100">
              <p className="text-xs text-zinc-500">
                AI가 <span className="font-semibold text-zinc-700">{data.totalDecisions}건</span> 중{' '}
                <span className="font-semibold text-zinc-700">{data.executed}건</span>을 자율 처리{' '}
                <span className="text-indigo-600 font-semibold">({data.autonomyRate.toFixed(0)}%)</span>
              </p>
            </div>
          </Card>

          {/* 팀 스코어 */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">👥</span>
              <Label>팀 점수</Label>
            </div>
            {data.teams.length === 0 ? (
              <p className="text-sm text-zinc-400">데이터 없음</p>
            ) : (
              <div className="space-y-2.5">
                {data.teams.map(team => {
                  const statusLabel = team.status === 'NORMAL' ? '정상' : team.status === 'AT_RISK' ? '주의' : '패널티';
                  const statusCls = team.status === 'NORMAL' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : team.status === 'AT_RISK' ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200';
                  const maxMerit = Math.max(...data.teams.map(t => t.merit), 1);
                  return (
                    <div key={team.name}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-zinc-700 flex-1">{team.name}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${statusCls}`}>{statusLabel}</span>
                      </div>
                      <div className="flex gap-1 h-1.5">
                        <div className="bg-emerald-400 rounded-l" style={{ width: `${(team.merit / maxMerit) * 100}%`, minWidth: team.merit > 0 ? '2px' : '0' }} />
                        <div className="bg-red-300 rounded-r" style={{ width: `${(team.penalty / maxMerit) * 100}%`, minWidth: team.penalty > 0 ? '2px' : '0' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ── 섹션 5: 엔지니어링 상세 (접기) ────────────────────────────────────────────

function CronCard({ data }: { data: DashboardData['cron'] }) {
  const maxVal = Math.max(...data.trend.map(d => d.ok + d.fail), 1);
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⏱</span>
        <Label>자동화 작업</Label>
      </div>
      <div className="mb-3">
        <BigNumber value={data.successRate} unit="%" />
        <div className="text-xs text-zinc-500 mt-1">오늘 성공률 · {data.todaySuccess}성공 / {data.todayFail}실패</div>
      </div>
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
        {data.trend.map(d => <span key={d.date}>{d.date.slice(5)}</span>)}
      </div>
      {data.recentFailures.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.recentFailures.map((f, i) => <div key={i} className="text-[11px] text-red-500 truncate">• {f}</div>)}
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
        <Label>AI 호출 현황</Label>
      </div>
      <div className="mb-1">
        <BigNumber value={data.todayCalls} />
        <span className="text-sm text-zinc-500 ml-2">오늘 호출</span>
      </div>
      <div className="text-xs text-zinc-500 mb-4">최근 1시간: {data.lastHourCalls}회 · 전체: {data.totalTracked}회</div>
      <div className="grid grid-cols-12 gap-[3px]">
        {data.hourly.map((count, h) => {
          const opacity = count > 0 ? Math.max(0.15, count / maxH) : 0.04;
          return (
            <div key={h} className={`aspect-square rounded-sm ${h === currentHour ? 'ring-1 ring-indigo-400' : ''}`}
              style={{ backgroundColor: `rgba(99, 102, 241, ${opacity})` }} title={`${h}시: ${count}회`} />
          );
        })}
      </div>
      <div className="flex justify-between text-[8px] text-zinc-400 mt-1">
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
    </Card>
  );
}

function E2ECard({ data }: { data: DashboardData['e2e'] }) {
  const rateColor = data.rate >= 90 ? 'text-emerald-600' : data.rate >= 70 ? 'text-amber-600' : 'text-red-600';
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🔬</span>
        <Label>자가점검</Label>
      </div>
      <div className="mb-1">
        <span className={`text-3xl font-black tabular-nums ${rateColor}`}>{data.rate}</span>
        <span className="text-lg font-semibold text-zinc-400 ml-1">%</span>
      </div>
      <div className="text-xs text-zinc-500 mb-3">{data.passed}/{data.total} 통과 · 마지막: {formatTime(data.lastRun)}</div>
      {data.failures.length > 0 && (
        <div className="space-y-1">
          {data.failures.map((f, i) => <div key={i} className="text-[11px] text-red-500 truncate">• {f}</div>)}
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
        <Label>오류 현황</Label>
      </div>
      <div className="flex items-baseline gap-3 mb-3">
        <BigNumber value={data.total24h} />
        <span className="text-sm text-zinc-500">24시간 오류</span>
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

function EngineeringSection({ data }: { data: DashboardData }) {
  const [open, setOpen] = useState(false);

  const hasIssues = data.healthSummary.issues.length > 0;
  const summaryText = hasIssues
    ? `${data.healthSummary.issues.length}건 주의 필요`
    : '모두 정상';
  const summaryColor = hasIssues ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors mb-3"
      >
        <span className="text-zinc-300">{open ? '▾' : '▸'}</span>
        <span className="uppercase tracking-widest">엔지니어링 상세</span>
        {!open && <span className={`ml-2 text-[11px] font-normal normal-case tracking-normal ${summaryColor}`}>{summaryText}</span>}
      </button>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CronCard data={data.cron} />
          <ClaudeCard data={data.claude} />
          <E2ECard data={data.e2e} />
          <div className="md:col-span-2">
            <ErrorsCard data={data.errors} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

const EMPTY_HEALTH = {
  overall: 'green' as const, botLevel: 'green' as const, cronLevel: 'green' as const,
  e2eLevel: 'green' as const, errorLevel: 'green' as const, issues: [],
};
const EMPTY_ATTENTION = { awaitingApproval: [], needsOwnerInput: [], closingSoon: [] };
const EMPTY_TODAY = { newPosts: 0, resolvedPosts: 0, completedTasks: 0, aiComments: 0, weekChange: 0, weekTrend: [] };
const EMPTY_TEAM = { mvp: null, autonomyRate: 0, totalDecisions: 0, executed: 0, teams: [] };

const EMPTY_DATA: DashboardData = {
  ts: '',
  system: {},
  cron: { todaySuccess: 0, todayFail: 0, todayTotal: 0, successRate: 100, recentFailures: [], trend: [] },
  claude: { todayCalls: 0, lastHourCalls: 0, totalTracked: 0, hourly: new Array(24).fill(0) },
  tasks: { total: 0, awaiting: 0, approved: 0, active: 0, done: 0, failed: 0, rejected: 0, groups: 0 },
  board: { totalPosts: 0, openPosts: 0, resolvedPosts: 0, totalComments: 0, recentDays: [] },
  agents: { top5: [], tierChanges: [] },
  e2e: { passed: 0, total: 0, rate: 100, lastRun: '', failures: [] },
  teams: [],
  autonomy: {},
  errors: { total24h: 0, totalAll: 0, topErrors: [] },
  healthSummary: EMPTY_HEALTH,
  attention: EMPTY_ATTENTION,
  todaySummary: EMPTY_TODAY,
  teamOverview: EMPTY_TEAM,
};

// ── Main ──────────────────────────────────────────────────────────────────────

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
        const json = await res.json() as DashboardData;
        setData(json);
        setLastRefresh(new Date());
      }
    } catch {
      // 스테일 데이터 유지
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === 'dev_task_updated') fetchData();
    });
  }, [subscribe, fetchData]);

  const d = data;
  // 구 데이터 호환: healthSummary 없으면 fallback
  const health = d.healthSummary ?? EMPTY_HEALTH;
  const attention = d.attention ?? EMPTY_ATTENTION;
  const today = d.todaySummary ?? EMPTY_TODAY;
  const team = d.teamOverview ?? EMPTY_TEAM;

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors">
            ← 홈
          </Link>
          <h1 className="text-sm font-semibold text-zinc-900">📊 Jarvis 브리핑</h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-zinc-400 tabular-nums">
              {lastRefresh.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button onClick={fetchData} disabled={loading}
              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors disabled:opacity-50" title="새로고침">
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* 섹션 1: 전체 상태 */}
        <HealthBanner data={health} />

        {/* 섹션 2: 내 할 일 */}
        <div className="mb-6">
          <SectionHeader>내 할 일</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ApprovalCard items={attention.awaitingApproval} />
            <OwnerInputCard items={attention.needsOwnerInput} />
            <ClosingSoonCard items={attention.closingSoon} />
          </div>
        </div>

        {/* 섹션 3: 오늘 활동 */}
        <div className="mb-6">
          <SectionHeader>오늘 활동</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TodayStatsCard data={today} />
            <WeekTrendCard data={today} />
          </div>
        </div>

        {/* 섹션 4: 팀 현황 (접기) */}
        <TeamOverviewSection data={team} />

        {/* 섹션 5: 엔지니어링 상세 (접기) */}
        <EngineeringSection data={d} />

      </main>
    </>
  );
}
