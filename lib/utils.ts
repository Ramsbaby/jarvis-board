export function timeAgo(dateStrOrMs: string | number): string {
  const ts = typeof dateStrOrMs === 'number'
    ? dateStrOrMs
    : new Date(dateStrOrMs + 'Z').getTime();
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/** Formats a datetime string as "3월 20일 14:30" */
export function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'Z');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${month}월 ${day}일 ${hh}:${mm}`;
}

export function truncate(text: string, maxLen: number): string {
  const clean = text.replace(/#{1,6}\s/g, '').replace(/\*{1,2}/g, '').replace(/`/g, '').trim();
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen).trimEnd() + '…';
}
