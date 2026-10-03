'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface WikiPage {
  path: string;
  title: string;
  type: string;
  snippet: string;
  updated: string;
  confidence: string;
  relevance: number;
  /** 문서가 든 폴더 (예: "career/interviews"), 최상위는 "" */
  folder?: string;
  /** 파일 수정 시각 ISO */
  modified?: string;
}

type SortMode = 'folder' | 'recent';

interface WikiStats {
  totalPages: number;
  domains: Record<string, number>;
  lastUpdated: string;
}

interface WikiPageDetail {
  path: string;
  frontmatter: Record<string, unknown>;
  content: string;
  lastModified: string;
}

const DOMAIN_EMOJI: Record<string, string> = {
  career: '💼', trading: '📈', ops: '🔧', knowledge: '📚',
  briefings: '📋', family: '👨‍👩‍👧', health: '💪', meta: '⚙️',
};

/** 문서 폴더 — 옛 응답(folder 없음)도 경로에서 계산 */
function folderOf(p: WikiPage): string {
  if (typeof p.folder === 'string') return p.folder;
  const i = p.path.lastIndexOf('/');
  return i >= 0 ? p.path.slice(0, i) : '';
}

/** 최신순 정렬 키 — 화면에 보이는 날짜(updated)가 날짜 꼴이면 그것, 아니면 파일 수정일 */
function dateKey(p: WikiPage): string {
  return /^\d{4}-\d{2}-\d{2}/.test(p.updated) ? p.updated.slice(0, 10) : (p.modified || '').slice(0, 10);
}

/** 이보다 문서가 많으면 폴더 묶음을 처음엔 접어 둔다 (검색 결과는 항상 펼침) */
const COLLAPSE_THRESHOLD = 60;

