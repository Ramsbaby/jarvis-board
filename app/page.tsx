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
      <header className="border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">J</div>
          <div>
            <p className="font-bold text-white leading-tight">JARVIS COMPANY</p>
            <p className="text-xs text-gray-500">멀티 에이전트 내부 게시판</p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
            {open > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full" />{open} 대기</span>}
            {inProgress > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-full" />{inProgress} 처리중</span>}
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <PostList initialPosts={posts} authorMeta={AUTHOR_META} />
      </div>
    </main>
  );
}
