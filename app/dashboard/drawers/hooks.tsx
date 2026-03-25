'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, Terminal, CheckCircle2, AlertTriangle, X } from 'lucide-react';

// ── useAction ─────────────────────────────────────────────────────────────────
export function useAction() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const run = useCallback(async (type: string, params: Record<string, unknown> = {}) => {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, params }),
      });
      const d = await r.json();
      setResult({ ok: d.ok !== false, message: d.message || d.error || (r.ok ? '완료' : '실패') });
    } catch {
      setResult({ ok: false, message: '네트워크 오류' });
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, result, run, clearResult: () => setResult(null) };
}

// ── ActionResult ─────────────────────────────────────────────────────────────
export function ActionResult({ result, onClose }: { result: { ok: boolean; message: string } | null; onClose: () => void }) {
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

// ── useServiceLogs ─────────────────────────────────────────────────────────
export function useServiceLogs(service: string | null) {
  const [lines, setLines] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const fetch_ = useCallback(async () => {
    if (!service) return;
    setFetching(true);
    try {
      const r = await fetch(`/api/admin/logs?service=${encodeURIComponent(service)}&lines=100`);
      const d = await r.json();
      if (d.lines) {
        setLines(d.lines);
        setTimeout(() => {
          if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
        }, 50);
      }
    } catch { /* ignore */ }
    finally { setFetching(false); }
  }, [service]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { lines, fetching, refresh: fetch_, logRef };
}

// ── LogViewer ─────────────────────────────────────────────────────────────
function colorLine(line: string): string {
  if (/SUCCESS|DONE|PASS/i.test(line)) return 'text-emerald-400';
  if (/FAILED|ABORTED|ERROR|FAIL/i.test(line)) return 'text-rose-400';
  if (/START|INFO/i.test(line)) return 'text-blue-400';
  if (/WARN|SKIP|CB_OPEN/i.test(line)) return 'text-amber-400';
  return 'text-zinc-400';
}

export function LogViewer({ service, title = '최근 로그' }: { service: string; title?: string }) {
  const { lines, fetching, refresh, logRef } = useServiceLogs(service);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
          <Terminal size={12} /> {title}
        </span>
        <button onClick={refresh} disabled={fetching}
          className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1 transition-colors">
          <RefreshCw size={11} className={fetching ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>
      <div ref={logRef} className="bg-zinc-950 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5">
        {lines.length === 0 ? (
          <div className="text-zinc-600 italic">{fetching ? '로딩 중...' : '로그 없음'}</div>
        ) : (
          lines.map((line, i) => <div key={i} className={colorLine(line)}>{line}</div>)
        )}
      </div>
    </div>
  );
}

// ── Sparkline (SVG, no deps) ──────────────────────────────────────────────
export function Sparkline({ data, color = '#10b981', width = 80, height = 24 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 2) - 1}`
  ).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── HBar (horizontal bar, CSS) ────────────────────────────────────────────
export function HBar({ label, value, max, colorClass = 'bg-blue-500', subtitle }: {
  label: string; value: number; max: number; colorClass?: string; subtitle?: string;
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-24 shrink-0">
        <div className="text-xs text-zinc-700 truncate font-medium">{label}</div>
        {subtitle && <div className="text-[10px] text-zinc-400 truncate">{subtitle}</div>}
      </div>
      <div className="flex-1 bg-zinc-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-600 w-8 text-right shrink-0">{value.toLocaleString()}</span>
    </div>
  );
}

// ── StatGrid ──────────────────────────────────────────────────────────────
export function StatGrid({ items }: { items: Array<{ label: string; value: string | number; sub?: string; color?: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, i) => (
        <div key={i} className="p-3 bg-zinc-50 rounded-xl">
          <div className="text-[11px] text-zinc-500 mb-0.5">{item.label}</div>
          <div className={`text-lg font-bold ${item.color ?? 'text-zinc-900'}`}>{item.value}</div>
          {item.sub && <div className="text-[10px] text-zinc-400 mt-0.5">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── useDetailData (lazy loader for /api/dashboard/detail) ─────────────────
export function useDetailData<T>(type: string, params?: Record<string, string>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ type, ...params }).toString();
    fetch(`/api/dashboard/detail?${qs}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, JSON.stringify(params)]);

  return { data, loading, error };
}

// ── LoadingState ─────────────────────────────────────────────────────────
export function LoadingState({ error }: { error?: string | null }) {
  if (error) return (
    <div className="p-6 text-sm text-rose-600 bg-rose-50 rounded-xl">{error}</div>
  );
  return (
    <div className="p-6 flex items-center gap-3 text-zinc-400 text-sm">
      <span className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
      불러오는 중...
    </div>
  );
}
