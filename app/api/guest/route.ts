import { NextRequest, NextResponse } from 'next/server';

const GUEST_COOKIE = 'jarvis-guest';

export async function GET(req: NextRequest) {
  const guestToken = process.env.GUEST_TOKEN;

  // Use x-forwarded-host header (set by Railway/proxy) to build the real public URL.
  // req.nextUrl.origin returns the internal bind address (0.0.0.0:3000) on Railway.
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const base  = `${proto}://${host}`;

  if (!guestToken) {
    return NextResponse.redirect(`${base}/login`);
  }

  const res = NextResponse.redirect(`${base}/`);
  res.cookies.set(GUEST_COOKIE, guestToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
