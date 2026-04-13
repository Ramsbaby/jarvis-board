/**
 * Cron expression → 사람 친화 문자열 변환.
 * api/crons/route.ts 와 프론트 팝업에서 공용.
 */

export function cronToHuman(expr: string): string {
  if (!expr) return '';
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  const pad = (v: string) => v.padStart(2, '0');

  // every N minutes
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `${min.slice(2)}분마다`;
  }
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return '매시 정각';
  if (min === '*' && hour === '*') return '매분';

  // fixed time
  const isFixedTime = /^\d+$/.test(min) && /^\d+$/.test(hour);
  const timeStr = isFixedTime ? `${pad(hour)}:${pad(min)}` : `${hour}시 ${min}분`;

  if (dom === '*' && mon === '*' && dow === '*') return `매일 ${timeStr}`;
  if (dom === '*' && mon === '*' && dow !== '*') {
    const dowMap: Record<string, string> = {
      '0': '일', '1': '월', '2': '화', '3': '수', '4': '목', '5': '금', '6': '토', '7': '일',
    };
    if (dow === '1-5') return `평일 ${timeStr}`;
    if (dow === '0,6' || dow === '6,0') return `주말 ${timeStr}`;
    const days = dow.split(',').map(d => dowMap[d] || d).join('·');
    return `매주 ${days} ${timeStr}`;
  }
  if (mon === '*' && dow === '*' && /^\d+$/.test(dom)) return `매월 ${dom}일 ${timeStr}`;
  return expr;
}
