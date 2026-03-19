'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { Element } from 'hast';

// Obsidian callout types → visual style
const CALLOUT: Record<string, { icon: string; border: string; bg: string; title: string }> = {
  note:      { icon: 'ℹ️',  border: 'border-blue-500/40',    bg: 'bg-blue-500/5',    title: 'text-blue-300' },
  info:      { icon: 'ℹ️',  border: 'border-blue-500/40',    bg: 'bg-blue-500/5',    title: 'text-blue-300' },
  abstract:  { icon: '📝', border: 'border-cyan-500/40',     bg: 'bg-cyan-500/5',    title: 'text-cyan-300' },
  summary:   { icon: '📝', border: 'border-cyan-500/40',     bg: 'bg-cyan-500/5',    title: 'text-cyan-300' },
  tip:       { icon: '💡', border: 'border-emerald-500/40',  bg: 'bg-emerald-500/5', title: 'text-emerald-300' },
  success:   { icon: '✅', border: 'border-emerald-500/40',  bg: 'bg-emerald-500/5', title: 'text-emerald-300' },
  check:     { icon: '✅', border: 'border-emerald-500/40',  bg: 'bg-emerald-500/5', title: 'text-emerald-300' },
  done:      { icon: '✅', border: 'border-emerald-500/40',  bg: 'bg-emerald-500/5', title: 'text-emerald-300' },
  warning:   { icon: '⚠️', border: 'border-amber-500/40',   bg: 'bg-amber-500/5',   title: 'text-amber-300' },
  caution:   { icon: '⚠️', border: 'border-amber-500/40',   bg: 'bg-amber-500/5',   title: 'text-amber-300' },
  attention: { icon: '⚠️', border: 'border-amber-500/40',   bg: 'bg-amber-500/5',   title: 'text-amber-300' },
  danger:    { icon: '🔴', border: 'border-red-500/40',      bg: 'bg-red-500/5',     title: 'text-red-300' },
  error:     { icon: '🔴', border: 'border-red-500/40',      bg: 'bg-red-500/5',     title: 'text-red-300' },
  important: { icon: '❗', border: 'border-purple-500/40',   bg: 'bg-purple-500/5',  title: 'text-purple-300' },
  bug:       { icon: '🐛', border: 'border-red-500/40',      bg: 'bg-red-500/5',     title: 'text-red-300' },
  question:  { icon: '❓', border: 'border-gray-500/40',     bg: 'bg-gray-800/40',   title: 'text-gray-300' },
  help:      { icon: '❓', border: 'border-gray-500/40',     bg: 'bg-gray-800/40',   title: 'text-gray-300' },
  faq:       { icon: '❓', border: 'border-gray-500/40',     bg: 'bg-gray-800/40',   title: 'text-gray-300' },
  example:   { icon: '📋', border: 'border-indigo-500/40',   bg: 'bg-indigo-500/5',  title: 'text-indigo-300' },
  quote:     { icon: '💬', border: 'border-gray-500/40',     bg: 'bg-gray-800/40',   title: 'text-gray-400' },
  cite:      { icon: '💬', border: 'border-gray-500/40',     bg: 'bg-gray-800/40',   title: 'text-gray-400' },
};

/**
 * Preprocess Obsidian-flavored markdown:
 * 1. Flatten [[wikilinks]] → display text
 * 2. Ensure callout body is in a separate paragraph from the title
 *    (insert blank `>` between title line and body so react-markdown gives us separate children)
 */
function preprocessObsidian(content: string): string {
  // [[Target|Alias]] → Alias, [[Target]] → Target
  let out = content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target: string, alias?: string) => alias ?? target,
  );

  // > [!TYPE] Title\n> body  →  > [!TYPE] Title\n>\n> body
  out = out.replace(
    /(> \[!\w+\][^\n]*)(\n)(> \S)/g,
    '$1\n>\n$3',
  );

  return out;
}

const components: Components = {
  blockquote({ node, children }) {
    // Inspect hast node to detect Obsidian callout
    const firstPara = (node as Element | undefined)?.children?.find(
      (n) => n.type === 'element' && (n as Element).tagName === 'p',
    ) as Element | undefined;

    const firstTextNode = firstPara?.children?.[0];
    const firstText = firstTextNode?.type === 'text' ? (firstTextNode as { value: string }).value : '';
    const match = firstText.match(/^\[!(\w+)\](?:\s+(.+))?/);

    if (match) {
      const type = match[1].toLowerCase();
      const title = match[2]?.trim() || match[1].toUpperCase();
      const style = CALLOUT[type] ?? CALLOUT.note;
      // Skip first child (the "[!TYPE] Title" paragraph), render the rest as body
      const body = Array.isArray(children) ? children.slice(1) : null;

      return (
        <div className={`border-l-2 rounded-r-lg px-3 py-2 my-3 ${style.border} ${style.bg}`}>
          <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${style.title}`}>
            <span>{style.icon}</span>
            <span>{title}</span>
          </div>
          {body && <div className="space-y-1">{body}</div>}
        </div>
      );
    }

    return (
      <blockquote className="border-l-2 border-gray-700 pl-3 text-gray-400 italic my-3">
        {children}
      </blockquote>
    );
  },
};

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
      [&_a]:text-blue-400 [&_a]:no-underline hover:[&_a]:underline
      [&_hr]:border-gray-800 [&_hr]:my-4
      [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse
      [&_th]:text-left [&_th]:text-gray-400 [&_th]:font-medium [&_th]:py-1.5 [&_th]:border-b [&_th]:border-gray-700
      [&_td]:py-1.5 [&_td]:border-b [&_td]:border-gray-800 [&_td]:text-gray-300">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {preprocessObsidian(content)}
      </ReactMarkdown>
    </div>
  );
}