/** 위키 본문을 HTML 로 넣기 전에 태그를 글자로 바꾼다 — 위키에 섞여 들어온 HTML·스크립트가 실행되지 않게 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default function WikiBrowserPage() {
  const [stats, setStats] = useState<WikiStats | null>(null);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<WikiPageDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('folder');
  const [isSearchResult, setIsSearchResult] = useState(false);
  /** 폴더별 접힘 상태 — 값이 없으면 기본값(문서 수에 따라)을 쓴다 */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const fetchPages = useCallback(async (domain?: string, q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (domain) params.set('domain', domain);
      if (q) params.set('q', q);
      const res = await fetch(`/api/wiki?${params}`);
      if (!res.ok) throw new Error(res.status === 403 ? '접근 권한 없음' : `HTTP ${res.status}`);
      const data = await res.json();
      // 검색 응답에는 stats 가 없다 — 그때 도메인 버튼이 사라지지 않도록 기존 통계를 유지
      if (data.stats) setStats(data.stats);
      setPages(data.results || data.pages || []);
      setIsSearchResult(!!q);
      setCollapsed({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPage = async (path: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/wiki/page?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        throw new Error(res.status === 403 ? '접근 권한 없음' : `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSelectedPage(data.page);
    } catch (err) {
      // 빈 catch였던 자리 — 실패 시 사용자에게 피드백을 주고
      // 기존 선택 상태는 유지하지 않는다 (잘못된 본문 잔상 방지).
      setSelectedPage(null);
      setError(`위키 페이지를 불러오지 못했습니다: ${(err as Error).message}`);
    }
  };

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const recentPages = useMemo(
    () => [...pages].sort((a, b) =>
      dateKey(b).localeCompare(dateKey(a)) || (b.modified || '').localeCompare(a.modified || '') || a.path.localeCompare(b.path)),
    [pages],
  );

  const folderGroups = useMemo(() => {
    const map = new Map<string, WikiPage[]>();
    for (const p of pages) {
      const f = folderOf(p);
      const list = map.get(f);
      if (list) list.push(p);
      else map.set(f, [p]);
    }
    // 최상위 문서('') 먼저, 그다음 폴더 이름순. 폴더 안은 검색이면 관련도순(받은 순서), 아니면 경로순
    return [...map.entries()]
      .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
      .map(([folder, list]) => ({
        folder,
        pages: isSearchResult ? list : [...list].sort((x, y) => x.path.localeCompare(y.path)),
      }));
  }, [pages, isSearchResult]);

  const defaultCollapsed = !isSearchResult && pages.length > COLLAPSE_THRESHOLD;
  const isCollapsed = (folder: string) => collapsed[folder] ?? defaultCollapsed;
  const toggleFolder = (folder: string) =>
    setCollapsed(prev => ({ ...prev, [folder]: !(prev[folder] ?? defaultCollapsed) }));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchPages(selectedDomain || undefined, searchQuery.trim());
    } else {
      fetchPages(selectedDomain || undefined);
    }
  };

  const handleDomainFilter = (domain: string | null) => {
    setSelectedDomain(domain);
    setSelectedPage(null);
    fetchPages(domain || undefined, searchQuery || undefined);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#0d1117', color: '#c9d1d9' }}>
      {/* 사이드바 */}
      <div style={{ width: 320, borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ padding: 16, borderBottom: '1px solid #30363d' }}>
          <h1 style={{ margin: 0, fontSize: 18, color: '#f0f6fc' }}>📚 Jarvis Wiki</h1>
          {stats && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#8b949e' }}>
              {stats.totalPages}개 페이지 · 마지막 갱신 {stats.lastUpdated}
            </p>
          )}
        </div>

        {/* 검색 */}
        <form onSubmit={handleSearch} style={{ padding: '12px 16px', borderBottom: '1px solid #30363d' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="위키 검색..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6,
              border: '1px solid #30363d', background: '#161b22', color: '#c9d1d9',
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </form>

        {/* 도메인 필터 */}
        <div style={{ padding: '8px 16px', display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid #30363d' }}>
          <button
            onClick={() => handleDomainFilter(null)}
            style={{
              padding: '4px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 11,
              background: !selectedDomain ? '#1f6feb' : '#21262d', color: !selectedDomain ? '#fff' : '#8b949e',
            }}
          >전체</button>
          {stats && Object.keys(stats.domains).map(d => (
            <button
              key={d}
              onClick={() => handleDomainFilter(d)}
              style={{
                padding: '4px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 11,
                background: selectedDomain === d ? '#1f6feb' : '#21262d',
                color: selectedDomain === d ? '#fff' : '#8b949e',
              }}
            >{DOMAIN_EMOJI[d] || '📄'} {d} ({stats.domains[d]})</button>
          ))}
        </div>

        {/* 정렬 — 폴더별 묶음 / 최신순 */}
        <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid #30363d', fontSize: 11 }}>
          <span style={{ color: '#8b949e', marginRight: 4 }}>정렬</span>
          {([['folder', '📁 폴더별'], ['recent', '🕒 최신순']] as Array<[SortMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={sortMode === mode}
              onClick={() => setSortMode(mode)}
              style={{
                padding: '3px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 11,
                background: sortMode === mode ? '#1f6feb' : '#21262d',
                color: sortMode === mode ? '#fff' : '#8b949e',
              }}
            >{label}</button>
          ))}
          {!loading && !error && (
            <span style={{ marginLeft: 'auto', color: '#8b949e' }}>{pages.length}개</span>
          )}
        </div>

        {/* 페이지 목록 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {loading && <p style={{ textAlign: 'center', color: '#8b949e', padding: 16 }}>로딩 중...</p>}
          {error && !loading && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <p style={{ color: '#f85149', margin: '0 0 8px', fontSize: 13 }}>
                위키를 불러오지 못했습니다
              </p>
              <p style={{ color: '#8b949e', margin: '0 0 12px', fontSize: 11 }}>{error}</p>
              <button
                type="button"
                onClick={() => fetchPages(selectedDomain || undefined, searchQuery || undefined)}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #30363d',
                  background: '#21262d', color: '#c9d1d9', fontSize: 12, cursor: 'pointer',
                }}
              >재시도</button>
            </div>
          )}
          {!loading && !error && pages.length === 0 && <p style={{ textAlign: 'center', color: '#8b949e', padding: 16 }}>페이지 없음</p>}
          {!loading && !error && sortMode === 'recent' && recentPages.map(p => (
            <WikiListItem key={p.path} p={p} selected={selectedPage?.path === p.path} showFolder onOpen={fetchPage} />
          ))}
          {!loading && !error && sortMode === 'folder' && folderGroups.map(g => {
            const closed = isCollapsed(g.folder);
            const top = g.folder.split('/')[0];
            return (
              <div key={g.folder || '(root)'}>
                <button
                  type="button"
                  onClick={() => toggleFolder(g.folder)}
                  aria-expanded={!closed}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', cursor: 'pointer',
                    background: '#161b22', color: '#c9d1d9', fontSize: 12, fontWeight: 600,
                    borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ color: '#8b949e', width: 10 }}>{closed ? '▸' : '▾'}</span>
                  <span>{g.folder ? `${DOMAIN_EMOJI[top] || '📁'} ${g.folder}` : '🏠 최상위'}</span>
                  <span style={{ marginLeft: 'auto', color: '#8b949e', fontWeight: 400 }}>{g.pages.length}</span>
                </button>
                {!closed && g.pages.map(p => (
                  <WikiListItem key={p.path} p={p} selected={selectedPage?.path === p.path} onOpen={fetchPage} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {!selectedPage ? (
          <div style={{ textAlign: 'center', marginTop: '20vh', color: '#8b949e' }}>
            <p style={{ fontSize: 48 }}>📚</p>
            <p>왼쪽에서 페이지를 선택하세요</p>
          </div>
        ) : (
          <div style={{ maxWidth: 800 }}>
            {/* 메타데이터 */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 8px', borderRadius: 12, background: '#1f6feb22', color: '#58a6ff', fontSize: 11 }}>
                {String(selectedPage.frontmatter?.domain || '')}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 12, background: '#23862622', color: '#3fb950', fontSize: 11 }}>
                {String(selectedPage.frontmatter?.confidence || 'medium')}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 12, background: '#21262d', color: '#8b949e', fontSize: 11 }}>
                {selectedPage.lastModified?.slice(0, 10)}
              </span>
            </div>

            {/* 마크다운 본문 (간단 렌더링) */}
            <div
              style={{ lineHeight: 1.8, fontSize: 14 }}
              dangerouslySetInnerHTML={{
                __html: escapeHtml(selectedPage.content)
                  .replace(/^### (.+)$/gm, '<h3 style="color:#f0f6fc;margin-top:24px">$1</h3>')
                  .replace(/^## (.+)$/gm, '<h2 style="color:#f0f6fc;margin-top:32px;border-bottom:1px solid #30363d;padding-bottom:8px">$1</h2>')
                  .replace(/^# (.+)$/gm, '<h1 style="color:#f0f6fc;margin-top:0">$1</h1>')
                  .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f0f6fc">$1</strong>')
                  .replace(/^- (.+)$/gm, '<li style="margin-left:16px">$1</li>')
                  .replace(/\n{2,}/g, '<br/><br/>')
                  .replace(/\n/g, '<br/>')
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function WikiListItem({ p, selected, showFolder, onOpen }: {
  p: WikiPage;
  selected: boolean;
  showFolder?: boolean;
  onOpen: (path: string) => void;
}) {
  const folder = folderOf(p);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(p.path)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(p.path); } }}
      style={{
        padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #21262d',
        background: selected ? '#161b22' : 'transparent',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6fc' }}>
        {DOMAIN_EMOJI[p.path.split('/')[0]] || '📄'} {p.title}
      </div>
      <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
        {showFolder ? `${folder || '최상위'} · ` : ''}{p.updated} · {p.confidence}
      </div>
      <div style={{ fontSize: 11, color: '#6e7681', marginTop: 4, lineHeight: 1.4 }}>
        {p.snippet.slice(0, 100)}...
      </div>
    </div>
  );
}
