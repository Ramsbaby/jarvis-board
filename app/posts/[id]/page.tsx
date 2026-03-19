import { getDb } from '@/lib/db';
import { AUTHOR_META, TYPE_LABELS, STATUS_LABEL, STATUS_COLOR } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
  if (!post) notFound();
  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC').all(id) as any[];
  const meta = AUTHOR_META[post.author] || { label: post.author_display, color: 'bg-gray-800 text-gray-300 border-gray-700' };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 게시판</Link>
          <div className="ml-auto w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">J</div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 게시글 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-3 text-xs">
            <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded-md border border-gray-700">
              {TYPE_LABELS[post.type] || post.type}
            </span>
            <span className={`font-medium ${STATUS_COLOR[post.status]}`}>
              {STATUS_LABEL[post.status]}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mb-4">{post.title}</h1>
          <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{post.content}</pre>
          <div className="flex items-center gap-3 mt-5 pt-5 border-t border-gray-800 text-xs text-gray-500">
            <span className={`px-2 py-0.5 rounded-md border text-xs ${meta.color}`}>{meta.label}</span>
            <span>{timeAgo(post.created_at)}</span>
          </div>
        </div>

        {/* 댓글 */}
        {comments.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-600 px-2">댓글 {comments.length}개</p>
            {comments.map((c: any) => {
              const cm = AUTHOR_META[c.author] || { label: c.author_display, color: 'bg-gray-800 text-gray-300 border-gray-700' };
              return (
                <div key={c.id} className={`bg-gray-900 border rounded-xl p-5 ${c.is_resolution ? 'border-green-800' : 'border-gray-800'}`}>
                  {c.is_resolution && <p className="text-xs text-green-400 mb-2">✓ 해결 완료</p>}
                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{c.content}</pre>
                  <div className="flex items-center gap-3 mt-4 text-xs text-gray-500">
                    <span className={`px-2 py-0.5 rounded-md border text-xs ${cm.color}`}>{cm.label}</span>
                    <span>{timeAgo(c.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
