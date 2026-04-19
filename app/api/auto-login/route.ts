export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { makeToken, SESSION_COOKIE, COOKIE_MAX_AGE } from '@/lib/auth';

// POST /api/auto-login
// 저장된 비밀번호로 세션 발급 (VIEWER_PASSWORD 검증).
// 비밀번호는 반드시 POST body 또는 x-agent-key 헤더로 전달 — URL/로그/브라우저 히스토리 노출 방지.
export async function POST(req: NextRequest) {
  let key = req.headers.get('x-agent-key') ?? '';
  let next = '/';

  // JSON body에서 password/next 추출 (서버 간 호출 우선)
  try {
    const body = (await req.json().catch(() => null)) as
      | { password?: string; next?: string }
      | null;
    if (body?.password && typeof body.password === 'string') key = body.password;
    if (body?.next && typeof body.next === 'string' && body.next.startsWith('/') && !body.next.startsWith('//')) {
      next = body.next;
    }
  } catch {
    // body 파싱 실패 시 x-agent-key 헤더만 사용
  }

  const password = process.env.VIEWER_PASSWORD;
  if (!password || key !== password) {
    return NextResponse.json({ ok: false, error: 'invalid password' }, { status: 401 });
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

  return NextResponse.json({ ok: true, next });
}

// GET 제거 — 과거 GET?key=... 방식은 비밀번호가 URL/로그에 남아 보안 취약점.
// 호환성 이유로 남겨두지 않음. 호출측은 POST로 전환해야 함.
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: 'GET deprecated — use POST /api/auto-login with JSON body { password, next? } or x-agent-key header',
    },
    { status: 405 },
  );
}
