#!/usr/bin/env node
/**
 * gen-api-index.mjs — Auto-generate docs/API-INDEX.md from app/api/** /route.ts
 *
 * Walks every route.ts file, derives its HTTP path from the directory tree,
 * detects exported HTTP methods (GET/POST/PUT/DELETE/PATCH), and pulls a
 * one-line description from the leading comment if present. Groups by the
 * top-level segment (entity, game, posts, etc.) and writes Markdown.
 *
 * Usage:  node scripts/gen-api-index.mjs
 * Deps:   node:fs, node:path only — no external packages.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'app', 'api');
const OUT_FILE = path.join(ROOT, 'docs', 'API-INDEX.md');

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

/**
 * Recursively collect every route.ts file under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function walkRoutes(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkRoutes(full));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

/**
 * Convert an absolute route.ts path to the public HTTP path.
 *   app/api/entity/[id]/briefing/route.ts -> /api/entity/[id]/briefing
 * @param {string} file
 */
function fileToRoutePath(file) {
  const rel = path.relative(ROOT, file);
  // rel = app/api/foo/bar/route.ts
  const withoutRoute = rel.replace(/\/route\.ts$/, '');
  // app/api/foo/bar -> /api/foo/bar
  return '/' + withoutRoute.replace(/^app\//, '');
}

/**
 * Parse a route.ts source for exported HTTP methods.
 * @param {string} src
 * @returns {string[]}
 */
function extractMethods(src) {
  const found = new Set();
  // export async function GET(...)
  // export function POST(...)
  // export const GET = ...
  const patterns = [
    /export\s+async\s+function\s+([A-Z]+)\b/g,
    /export\s+function\s+([A-Z]+)\b/g,
    /export\s+const\s+([A-Z]+)\s*=/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src)) !== null) {
      const name = m[1];
      if (HTTP_METHODS.includes(name)) found.add(name);
    }
  }
  return Array.from(found).sort();
}

/**
 * Extract a 1-line description from the top of the file.
 * Accepts JSDoc, line comments, or block comments before any `import`.
 * @param {string} src
 */
function extractDescription(src) {
  const lines = src.split(/\r?\n/);
  const collected = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (collected.length) break;
      continue;
    }
    if (line.startsWith('import ') || line.startsWith('export ') || line.startsWith('const ') || line.startsWith('function ')) {
      break;
    }
    // Strip JSDoc / block comment markers
    if (line.startsWith('/**') || line.startsWith('/*')) {
      const stripped = line.replace(/^\/\*+/, '').replace(/\*+\/$/, '').trim();
      if (stripped) collected.push(stripped);
      continue;
    }
    if (line.startsWith('*/')) {
      break;
    }
    if (line.startsWith('*')) {
      const stripped = line.replace(/^\*+\s?/, '').trim();
      if (stripped && !stripped.startsWith('@')) collected.push(stripped);
      continue;
    }
    if (line.startsWith('//')) {
      collected.push(line.replace(/^\/\/+\s?/, '').trim());
      continue;
    }
    // First non-comment token means we're done.
    break;
  }
  if (!collected.length) return '(no description)';
  // Use only the first sentence / first line (keep it short).
  const first = collected.find((c) => c.length > 0);
  if (!first) return '(no description)';
  const oneLine = first.split(/(?<=[.!?。])\s/)[0];
  return oneLine.length > 140 ? oneLine.slice(0, 137) + '...' : oneLine;
}

/**
 * Group routes by top-level segment (after /api/).
 * Returns a map: "segment" -> [{ routePath, methods, description }]
 */
function groupRoutes(rows) {
  const groups = new Map();
  for (const row of rows) {
    // /api/foo/bar -> foo
    const segments = row.routePath.split('/').filter(Boolean); // ["api","foo","bar"]
    const topSegment = segments[1] || '(root)';
    const key = `/api/${topSegment}/`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  // Sort entries within each group by routePath
  for (const list of groups.values()) {
    list.sort((a, b) => a.routePath.localeCompare(b.routePath));
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`[gen-api-index] Failed to read ${file}: ${err.message}`);
    return '';
  }
}

function main() {
  if (!fs.existsSync(API_DIR)) {
    console.error(`[gen-api-index] API directory not found: ${API_DIR}`);
    process.exit(1);
  }

  const files = walkRoutes(API_DIR);
  if (!files.length) {
    console.error('[gen-api-index] No route.ts files found under app/api/');
    // Still write an empty index rather than bailing.
  }

  const rows = [];
  for (const file of files) {
    try {
      const src = safeRead(file);
      const routePath = fileToRoutePath(file);
      const methods = extractMethods(src);
      const description = extractDescription(src);
      rows.push({ file, routePath, methods, description });
    } catch (err) {
      console.error(`[gen-api-index] Skipping ${file}: ${err.message}`);
    }
  }

  const groups = groupRoutes(rows);
  const timestamp = new Date().toISOString();

  const lines = [];
  lines.push('# API Routes Index');
  lines.push('> Auto-generated by `scripts/gen-api-index.mjs` — do not edit by hand.');
  lines.push(`> Last run: ${timestamp}`);
  lines.push('');
  lines.push(`Total routes: ${rows.length}`);
  lines.push('');

  for (const [group, list] of groups.entries()) {
    lines.push(`## ${group}`);
    for (const row of list) {
      const methods = row.methods.length ? `[${row.methods.join(', ')}]` : '[-]';
      lines.push(`- \`${row.routePath}\` ${methods} — ${row.description}`);
    }
    lines.push('');
  }

  try {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
  } catch (err) {
    console.error(`[gen-api-index] Failed to write ${OUT_FILE}: ${err.message}`);
    process.exit(1);
  }

  console.log(`[gen-api-index] Wrote ${OUT_FILE} — ${rows.length} routes across ${groups.size} groups.`);
}

try {
  main();
} catch (err) {
  console.error(`[gen-api-index] Unexpected error: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
}
