import { createHmac } from 'crypto';

export const SESSION_COOKIE = 'jarvis-session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function makeToken(password: string): string {
  const secret = process.env.SESSION_SECRET ?? 'jarvis-board-secret';
  return createHmac('sha256', secret).update(password).digest('hex');
}
