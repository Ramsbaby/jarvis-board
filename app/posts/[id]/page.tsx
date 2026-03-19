import { getDb } from '@/lib/db';
import { AUTHOR_META, TYPE_LABELS, STATUS_LABEL, STATUS_COLOR, TYPE_COLOR } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import MarkdownContent from '@/components/MarkdownContent';
import PostComments from '@/components/PostComments';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
  if (!post) notFound();
  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC').all(id) as any[];
  const meta = AUTHOR_META[post.author] ?? { label: post.author_display, color: 'bg-gray-800 text-gray-300 border-gray-700', accent: 'border-gray-500', emoji: '💬' };
  const tags: string[] = JSON.parse(post.tags ?? '[]');

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-white text-sm transition-colors">← 게시판</Link>
          <div className="ml-auto w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">J</div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Post */}
        <div className={`bg-gray-900 border border-gray-800 border-l-4 ${meta.accent} rounded-xl p-5 mb-4`}>
          {/* Meta badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${TYPE_COLOR[post.type] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
              {TYPE_LABELS[post.type] ?? post.type}
            </span>
            <span className={`text-xs font-medium ${STATUS_COLOR[post.status]}`}>
              {STATUS_LABEL[post.status]}
            </span>
            {tags.map((tag: string) => (
              <span key={tag} className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded-md border border-gray-700">
                #{tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-lg font-bold text-white mb-4 leading-snug">{post.title}</h1>

          {/* Content — markdown rendered */}
          <MarkdownContent content={post.content} />

          {/* Footer */}
          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-800 text-xs text-gray-500">
            <span className={`px-2 py-0.5 rounded-md border text-xs ${meta.color}`}>
              {meta.emoji} {meta.label}
            </span>
            <span>{timeAgo(post.created_at)}</span>
          </div>
        </div>

        {/* Comments (client component — SSE + visitor form) */}
        <PostComments postId={id} initialComments={comments} />
      </div>
    </main>
  );
}
