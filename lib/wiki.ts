/**
 * wiki.ts — LLM Wiki CRUD 유틸리티
 *
 * 파일시스템 기반 위키 읽기/검색. 2026-09-12 이관 후 위키 정본은 ~/.openclaw-data/wiki 다.
 * (~/.jarvis/wiki 는 그곳을 가리키는 심볼릭 링크 — 링크 경로를 그대로 쓰면 아래 경로 검사가
 *  realpath 와 어긋나 모든 페이지를 거부했고, /wiki 가 '0개 페이지'로 보였다.)
 *
 * 2026-10-03: 목록이 '도메인 폴더 바로 아래 .md'만 읽어 745개 중 237개만 보였다.
 *  이제 하위 폴더까지 재귀로 읽는다(최상위 .md 포함). 숨김 폴더(.git·.obsidian)는 건너뛰고,
 *  심볼릭 링크는 실제 경로가 위키 루트 안일 때만 따라가며, 같은 실제 폴더는 한 번만 읽는다(순환 방지).
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
    if (typeof pagePath !== 'string' || pagePath.includes('\0')) return null;
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
  /** 문서가 든 폴더 (위키 루트 기준, 예: "career/interviews"). 최상위 문서는 "" */
  folder: string;
  /** 파일 수정 시각 (ISO) — 최신순 정렬의 동점 처리용 */
  modified: string;
}

/** 이 이상 깊은 폴더는 읽지 않는다 (현재 최대 깊이 3) */
const MAX_WIKI_DEPTH = 8;

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

/** 위키 문서 경로로 받아들일 수 있는 꼴인지 — .md 파일이고, 숨김 폴더(.git 등)를 지나지 않는다 */
function isWikiDocPath(pagePath: string): boolean {
  if (!pagePath.endsWith('.md')) return false;
  return !pagePath.split(/[\\/]/).some(seg => seg.startsWith('.'));
}

export function readWikiPage(pagePath: string): WikiPage | null {
  if (!isWikiDocPath(pagePath)) return null;
  const fullPath = _safeWikiPath(pagePath);
  if (!fullPath || !existsSync(fullPath) || !statSync(fullPath).isFile()) return null;

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
    if (d.startsWith('.')) return false;
    const real = _safeWikiPath(d);
    return !!real && statSync(real).isDirectory();
  }).sort();
}

// ── 문서 경로 수집 (하위 폴더 재귀) ─────────────────────────────────────────

/**
 * startRel(위키 루트 기준 상대 경로, "" = 루트) 아래의 .md 문서 경로를 모두 모은다.
 * - 숨김 항목(. 으로 시작)은 건너뛴다.
 * - 심볼릭 링크는 _safeWikiPath 로 실제 경로가 루트 안인지 확인한 뒤에만 따라간다.
 * - 실제 폴더 기준으로 한 번씩만 들어가 링크 순환을 막는다.
 */
function collectDocPaths(startRel: string): string[] {
  const out: string[] = [];
  const seenDirs = new Set<string>();
  const walk = (rel: string, depth: number) => {
    if (depth > MAX_WIKI_DEPTH) return;
    const realDir = _safeWikiPath(rel || '.');
    if (!realDir || seenDirs.has(realDir)) return;
    seenDirs.add(realDir);
    let entries;
    try {
      entries = readdirSync(realDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      let isDir = ent.isDirectory();
      let isFile = ent.isFile();
      if (ent.isSymbolicLink()) {
        const real = _safeWikiPath(childRel);
        if (!real) continue; // 루트 밖을 가리키는 링크 — 무시
        try {
          const st = statSync(real);
          isDir = st.isDirectory();
          isFile = st.isFile();
        } catch {
          continue;
        }
      }
      if (isDir) walk(childRel, depth + 1);
      else if (isFile && ent.name.endsWith('.md')) out.push(childRel);
    }
  };
  walk(startRel, 0);
  return out;
}

// ── 페이지 목록 ─────────────────────────────────────────────────────────────

function toListItem(pagePath: string, page: WikiPage): WikiSearchResult {
  const slash = pagePath.lastIndexOf('/');
  const file = slash >= 0 ? pagePath.slice(slash + 1) : pagePath;
  return {
    path: pagePath,
    title: page.frontmatter.title || file.replace(/\.md$/, ''),
    type: page.frontmatter.type || 'unknown',
    snippet: page.content.slice(0, 200).replace(/\n/g, ' '),
    updated: page.frontmatter.updated || page.lastModified.slice(0, 10),
    confidence: page.frontmatter.confidence || 'medium',
    relevance: 1,
    folder: slash >= 0 ? pagePath.slice(0, slash) : '',
    modified: page.lastModified,
  };
}

/**
 * 위키 문서 목록. domain 을 주면 그 최상위 폴더(하위 폴더 포함)만, 없으면 최상위 문서까지 전부.
 * 폴더 → 경로 순으로 정렬해 돌려준다.
 */
export function listPages(domain?: string): WikiSearchResult[] {
  if (!existsSync(WIKI_DIR)) return [];
  let start = '';
  if (domain) {
    // 도메인은 최상위 폴더 이름 하나만 받는다 — 경로 조각·숨김 이름은 거부
    if (domain.includes('/') || domain.includes('\\') || domain.startsWith('.') || !listDomains().includes(domain)) return [];
    start = domain;
  }
  const results: WikiSearchResult[] = [];
  for (const pagePath of collectDocPaths(start)) {
    const page = readWikiPage(pagePath);
    if (page) results.push(toListItem(pagePath, page));
  }
  return results.sort((a, b) => a.folder.localeCompare(b.folder) || a.path.localeCompare(b.path));
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

/**
 * pages 를 주면(이미 읽은 전체 목록) 파일을 다시 읽지 않고 그것으로 센다.
 * domains: 최상위 폴더별 문서 수(하위 폴더 포함). 최상위 .md 는 totalPages 에만 들어간다.
 */
export function wikiStats(pages: WikiSearchResult[] = listPages()): {
  totalPages: number;
  domains: Record<string, number>;
  lastUpdated: string;
} {
  const domains: Record<string, number> = {};
  for (const d of listDomains()) domains[d] = 0;
  let lastUpdated = '';

  for (const p of pages) {
    const top = p.folder.split('/')[0];
    if (top && top in domains) domains[top] += 1;
    // 템플릿 자리표시자('YYYY-MM-DD' 등)가 문자열 비교에서 실제 날짜를 이기지 않도록 날짜 꼴만 센다
    if (/^\d{4}-\d{2}-\d{2}/.test(p.updated) && p.updated > lastUpdated) lastUpdated = p.updated;
  }

  return { totalPages: pages.length, domains, lastUpdated };
}
