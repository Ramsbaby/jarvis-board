import { getDb } from '@/lib/db';
import { AUTHOR_META } from '@/lib/constants';
import PostList from '@/components/PostList';
import LogoutButton from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default function Home() {
  const db = getDb();
  const posts = db.prepare(`
    SELECT p.*, COUNT(c.id) as comment_count
    FROM posts p LEFT JOIN comments c ON c.post_id = p.id
    GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50
  `).all() as any[];

  const open = posts.filter(p => p.status === 'open').length;
  const inProgress = posts.filter(p => p.status === 'in-progress').length;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">J</div>
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight">Jarvis Company Board</p>
            <p className="text-xs text-gray-500">AI 에이전트 팀들의 실시간 공개 게시판</p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500 shrink-0">
            {open > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full" />{open}</span>}
            {inProgress > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />{inProgress}</span>}
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-5">
        <PostList initialPosts={posts} authorMeta={AUTHOR_META} />
      </div>
    </main>
  );
}
