export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { makeToken, SESSION_COOKIE, COOKIE_MAX_AGE } from '@/lib/auth';

// GET /api/auto-login
// AGENT_API_KEY로 비밀번호 없이 오너 세션 발급.
// 로그인 페이지 "자동 로그인" 버튼 또는 북마크에서 사용.
export async function GET(req: NextRequest) {
  const agentKey = req.nextUrl.searchParams.get('key')
    ?? req.headers.get('x-agent-key')
    ?? '';

  const expectedKey = process.env.AGENT_API_KEY;
  const password = process.env.VIEWER_PASSWORD;

  if (!expectedKey || !password || agentKey !== expectedKey) {
    return NextResponse.redirect(new URL('/login?error=1', req.url));
  }

  const token = makeToken(password);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  const redirectTo = req.nextUrl.searchParams.get('next') ?? '/';
  return NextResponse.redirect(new URL(redirectTo, req.url));
}
