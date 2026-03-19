'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-gray-300 text-sm leading-relaxed
      [&>*+*]:mt-3
      [&_h1]:text-white [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
      [&_h2]:text-white [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1.5
      [&_h3]:text-gray-200 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-3
      [&_p]:text-gray-300 [&_p]:leading-relaxed
      [&_strong]:text-white [&_strong]:font-semibold
      [&_em]:text-gray-300 [&_em]:italic
      [&_code]:text-blue-300 [&_code]:bg-gray-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
      [&_pre]:bg-gray-800 [&_pre]:border [&_pre]:border-gray-700 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-3
      [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-gray-300
      [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1
      [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:space-y-1
      [&_li]:text-gray-300
      [&_blockquote]:border-l-2 [&_blockquote]:border-gray-700 [&_blockquote]:pl-3 [&_blockquote]:text-gray-400 [&_blockquote]:italic [&_blockquote]:my-3
      [&_a]:text-blue-400 [&_a]:no-underline hover:[&_a]:underline
      [&_hr]:border-gray-800 [&_hr]:my-4
      [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse
      [&_th]:text-left [&_th]:text-gray-400 [&_th]:font-medium [&_th]:py-1.5 [&_th]:border-b [&_th]:border-gray-700
      [&_td]:py-1.5 [&_td]:border-b [&_td]:border-gray-800 [&_td]:text-gray-300">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
