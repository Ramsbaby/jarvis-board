'use client';
import { useState, useCallback } from 'react';
import { Bot, AlertTriangle, CheckCircle2, X } from 'lucide-react';

// ── Inline useAction (will be replaced by ./hooks import on integration) ────────

function useAction() {
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

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ErrorsDrawerData {
  total24h: number;
  totalAll: number;
  topErrors: Array<{ msg: string; count: number }>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

type ErrorLevel = 'ok' | 'warn' | 'critical';

function errorLevel(count: number): ErrorLevel {
  if (count >= 20) return 'critical';
  if (count >= 5) return 'warn';
  return 'ok';
}

const levelStyles: Record<ErrorLevel, { badge: string; box: string; text: string; border: string }> = {
  ok: {
    badge: 'bg-emerald-100 text-emerald-700',
    box:   'bg-emerald-50',
    text:  'text-emerald-800',
    border: 'border-emerald-200',
  },
  warn: {
    badge: 'bg-amber-100 text-amber-700',
    box:   'bg-amber-50',
    text:  'text-amber-800',
    border: 'border-amber-200',
  },
  critical: {
    badge: 'bg-rose-100 text-rose-700',
    box:   'bg-rose-50',
    text:  'text-rose-800',
    border: 'border-rose-200',
  },
};

// ── ErrorsContent ───────────────────────────────────────────────────────────────

export function ErrorsContent({ data }: { data: ErrorsDrawerData }) {
  const { loading, result, run, clearResult } = useAction();
  const level = errorLevel(data.total24h);
  const styles = levelStyles[level];
  const topErrors = data.topErrors.slice(0, 8);
  const maxCount = Math.max(...topErrors.map((e) => e.count), 1);

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* 안내 박스 */}
      {(() => {
        const count24h = data.total24h ?? 0;
        if (count24h === 0) return (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
            <div className="text-sm font-bold text-emerald-800 mb-1">✓ 오류 없음</div>
            <div className="text-xs text-emerald-700">지난 24시간 오류가 없습니다. 아무것도 안 해도 됩니다.</div>
          </div>
        );
        if (count24h > 20) return (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl mb-4">
            <div className="text-sm font-bold text-rose-900 mb-1">🚨 오류가 매우 많습니다</div>
            <div className="text-xs text-rose-700 leading-relaxed">
              24시간 내 <strong>{count24h}건의 오류</strong>가 발생했습니다. 시스템에 심각한 문제가 있을 수 있습니다.<br/>
              <strong>→ 아래 주요 오류를 확인하고 &apos;수정 요청&apos; 버튼으로 즉시 Jarvis에게 맡겨주세요.</strong>
            </div>
          </div>
        );
        if (count24h > 5) return (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
            <div className="text-sm font-bold text-amber-900 mb-1">⚠️ 오류가 다소 많습니다</div>
            <div className="text-xs text-amber-700 leading-relaxed">
              24시간 내 <strong>{count24h}건의 오류</strong>가 발생했습니다.<br/>
              → 아래 오류 목록을 확인하고, 반복되는 오류는 <strong>수정 요청</strong>으로 Jarvis에게 맡기세요.
            </div>
          </div>
        );
        return (
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-4">
            <div className="text-sm font-bold text-amber-800 mb-1">⚠️ 소수의 오류 감지</div>
            <div className="text-xs text-amber-700 leading-relaxed">
              24시간 내 <strong>{count24h}건</strong>. 급하지 않지만 아래 오류 내용을 확인하세요.
            </div>
          </div>
        );
      })()}

      {/* 1. 오버뷰 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-4 rounded-xl border ${styles.box} ${styles.border}`}>
          <div className={`text-[11px] font-medium mb-1 ${styles.text}`}>24시간 오류</div>
          <span className={`inline-block px-2.5 py-1 rounded-full text-sm font-bold ${styles.badge}`}>
            {data.total24h}건
          </span>
        </div>
        <div className="p-4 rounded-xl border border-zinc-100 bg-zinc-50">
          <div className="text-[11px] font-medium text-zinc-500 mb-1">누적 오류</div>
          <span className="inline-block px-2.5 py-1 rounded-full text-sm font-bold bg-zinc-200 text-zinc-600">
            {data.totalAll}건
          </span>
        </div>
      </div>

      {/* 2. 비정상 판단 설명 */}
      {data.total24h > 5 && (
        <div className={`p-4 rounded-xl border ${styles.box} ${styles.border}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className={`${styles.text} mt-0.5 shrink-0`} />
            <div className="space-y-1">
              <div className={`text-sm font-semibold ${styles.text}`}>
                24시간 내 {data.total24h}건의 오류가 발생했습니다
              </div>
              <p className={`text-xs leading-relaxed ${styles.text} opacity-80`}>
                정상: 5건 미만 &nbsp;/&nbsp; 주의: 5~20건 &nbsp;/&nbsp; 위험: 20건 초과
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. 상위 오류 목록 */}
      {topErrors.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            반복 오류 패턴
          </div>
          <div className="space-y-3">
            {topErrors.map((err, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-xs text-zinc-700 truncate">
                    {err.msg.length > 60 ? err.msg.slice(0, 60) + '…' : err.msg}
                  </span>
                  <span className="inline-block shrink-0 px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700">
                    {err.count}회
                  </span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-1.5">
                  <div
                    className="bg-rose-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${(err.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 분석 안내 */}
      {data.total24h > 0 && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="text-sm font-semibold text-blue-800 mb-1">오류 분석 방법</div>
          <p className="text-xs text-blue-700">
            Claude에게 분석을 요청하면 로그에서 원인을 찾아드립니다.
          </p>
        </div>
      )}

      {/* Action result */}
      {result && (
        <div
          className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
            result.ok
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{result.message}</span>
          <button onClick={clearResult} className="text-current opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 5. 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            run('claude_fix', {
              context: `Jarvis 시스템 오류 분석 요청:\n- 24시간 오류: ${data.total24h}건\n- 상위 오류: ${data.topErrors
                .slice(0, 3)
                .map((e) => e.msg)
                .join(', ')}\n\n~/.jarvis/logs/error-tracker.json 파일을 분석해서 원인과 해결책을 알려주세요.`,
              title: '오류 로그 분석',
            })
          }
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Bot size={14} /> 로그 분석
        </button>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-400 self-center animate-pulse">
            분석 중...
          </span>
        )}
      </div>
    </div>
  );
}
