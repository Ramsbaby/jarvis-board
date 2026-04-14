/**
 * 시스템 리소스 측정 헬퍼 (SSoT)
 *
 * 디스크 / 메모리 / CPU 수치를 단일 구현으로 통일.
 * 이전에는 statusline/route.ts 와 briefing/route.ts 가 각각 비슷한 헬퍼를
 * 중복 구현하고 있었다. 새 라우트가 추가될 때 구현이 드리프트할 위험이 있어
 * 여기로 모았다.
 *
 * 모든 함수는 실패 시 안전한 기본값을 반환한다 — throw 하지 않음.
 */

import { execSync } from 'child_process';

function safeExec(cmd: string, timeoutMs = 3000): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export interface DiskUsage {
  percent: number;
  used: string;
  total: string;
}

export interface MemoryUsage {
  percent: number;
  usedGb: number;
  totalGb: number;
}

export interface CpuUsage {
  usage: number;
  loadAvg: number;
}

export function getDiskUsage(): DiskUsage {
  const out = safeExec("df -h / | awk 'NR==2{print $3,$2,$5}'");
  if (!out) return { percent: 0, used: '?', total: '?' };
  const [used, total, pct] = out.split(/\s+/);
  return { percent: parseInt(pct) || 0, used: used || '?', total: total || '?' };
}

export function getMemoryUsage(): MemoryUsage {
  const out = safeExec('top -l 1 -n 0');
  if (!out) return { percent: 0, usedGb: 0, totalGb: 0 };
  // PhysMem: 14G used (2001M wired, 1555M compressor), 1958M unused.
  const m = out.match(/PhysMem:\s+(\d+)([GM])\s+used.*?(\d+)([GM])\s+unused/);
  if (!m) return { percent: 0, usedGb: 0, totalGb: 0 };
  const toGb = (n: string, u: string) => u === 'G' ? parseFloat(n) : parseFloat(n) / 1024;
  const used = toGb(m[1], m[2]);
  const unused = toGb(m[3], m[4]);
  const total = used + unused;
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  return { percent, usedGb: used, totalGb: total };
}

export function getCpuUsage(): CpuUsage {
  const out = safeExec('top -l 1 -n 0');
  if (!out) return { usage: 0, loadAvg: 0 };
  const cpuMatch = out.match(/CPU usage:\s+([\d.]+)%\s+user,\s+([\d.]+)%\s+sys,\s+([\d.]+)%\s+idle/);
  const loadMatch = out.match(/Load Avg:\s+([\d.]+)/);
  const idle = cpuMatch ? parseFloat(cpuMatch[3]) : 100;
  const usage = Math.round(100 - idle);
  const loadAvg = loadMatch ? parseFloat(loadMatch[1]) : 0;
  return { usage, loadAvg };
}

/**
 * 팀 브리핑 UI 가 구조화 drill-down 모달을 띄우기 위해 소비하는 형태.
 * label / value(%) / type 세 필드만으로 충분하다.
 */
export interface BriefingSystemMetric {
  label: string;
  value: number;
  icon: string;
  type: 'disk' | 'memory' | 'cpu';
}

/**
 * 전사 공통 시스템 메트릭 3종.
 * 모든 팀 브리핑 응답에 포함해서 CEO 가 어느 방을 클릭하든 동일한 건강 지표를
 * 즉시 확인할 수 있게 한다.
 */
export function getBriefingSystemMetrics(): BriefingSystemMetric[] {
  const disk = getDiskUsage();
  const mem = getMemoryUsage();
  const cpu = getCpuUsage();
  const out: BriefingSystemMetric[] = [];
  if (disk.percent > 0) out.push({ label: '디스크 사용률', value: disk.percent, icon: '💾', type: 'disk' });
  if (mem.percent > 0) out.push({ label: '메모리 사용률', value: mem.percent, icon: '🧠', type: 'memory' });
  if (cpu.usage > 0 || cpu.loadAvg > 0) out.push({ label: 'CPU 사용률', value: cpu.usage, icon: '⚡', type: 'cpu' });
  return out;
}
