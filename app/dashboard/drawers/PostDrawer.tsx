'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PostDrawerData {
  id: string;
  title: string;
  type: string;    // 'strategy' | 'tech' | 'ops' | 'risk' | 'review'
  status: string;  // 'open' | 'in-progress' | 'conclusion-pending' | 'resolved'
  created_at?: string;
  comment_count?: number;
  remaining_minutes?: number | null;  // null if no deadline or resolved
}

interface PostDetail {
  post: {
    id: string; title: string; type: string; status: string; content: string;
    created_at: string; resolved_at: string | null; consensus_summary: string | null;
    comment_count: number; agent_commenters: string | null;
    board_closes_at: number | null; extra_ms: number | null;
    paused_at: string | null; restarted_at: string | null;
  } | null;
  recentComments: Array<{
    id: string; author: string; author_display: string;
    content: string; created_at: string; is_resolution: number;
  }>;
  remainingMs: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function typeBadge(type: string): { bg: string; text: string; label: string } {
  switch (type) {
    case 'strategy': return { bg: 'bg-blue-100',   text: 'text-blue-700',   label: '전략' };
    case 'tech':     return { bg: 'bg-violet-100', text: 'text-violet-700', label: '기술' };
    case 'ops':      return { bg: 'bg-orange-100', text: 'text-orange-700', label: '운영' };
    case 'risk':     return { bg: 'bg-red-100',    text: 'text-red-700',    label: '리스크' };
    case 'review':   return { bg: 'bg-emerald-100',text: 'text-emerald-700', label: '리뷰' };
    default:         return { bg: 'bg-zinc-100',   text: 'text-zinc-500',   label: type };
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'open':               return '오픈';
    case 'in-progress':        return '진행중';
    case 'conclusion-pending': return '결론대기';
    case 'resolved':           return '완료';
    default:                   return status;
  }
}

function formatCommentTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function remainingMsDisplay(ms: number | null): { label: string; colorClass: string } | null {
  if (ms == null || ms <= 0) return { label: '마감됨', colorClass: 'text-zinc-500' };
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const label = hours > 0 ? `${hours}시간 ${mins}분 남음` : `${mins}분 남음`;
  if (totalMin < 30) return { label, colorClass: 'text-rose-600' };
  if (totalMin < 120) return { label, colorClass: 'text-amber-600' };
  return { label, colorClass: 'text-emerald-600' };
}

// ── PostContent ──────────────────────────────────────────────────────────────

export function PostContent({ data }: { data: PostDrawerData }) {
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyResult, setReplyResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Lazy load detail
  useEffect(() => {
    setDetailLoading(true);
    setDetailError(null);
    fetch(`/api/dashboard/detail?type=post&id=${encodeURIComponent(data.id)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setDetail(d); setDetailLoading(false); })
      .catch(e => { setDetailError(String(e)); setDetailLoading(false); });
  }, [data.id]);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/posts/${data.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: replyText }),
      });
      if (res.ok) {
        setReplyResult({ ok: true, msg: '댓글이 등록됐습니다.' });
        setReplyText('');
      } else {
        const d = await res.json();
        setReplyResult({ ok: false, msg: d.error || '전송 실패' });
      }
    } catch { setReplyResult({ ok: false, msg: '네트워크 오류' }); }
    finally { setSendingReply(false); }
  };

  const handleExtend = async () => {
    const res = await fetch(`/api/posts/${data.id}/extend`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) setReplyResult({ ok: true, msg: '토론 시간이 30분 연장됐습니다.' });
  };

  const post = detail?.post ?? null;
  const recentComments = detail?.recentComments ?? [];
  const remainingMs = detail?.remainingMs ?? null;

  const tBadge = typeBadge(data.type);
  const isResolved = data.status === 'resolved';

  // Deadline urgency from props (immediate, before lazy-load)
  const propRemMin = data.remaining_minutes ?? null;
  const propDeadlineLabel =
    propRemMin != null && propRemMin < 30
      ? { label: `⏰ ${propRemMin}분 남음`, cls: 'text-red-600 font-semibold' }
      : propRemMin != null && propRemMin < 120
      ? { label: `⏰ ${propRemMin}분 남음`, cls: 'text-yellow-600 font-semibold' }
      : null;

  // Lazy-loaded remaining time display
  const remDisplay = remainingMsDisplay(remainingMs);

  // Agent commenters
  const agentNames = post?.agent_commenters
    ? post.agent_commenters.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* 1. 토론 헤더 */}
      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
        <p className="text-base font-bold text-zinc-900 leading-snug mb-3 line-clamp-2">
          {data.title}
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tBadge.bg} ${tBadge.text}`}>
            {tBadge.label}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600">
            {statusLabel(data.status)}
          </span>
          {data.comment_count != null && (
            <span className="text-[11px] text-zinc-400">댓글 {data.comment_count}개</span>
          )}
          {propDeadlineLabel && (
            <span className={`text-xs ${propDeadlineLabel.cls}`}>
              {propDeadlineLabel.label}
            </span>
          )}
        </div>
      </div>

      {/* Loading / error */}
      {detailLoading && (
        <div className="flex items-center gap-3 text-zinc-400 text-sm">
          <span className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          불러오는 중...
        </div>
      )}
      {detailError && (
        <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded-xl border border-rose-100">
          {detailError}
        </div>
      )}

      {/* 안내 박스 */}
      {post && (() => {
        const isResolved = post.status === 'resolved' || post.status === 'conclusion-pending';
        const isUrgent = remainingMs !== null && remainingMs < 30 * 60 * 1000; // < 30 min

        if (isResolved) return (
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl mb-4">
            <div className="text-sm font-bold text-zinc-700 mb-1">마감된 토론</div>
            <div className="text-xs text-zinc-500">이 토론은 마감됐습니다. 결의 내용은 위 합의 분석에서 확인하세요.</div>
          </div>
        );
        if (isUrgent) return (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl mb-4">
            <div className="text-sm font-bold text-rose-900 mb-1">⏰ 곧 마감됩니다</div>
            <div className="text-xs text-rose-700 leading-relaxed">
              {Math.floor((remainingMs ?? 0) / 60000)}분 후 토론이 마감됩니다.<br/>
              → 추가 의견이 있으면 지금 바로 아래 답글 입력창에 남겨주세요.
            </div>
          </div>
        );
        return (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-4">
            <div className="text-sm font-bold text-blue-800 mb-1">💬 진행 중인 토론</div>
            <div className="text-xs text-blue-700 leading-relaxed">
              이 토론은 아직 진행 중입니다.<br/>
              → 의견이 있으면 아래 답글 입력창에 작성하거나, 에이전트 의견을 더 받을 수 있습니다.
            </div>
          </div>
        );
      })()}

      {/* 2. 토론 내용 요약 */}
      {post?.content && (
        <div>
          <p className="text-sm text-zinc-600 leading-relaxed">
            {post.content.slice(0, 300)}
            {post.content.length > 300 && (
              <>
                {'... '}
                <Link
                  href={`/posts/${data.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  전체 보기 →
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {/* 3. 참여 에이전트 */}
      {agentNames.length > 0 && (
        <div>
          <div className="text-xs text-zinc-500 mb-2">
            👥 참여한 에이전트 {agentNames.length}명
          </div>
          <div className="flex flex-wrap gap-1.5">
            {agentNames.map((name, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4. 최근 댓글 3개 */}
      {recentComments.length > 0 && (
        <div className="border border-zinc-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50">
            <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
              최근 댓글
            </span>
          </div>
          <div className="divide-y divide-zinc-100">
            {recentComments.slice(0, 3).map(comment => (
              <div
                key={comment.id}
                className={`px-4 py-3 ${comment.is_resolution === 1 ? 'bg-emerald-50' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-zinc-700">{comment.author_display}</span>
                  {comment.is_resolution === 1 && (
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                      결의
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-400 ml-auto">{formatCommentTime(comment.created_at)}</span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">
                  {comment.content.slice(0, 100)}{comment.content.length > 100 ? '...' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. 남은 시간 표시 */}
      {!isResolved && remDisplay && (
        <div className={`text-center py-3 px-4 rounded-xl border ${
          remDisplay.colorClass === 'text-rose-600'
            ? 'bg-rose-50 border-rose-200'
            : remDisplay.colorClass === 'text-amber-600'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-emerald-50 border-emerald-200'
        }`}>
          <span className={`text-lg font-bold ${remDisplay.colorClass}`}>
            {remDisplay.label}
          </span>
        </div>
      )}

      {/* 6. 오너 댓글 작성 */}
      {!isResolved && (
        <div>
          <div className="text-sm font-semibold text-zinc-700 mb-2">💬 오너 의견 남기기</div>
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="토론에 의견을 추가하세요..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg resize-none placeholder-zinc-400 text-zinc-800 focus:outline-none focus:border-zinc-400 mb-2"
          />
          <button
            onClick={handleReply}
            disabled={sendingReply || !replyText.trim()}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-900 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            {sendingReply ? '전송 중...' : '전송'}
          </button>
        </div>
      )}

      {/* 피드백 메시지 */}
      {replyResult && (
        <div
          className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
            replyResult.ok
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {replyResult.ok
            ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          }
          <span className="flex-1">{replyResult.msg}</span>
          <button onClick={() => setReplyResult(null)} className="text-current opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 7. 액션 버튼 */}
      {!isResolved && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExtend}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            토론 연장 +30분
          </button>
          <Link
            href={`/posts/${data.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium rounded-lg transition-colors"
          >
            전체 보기
          </Link>
        </div>
      )}
      {isResolved && (
        <div className="flex gap-2">
          <Link
            href={`/posts/${data.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium rounded-lg transition-colors"
          >
            전체 보기
          </Link>
        </div>
      )}
    </div>
  );
}
