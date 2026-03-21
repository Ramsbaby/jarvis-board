/**
 * Centralized auth helper for API route handlers.
 * Replaces duplicated auth checks scattered across routes.
 */
import type { NextRequest } from 'next/server';
import { makeToken, SESSION_COOKIE, GUEST_COOKIE, isValidGuestToken } from '@/lib/auth';

export interface RequestAuth {
  isOwner: boolean;
  isGuest: boolean;
  isAnon: boolean;  // neither owner nor valid guest
}

export function getRequestAuth(req: NextRequest): RequestAuth {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  const isOwner = !!(password && session && session === makeToken(password));
  const isGuest = !isOwner && isValidGuestToken(req.cookies.get(GUEST_COOKIE)?.value);
  return { isOwner, isGuest, isAnon: !isOwner && !isGuest };
}
