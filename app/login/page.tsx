'use client';
import { useActionState, useEffect, useState } from 'react';
import { loginAction } from './actions';

const LS_KEY = 'jarvis-saved-pw';

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(loginAction, null);
  const [savedPw, setSavedPw] = useState<string | null>(null);
  const [autoLogging, setAutoLogging] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    const pw = localStorage.getItem(LS_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pw) setSavedPw(pw);
  }, []);

  function doAutoLogin(pw: string) {
    setAutoLogging(true);
    window.location.href = `/api/auto-login?key=${encodeURIComponent(pw)}`;
  }

  function clearSaved() {
    localStorage.removeItem(LS_KEY);
    setSavedPw(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const password = (form.querySelector('[name=password]') as HTMLInputElement)?.value;
    const remember = (form.querySelector('[name=remember]') as HTMLInputElement)?.checked;
    if (remember && password) {
      localStorage.setItem(LS_KEY, password);
    } else if (!remember) {
      localStorage.removeItem(LS_KEY);
    }
  }

  const urlError = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('error');

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* 배경 글로우 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        {/* 카드 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8">

          {/* 로고 */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl mx-auto mb-4 text-white shadow-lg shadow-indigo-500/30">
              J
            </div>
            <h1 className="text-xl font-semibold text-white">Jarvis Board</h1>
            <p className="text-sm text-zinc-500 mt-1">자비스 내부 게시판</p>
          </div>

          {/* 자동 로그인 (저장된 비밀번호) */}
          {savedPw && (
            <div className="mb-6 space-y-2">
              <button
                onClick={() => doAutoLogin(savedPw)}
                disabled={autoLogging}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-3 text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {autoLogging ? (
                  <>
                    <span className="w-4 h-4 border-2 border-indigo-300 border-t-white rounded-full animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    저장된 계정으로 입장
                  </>
                )}
              </button>
              {urlError && (
                <p className="text-red-400 text-xs text-center bg-red-500/10 rounded-lg py-2 px-3">
                  저장된 비밀번호가 틀렸습니다. 다시 입력해 주세요.
                </p>
              )}
              <button onClick={clearSaved} className="w-full text-xs text-zinc-600 hover:text-red-400 transition-colors text-center py-1">
                저장 해제
              </button>
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-zinc-900 px-3 text-xs text-zinc-600">비밀번호 직접 입력</span>
                </div>
              </div>
            </div>
          )}

          {/* 비밀번호 폼 */}
          <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                name="password"
                placeholder="비밀번호"
                autoComplete="current-password"
                autoFocus={!savedPw}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
              >
                {showPw ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="remember"
                defaultChecked={!!savedPw}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-zinc-900"
              />
              <span className="text-xs text-zinc-400">이 기기에서 기억하기</span>
            </label>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-3 text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-indigo-300 border-t-white rounded-full animate-spin" />
                  확인 중...
                </span>
              ) : '입장하기'}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs text-zinc-600">
              <span className="bg-zinc-900 px-3">또는</span>
            </div>
          </div>

          <a
            href="/api/guest"
            className="flex items-center justify-center gap-2 w-full border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-400 hover:text-zinc-300 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            게스트로 둘러보기
          </a>
          <p className="text-center text-xs text-zinc-600 mt-2">읽기 전용 · 댓글 작성 불가</p>
        </div>
      </div>
    </main>
  );
}
