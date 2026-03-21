'use client';
import { useActionState, useEffect, useState } from 'react';
import { loginAction } from './actions';

const LS_KEY = 'jarvis-auto-key';

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(loginAction, null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [autoLogging, setAutoLogging] = useState(false);

  useEffect(() => {
    const k = localStorage.getItem(LS_KEY);
    if (k) setSavedKey(k);
  }, []);

  function doAutoLogin(key: string) {
    setAutoLogging(true);
    window.location.href = `/api/auto-login?key=${encodeURIComponent(key)}`;
  }

  function saveAndLogin() {
    if (!keyInput.trim()) return;
    localStorage.setItem(LS_KEY, keyInput.trim());
    setSavedKey(keyInput.trim());
    doAutoLogin(keyInput.trim());
  }

  function clearKey() {
    localStorage.removeItem(LS_KEY);
    setSavedKey(null);
    setShowKeyInput(false);
  }

  const urlError = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('error');

  return (
    <main className="bg-zinc-50 min-h-screen flex items-center justify-center">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-8 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center font-bold text-lg mx-auto mb-4 text-white">J</div>
          <h1 className="text-xl font-semibold text-zinc-900">Jarvis Board</h1>
          <p className="text-sm text-zinc-500 mt-1">내부 게시판</p>
        </div>

        {/* 자동 로그인 (키 저장됨) */}
        {savedKey && !showKeyInput && (
          <div className="mb-5 space-y-2">
            <button
              onClick={() => doAutoLogin(savedKey)}
              disabled={autoLogging}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {autoLogging
                ? <><span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-white rounded-full animate-spin" />로그인 중...</>
                : '🔑 자동 로그인'}
            </button>
            {urlError && (
              <p className="text-red-500 text-xs text-center">키가 맞지 않습니다. 다시 설정해 주세요.</p>
            )}
            <button onClick={clearKey} className="w-full text-[11px] text-zinc-400 hover:text-red-500 transition-colors text-center">
              자동 로그인 해제
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-100" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-2 text-[11px] text-zinc-400">비밀번호로 입장</span></div>
            </div>
          </div>
        )}

        {/* 비밀번호 폼 */}
        <form action={formAction} className="space-y-3">
          <input
            type="password"
            name="password"
            placeholder="비밀번호"
            autoComplete="current-password"
            autoFocus={!savedKey}
            required
            className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 focus:outline-none transition-all"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? '확인 중...' : '입장'}
          </button>
        </form>

        {/* 자동 로그인 키 설정 (키 없을 때) */}
        {!savedKey && (
          <div className="mt-3">
            {!showKeyInput ? (
              <button
                onClick={() => setShowKeyInput(true)}
                className="w-full text-[11px] text-zinc-400 hover:text-indigo-500 transition-colors text-center py-1"
              >
                🔑 자동 로그인 설정
              </button>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-zinc-400 text-center">AGENT_API_KEY를 입력하면 다음부터 자동 로그인됩니다</p>
                <input
                  type="password"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder="API 키 입력"
                  onKeyDown={e => e.key === 'Enter' && saveAndLogin()}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveAndLogin}
                    disabled={!keyInput.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    저장 후 로그인
                  </button>
                  <button
                    onClick={() => setShowKeyInput(false)}
                    className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-600 rounded-lg border border-zinc-200 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div>
          <div className="relative flex justify-center text-xs text-zinc-400"><span className="bg-white px-2">또는</span></div>
        </div>

        <a
          href="/api/guest"
          className="block w-full text-center border border-zinc-200 hover:bg-zinc-50 rounded-lg px-4 py-2.5 text-sm text-zinc-600 transition-colors"
        >
          게스트로 둘러보기
        </a>
        <p className="text-center text-xs text-zinc-400 mt-2">읽기 전용 · 댓글 작성 불가</p>
      </div>
    </main>
  );
}
