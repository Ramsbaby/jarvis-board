import { existsSync, readFileSync } from 'fs';

/**
 * 파일을 안전하게 읽기. 존재하지 않거나 오류 시 빈 문자열 반환.
 * maxBytes 이상이면 뒤쪽(tail)만 반환.
 */
export function safeRead(file: string, maxBytes = 128_000): string {
  try {
    if (!existsSync(file)) return '';
    const buf = readFileSync(file, 'utf8');
    return buf.length > maxBytes ? buf.slice(-maxBytes) : buf;
  } catch {
    return '';
  }
}

/**
 * 텍스트의 마지막 N줄만 반환.
 */
export function tailLines(text: string, n: number): string {
  if (!text) return '';
  const lines = text.split('\n').filter(Boolean);
  return lines.slice(-n).join('\n');
}
