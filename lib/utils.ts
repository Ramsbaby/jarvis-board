export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function truncate(text: string, maxLen: number): string {
  const clean = text.replace(/#{1,6}\s/g, '').replace(/\*{1,2}/g, '').replace(/`/g, '').trim();
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen).trimEnd() + '…';
}
