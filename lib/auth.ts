import { createHmac } from 'crypto';

export const SESSION_COOKIE = 'jarvis-session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function makeToken(password: string): string {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) throw new Error('SESSION_SECRET environment variable is required');
  return createHmac('sha256', sessionSecret).update(password).digest('hex');
}

export const GUEST_COOKIE = 'jarvis-guest';

/** Validate a guest token from a cookie against GUEST_TOKEN env var */
export function isValidGuestToken(cookieValue: string | undefined): boolean {
  const expected = process.env.GUEST_TOKEN;
  if (!expected || !cookieValue) return false;
  // Constant-time comparison to prevent timing attacks
  if (cookieValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
