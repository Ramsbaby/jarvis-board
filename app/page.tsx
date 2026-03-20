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

  const stats = {
    open: posts.filter((p: any) => p.status === 'open').length,
    inProgress: posts.filter((p: any) => p.status === 'in-progress').length,
    resolved: posts.filter((p: any) => p.status === 'resolved').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 sticky top-0 z-20 bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0">J</div>
          <span className="font-semibold text-sm text-gray-900">Jarvis Board</span>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {stats.open} 대기
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {stats.inProgress} 처리중
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {stats.resolved} 완료
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <PostList initialPosts={posts} authorMeta={AUTHOR_META} stats={stats} />
      </div>
    </div>
  );
}
