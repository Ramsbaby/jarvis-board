/**
 * wiki.ts — LLM Wiki CRUD 유틸리티
 *
 * 파일시스템 기반 위키 읽기/검색. 2026-09-12 이관 후 위키 정본은 ~/.openclaw-data/wiki 다.
 * (~/.jarvis/wiki 는 그곳을 가리키는 심볼릭 링크 — 링크 경로를 그대로 쓰면 아래 경로 검사가
 *  realpath 와 어긋나 모든 페이지를 거부했고, /wiki 가 '0개 페이지'로 보였다.)
 */

import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

const WIKI_DIR_CONFIGURED = process.env.WIKI_DIR || join(homedir(), '.openclaw-data', 'wiki');

/** 심볼릭 링크를 푼 위키 루트. 모든 경로 계산과 검사는 이 실제 경로 기준으로 한다. */
function wikiRoot(): string {
  try {
    return realpathSync(WIKI_DIR_CONFIGURED);
  } catch {
    return WIKI_DIR_CONFIGURED;
  }
}
const WIKI_DIR = wikiRoot();

// Path traversal 방어 — 실제 경로(realpath)가 위키 루트 하위인지 검증 (symlink 우회 포함)
function _safeWikiPath(pagePath: string): string | null {
  try {
    const resolved = resolve(WIKI_DIR, pagePath);
    const real = existsSync(resolved) ? realpathSync(resolved) : resolved;
    if (!real.startsWith(WIKI_DIR + '/') && real !== WIKI_DIR) {
      return null;
    }
    return real;
  } catch {
    return null;
  }
}

export interface WikiFrontmatter {
  title?: string;
  domain?: string;
  type?: string;
  confidence?: string;
  created?: string;
  updated?: string;
  decay_class?: string;
  tags?: string[];
  related?: string[];
  sources?: Array<{ type: string; ref: string; date?: string }>;
}

export interface WikiPage {
  path: string;           // relative path e.g. "career/_summary.md"
  frontmatter: WikiFrontmatter;
  content: string;        // body without frontmatter
  raw: string;            // full raw content
  lastModified: string;   // ISO date
}

export interface WikiSearchResult {
  path: string;
  title: string;
  type: string;
  snippet: string;
  updated: string;
  confidence: string;
  relevance: number;
}

// ── Frontmatter 파싱 ────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { frontmatter: WikiFrontmatter; content: string } {
  // Handle ```yaml\n---...---\n``` wrapper (LLM sometimes wraps)
  const cleaned = raw.replace(/^```ya?ml\n/m, '').replace(/\n```\s*$/m, '');

  const fmMatch = cleaned.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/);
  if (!fmMatch) return { frontmatter: {}, content: cleaned };

  const fm: WikiFrontmatter = {};
  const fmText = fmMatch[1];
  const content = fmMatch[2];

  // Simple YAML key-value parser (no dependency needed)
  for (const line of fmText.split('\n')) {
    const kv = line.match(/^(\w[\w_]*):\s*(.+)/);
    if (kv) {
      const key = kv[1] as keyof WikiFrontmatter;
      const val = kv[2].replace(/^["']|["']$/g, '').trim();
      if (val === '') continue;
      (fm as Record<string, unknown>)[key] = val;
    }
  }

  return { frontmatter: fm, content };
}

// ── 페이지 읽기 ─────────────────────────────────────────────────────────────

export function readWikiPage(pagePath: string): WikiPage | null {
  const fullPath = _safeWikiPath(pagePath);
  if (!fullPath || !existsSync(fullPath)) return null;

  const raw = readFileSync(fullPath, 'utf-8');
  const stat = statSync(fullPath);
  const { frontmatter, content } = parseFrontmatter(raw);

  return {
    path: pagePath,
    frontmatter,
    content,
    raw,
    lastModified: stat.mtime.toISOString(),
  };
}

// ── 도메인 목록 ─────────────────────────────────────────────────────────────

export function listDomains(): string[] {
  if (!existsSync(WIKI_DIR)) return [];
  return readdirSync(WIKI_DIR).filter(d => {
    const p = join(WIKI_DIR, d);
    return statSync(p).isDirectory() && !d.startsWith('.');
  }).sort();
}

// ── 도메인 내 페이지 목록 ───────────────────────────────────────────────────

export function listPages(domain?: string): WikiSearchResult[] {
  const results: WikiSearchResult[] = [];
  const domains = domain ? [domain] : listDomains();

  for (const d of domains) {
    const domainDir = join(WIKI_DIR, d);
    if (!existsSync(domainDir)) continue;

    const files = readdirSync(domainDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const pagePath = `${d}/${file}`;
      const page = readWikiPage(pagePath);
      if (!page) continue;

      results.push({
        path: pagePath,
        title: page.frontmatter.title || file.replace('.md', ''),
        type: page.frontmatter.type || 'unknown',
        snippet: page.content.slice(0, 200).replace(/\n/g, ' '),
        updated: page.frontmatter.updated || page.lastModified.slice(0, 10),
        confidence: page.frontmatter.confidence || 'medium',
        relevance: 1,
      });
    }
  }

  return results;
}

// ── 검색 ────────────────────────────────────────────────────────────────────

export function searchWiki(query: string, options?: {
  domain?: string;
  type?: string;
  limit?: number;
}): WikiSearchResult[] {
  const limit = options?.limit || 10;
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];

  const allPages = listPages(options?.domain);

  // Score by keyword match count in title + content
  const scored = allPages
    .filter(p => !options?.type || p.type === options.type)
    .map(p => {
      const text = `${p.title} ${p.snippet}`.toLowerCase();
      const hits = keywords.filter(k => text.includes(k)).length;
      return { ...p, relevance: hits / keywords.length };
    })
    .filter(p => p.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  return scored;
}

// ── 위키 통계 ───────────────────────────────────────────────────────────────

export function wikiStats(): {
  totalPages: number;
  domains: Record<string, number>;
  lastUpdated: string;
} {
  const domains: Record<string, number> = {};
  let totalPages = 0;
  let lastUpdated = '';

  for (const d of listDomains()) {
    const pages = listPages(d);
    domains[d] = pages.length;
    totalPages += pages.length;
    for (const p of pages) {
      // 템플릿 자리표시자('YYYY-MM-DD' 등)가 문자열 비교에서 실제 날짜를 이기지 않도록 날짜 꼴만 센다
      if (/^\d{4}-\d{2}-\d{2}/.test(p.updated) && p.updated > lastUpdated) lastUpdated = p.updated;
    }
  }

  return { totalPages, domains, lastUpdated };
}
