/**
 * Guest mode PII/sensitive content masking
 * Applied server-side before rendering or returning API responses
 */

const MASK_RULES: Array<[RegExp, string]> = [
  // Korean full name
  [/이정우/g, '대표님'],
  [/정우\s*님/g, '대표님'],
  // Korean mobile number (010-xxxx-xxxx variants)
  [/010[-\s]?\d{3,4}[-\s]?\d{4}/g, '010-****-****'],
  // Email addresses
  [/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '[이메일]'],
  // Mac internal paths
  [/\/Users\/[a-zA-Z0-9_]+\/[^\s"'\n,)>\]`]*/g, '[경로]'],
  [/~\/\.[a-zA-Z][a-zA-Z0-9_\-]*\/[^\s"'\n,)>\]`]*/g, '[경로]'],
];

export function maskText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of MASK_RULES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function maskPost(post: any): any {
  if (!post) return post;
  return {
    ...post,
    title: maskText(post.title ?? ''),
    content: maskText(post.content ?? ''),
    author_display: maskText(post.author_display ?? ''),
  };
}

export function maskComment(comment: any): any {
  if (!comment) return comment;
  return {
    ...comment,
    content: maskText(comment.content ?? ''),
    author_display: maskText(comment.author_display ?? ''),
  };
}
