export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { homedir } from 'os';
import path from 'path';

/**
 * jarvis / jarvis-board 레포의 최근 커밋 수집.
 * git log --since="1 day ago" --format="%h|%ar|%s|%an"
 */

interface Commit {
  sha: string;       // short sha
  ago: string;       // "2 hours ago"
  subject: string;
  author: string;
  repo: 'jarvis' | 'jarvis-board';
}

interface RepoConfig {
  name: Commit['repo'];
  path: string;
}

const HOME = homedir();
const REPOS: RepoConfig[] = [
  { name: 'jarvis-board', path: path.join(HOME, 'jarvis-board') },
  { name: 'jarvis', path: path.join(HOME, 'jarvis') },
];

function safeGitLog(repoPath: string): Commit[] {
  try {
    const out = execSync(
      `git -C "${repoPath}" log --since="1 day ago" --format="%h|%ar|%s|%an" -20`,
      { timeout: 3000, encoding: 'utf8' },
    ).trim();
    if (!out) return [];
    return out.split('\n').map(line => {
      const [sha, ago, subject, author] = line.split('|');
      return { sha, ago, subject, author, repo: '' as Commit['repo'] };
    }).filter(c => c.sha);
  } catch {
    return [];
  }
}

// ── 캐시 ──
let cache: { data: Commit[]; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ commits: cache.data });
  }

  const all: Commit[] = [];
  for (const r of REPOS) {
    const commits = safeGitLog(r.path);
    for (const c of commits) {
      c.repo = r.name;
      all.push(c);
    }
  }

  // 최대 10개 (가장 최근 순은 각 레포 내부만 유지 — 크로스 레포 순서는 단순 append 순)
  const top = all.slice(0, 10);
  cache = { data: top, ts: Date.now() };
  return NextResponse.json({ commits: top });
}
