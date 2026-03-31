'use client';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { normalizeMetricsHistory, type MetricsHistoryPoint } from '@/lib/metrics';

type MetricKey = 'memoryUsage' | 'diskUsage' | 'cpuLoad';

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; unit: string; domain?: [number, number] }> = {
  memoryUsage: { label: '메모리 사용률', color: '#6366f1', unit: '%', domain: [0, 100] },
  diskUsage:   { label: '디스크 사용률', color: '#f59e0b', unit: '%', domain: [0, 100] },
  cpuLoad:     { label: 'CPU 부하',     color: '#10b981', unit: '' },
};

export default function DashboardChart() {
  const [data, setData] = useState<MetricsHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey>('memoryUsage');

  useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      try {
        const res = await fetch('/api/system-metrics/history?hours=24&maxPoints=60');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          if (json.ok && Array.isArray(json.metrics) && json.metrics.length > 0) {
            setData(normalizeMetricsHistory(json.metrics));
            setError(null);
          } else {
            setData([]);
            setError(json.message || '데이터 없음');
          }
        }
      } catch {
        if (!cancelled) {
          setData([]);
          setError('메트릭 히스토리를 불러올 수 없습니다');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHistory();
    const interval = setInterval(fetchHistory, 5 * 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const cfg = METRIC_CONFIG[metric];
  // 데이터가 없을 때 빈 차트(0% 상태)로 표시하기 위한 폴백 데이터
  const fallbackData: MetricsHistoryPoint[] = !loading && data.length === 0 && !error
    ? [{ time: '00:00', memoryUsage: 0, diskUsage: 0, cpuLoad: 0, processCount: 0 },
       { time: 'now', memoryUsage: 0, diskUsage: 0, cpuLoad: 0, processCount: 0 }]
    : [];
  const chartData = data.length > 0 ? data : fallbackData;
  const isEmpty = chartData.length === 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>📊</span>
          <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">시스템 추이 (24h)</span>
        </div>
        <div className="flex gap-1">
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map(key => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                metric === key
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {METRIC_CONFIG[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[140px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-zinc-400">
            불러오는 중...
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <p className="text-xs text-zinc-400">{error || '표시할 데이터가 없습니다'}</p>
            <p className="text-[10px] text-zinc-300">메트릭 수집이 시작되면 차트가 표시됩니다</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cfg.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: '#a1a1aa' }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={cfg.domain ?? ['auto', 'auto']}
                tick={{ fontSize: 9, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e4e4e7' }}
                formatter={(value) => [`${value ?? ''}${cfg.unit}`, cfg.label]}
                labelStyle={{ fontSize: 10, color: '#71717a' }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={cfg.color}
                strokeWidth={1.5}
                fill={`url(#grad-${metric})`}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
