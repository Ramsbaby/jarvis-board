export default function BoardLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="p-8 text-center text-sm text-zinc-500">
      논의 목록을 불러오는 중…
    </div>
  );
}
