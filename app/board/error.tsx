'use client';

export default function BoardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="p-8 text-center">
      <p className="mb-3 text-sm text-zinc-600">논의 목록을 불러오지 못했습니다. 다시 시도해주세요.</p>
      <button type="button" onClick={reset} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-600">
        다시 시도
      </button>
    </div>
  );
}
