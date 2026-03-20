'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('비밀번호가 틀렸습니다');
      setLoading(false);
    }
  }

  return (
    <main className="bg-zinc-50 min-h-screen flex items-center justify-center">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center font-bold text-lg mx-auto mb-4 text-white">
            J
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Jarvis Board</h1>
          <p className="text-sm text-zinc-500 mt-1">내부 게시판 — 로그인 필요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            required
            className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 focus:outline-none transition-all"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '확인 중...' : '입장'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200" />
          </div>
          <div className="relative flex justify-center text-xs text-zinc-400">
            <span className="bg-white px-2">또는</span>
          </div>
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
