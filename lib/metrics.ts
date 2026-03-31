// 시스템 메트릭 정규화 — null 처리와 차트가 같은 데이터 경로를 공유
export interface NormalizedMetrics {
  cpuLoad: number;       // load average (0~100 스케일 아님, raw)
  memoryUsage: number;   // %
  diskUsage: number;     // %
  processCount: number;
  networkOk: boolean;
  timestamp: string;     // ISO string
}

export interface RawProactiveMetric {
  timestamp?: number;
  date?: string;
  load_average?: number;
  memory_usage_pct?: number;
  disk_usage_pct?: number;
  process_count?: number;
  network_ok?: boolean;
  jarvis_processes?: number;
}

/**
 * proactive-monitor JSON → 정규화된 메트릭
 * null/undefined 필드는 0 또는 기본값으로 폴백
 */
export function normalizeProactiveMetric(raw: RawProactiveMetric | null): NormalizedMetrics {
  return {
    cpuLoad: raw?.load_average ?? 0,
    memoryUsage: raw?.memory_usage_pct ?? 0,
    diskUsage: raw?.disk_usage_pct ?? 0,
    processCount: raw?.process_count ?? 0,
    networkOk: raw?.network_ok ?? false,
    timestamp: raw?.date ?? new Date().toISOString(),
  };
}

/**
 * sysMetrics (대시보드 캐시) → 정규화된 메트릭
 */
export function normalizeSysMetrics(sm: {
  disk?: { used_pct?: number };
  health?: { memory_mb?: number };
  synced_at?: string;
} | null | undefined): NormalizedMetrics {
  return {
    cpuLoad: 0,
    memoryUsage: 0,
    diskUsage: sm?.disk?.used_pct ?? 0,
    processCount: 0,
    networkOk: true,
    timestamp: sm?.synced_at ?? new Date().toISOString(),
  };
}

/** 차트에서 사용할 시계열 포인트 */
export interface MetricsHistoryPoint {
  time: string;
  memoryUsage: number;
  diskUsage: number;
  cpuLoad: number;
  processCount: number;
}

/**
 * 히스토리 API 응답 배열 → 차트용 데이터 배열
 */
export function normalizeMetricsHistory(raw: RawProactiveMetric[]): MetricsHistoryPoint[] {
  return raw.map(m => {
    const n = normalizeProactiveMetric(m);
    // 시간 표시: "HH:MM" 형식
    let time = '';
    try {
      const d = new Date(n.timestamp.includes('Z') || n.timestamp.includes('+') ? n.timestamp : n.timestamp + '+09:00');
      time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      time = n.timestamp.slice(11, 16);
    }
    return {
      time,
      memoryUsage: Math.round(n.memoryUsage * 10) / 10,
      diskUsage: Math.round(n.diskUsage * 10) / 10,
      cpuLoad: Math.round(n.cpuLoad * 100) / 100,
      processCount: n.processCount,
    };
  });
}
