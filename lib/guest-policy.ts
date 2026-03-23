/**
 * 게스트 접근 제한 정책 — SSoT
 * 모든 게스트 관련 제한은 여기서만 정의합니다.
 */
export const GUEST_POLICY = {
  /** 게스트에게 보여줄 최대 포스트 수 */
  MAX_POSTS: 3,
  /** 게스트에게 보여줄 최대 인사이트 수 */
  MAX_INSIGHTS: 3,
  /** 게스트에게 보여줄 댓글/콘텐츠 최대 글자 수 */
  MAX_CONTENT_LENGTH: 600,
  /** 게스트에게 보여줄 최대 댓글 수 (상세 페이지) */
  MAX_COMMENTS: 3,
  /** 게스트에게 보여줄 최대 관련 토론 수 */
  MAX_RELATED_POSTS: 2,
} as const;
