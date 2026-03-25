'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, Terminal, Bot, Play, CheckCircle2, AlertTriangle, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface E2EDrawerData {
  passed: number;
  total: number;
  rate: number;
  lastRun: string;
  failures: string[];
}

// ── Inline hooks ───────────────────────────────────────────────────────────────

function useAction() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const run = useCallback(async (type: string, params: Record<string, unknown> = {}) => {
    setLoading(true); setResult(null);
    try {
      const r = await fetch('/api/admin/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, params }) });
      const d = await r.json();
      setResult({ ok: d.ok !== false, message: d.message || d.error || (r.ok ? '완료' : '실패') });
    } catch { setResult({ ok: false, message: '네트워크 오류' }); }
    finally { setLoading(false); }
  }, []);
  return { loading, result, run, clearResult: () => setResult(null) };
}

// useDetailData is included per the spec requirement (inline in each file)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useDetailData<T>(type: string, params?: Record<string, string>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ type, ...(params || {}) }).toString();
    fetch(`/api/dashboard/detail?${qs}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, JSON.stringify(params)]);
  return { data, loading, error };
}

// ── LogViewer ─────────────────────────────────────────────────────────────────

function useServiceLogs(service: string) {
  const [lines, setLines] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const fetch_ = useCallback(async () => {
    setFetching(true);
    try {
      const r = await fetch(`/api/admin/logs?service=${encodeURIComponent(service)}&lines=80`);
      const d = await r.json();
      if (d.lines) {
        setLines(d.lines);
        setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
      }
    } catch { /* ignore */ }
    finally { setFetching(false); }
  }, [service]);
  useEffect(() => { fetch_(); }, [fetch_]);
  return { lines, fetching, refresh: fetch_, logRef };
}

function colorLine(line: string) {
  if (/PASS|OK|SUCCESS/i.test(line)) return 'text-emerald-400';
  if (/FAIL|ERROR/i.test(line)) return 'text-rose-400';
  return 'text-zinc-400';
}

function LogViewer({ service }: { service: string }) {
  const { lines, fetching, refresh, logRef } = useServiceLogs(service);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
          <Terminal size={12} /> 최근 로그
        </span>
        <button onClick={refresh} disabled={fetching} className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1 transition-colors">
          <RefreshCw size={11} className={fetching ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>
      <div ref={logRef} className="bg-zinc-950 rounded-lg p-3 h-40 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5">
        {lines.length === 0
          ? <div className="text-zinc-600 italic">{fetching ? '로딩 중...' : '로그 없음'}</div>
          : lines.map((line, i) => <div key={i} className={colorLine(line)}>{line}</div>)
        }
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActionResult({ result, onClose }: { result: { ok: boolean; message: string } | null; onClose: () => void }) {
  if (!result) return null;
  return (
    <div className={`mt-3 p-3 rounded-lg flex items-start gap-2 text-sm ${
      result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
    }`}>
      {result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
      <span className="flex-1">{result.message}</span>
      <button onClick={onClose} className="text-current opacity-50 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

function rateColor(rate: number): string {
  if (rate >= 95) return 'text-emerald-600';
  if (rate >= 80) return 'text-amber-600';
  return 'text-rose-600';
}

function rateBarClass(rate: number): string {
  if (rate >= 95) return 'bg-emerald-500';
  if (rate >= 80) return 'bg-amber-500';
  return 'bg-rose-500';
}

function formatLastRun(lastRun: string): string {
  try {
    const d = new Date(lastRun);
    if (isNaN(d.getTime())) return lastRun;
    return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return lastRun;
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

export function E2EContent({ data }: { data: E2EDrawerData }) {
  const { loading, result, run, clearResult } = useAction();

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* 성공률 대시보드 (2-col grid) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
          <div className="text-[11px] text-zinc-500 mb-0.5">통과</div>
          <div className="text-xl font-bold text-emerald-600">{data.passed}</div>
          <div className="text-[10px] text-zinc-400">/ {data.total}개</div>
        </div>
        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
          <div className="text-[11px] text-zinc-500 mb-0.5">성공률</div>
          <div className={`text-xl font-bold ${rateColor(data.rate)}`}>{data.rate}%</div>
          <div className="text-[10px] text-zinc-400">목표 100%</div>
        </div>
        <div className="col-span-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
          <div className="text-[11px] text-zinc-500 mb-0.5">마지막 실행</div>
          <div className="text-sm font-semibold text-zinc-800">{formatLastRun(data.lastRun)}</div>
        </div>
      </div>

      {/* 성공률 진행 바 */}
      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-500">전체 통과율</span>
          <span className={`text-sm font-bold ${rateColor(data.rate)}`}>{data.rate}%</span>
        </div>
        <div className="w-full bg-zinc-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${rateBarClass(data.rate)}`}
            style={{ width: `${data.rate}%` }}
          />
        </div>
        <div className="text-[10px] text-zinc-400 mt-1.5">
          자동화된 시스템 점검 — 50개 항목을 자동으로 검증합니다
        </div>
      </div>

      {/* 비정상 상태 설명 */}
      {data.rate < 100 && (
        <div className={`p-4 rounded-xl border ${
          data.rate < 80 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className={`text-sm font-semibold mb-1 ${data.rate < 80 ? 'text-rose-800' : 'text-amber-800'}`}>
            {data.rate < 80 ? '🔴 심각: 여러 핵심 기능이 정상 동작하지 않습니다. 즉시 확인 필요.' : '🟡 일부 테스트 실패 — 아래 항목을 확인하세요'}
          </div>
          <div className={`text-xs ${data.rate < 80 ? 'text-rose-700' : 'text-amber-700'}`}>
            실패 항목 <strong>{data.total - data.passed}개</strong> — E2E는 자동화된 시스템 점검입니다.
          </div>
        </div>
      )}

      {/* 실패 목록 */}
      {data.failures?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">실패 항목</div>
          <div className="flex flex-wrap gap-1.5">
            {data.failures.slice(0, 10).map((f, i) => (
              <span key={i} className="px-2.5 py-1 bg-rose-100 text-rose-700 text-[11px] font-medium rounded-full border border-rose-200">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 로그 뷰어 */}
      <LogViewer service="e2e-test" />

      <ActionResult result={result} onClose={clearResult} />

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run('run_cron', { task: 'e2e-test' })}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Play size={14} /> E2E 재실행
        </button>
        <button
          onClick={() => run('claude_fix', {
            context: `E2E 테스트 결과: ${data.passed}/${data.total} 통과 (${data.rate}%)\n실패 항목: ${data.failures.join(', ')}\n원인을 분석하고 해결책을 제시해주세요.`,
            title: 'E2E 실패 분석',
          })}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Bot size={14} /> Claude 분석
        </button>
      </div>
    </div>
  );
}
