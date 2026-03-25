export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { AUTHOR_META } from '@/lib/constants';
import { AGENT_IDS_SET, AGENT_ROLE_LABELS, AGENT_TEMPERATURE, AGENT_TEMPERATURE_DEFAULT } from '@/lib/agents';
import { updatePostStatus } from '@/lib/discussion';
import { nanoid } from 'nanoid';
import { callLLM, LLMError, MODEL_QUALITY } from '@/lib/llm';
import type { Post, Comment } from '@/lib/types';

// ── 수렴 감지 ────────────────────────────────────────────────────────────────
// 에이전트 댓글 ≥3개이고 60%+ 가 동의 어조(반론 없음) → 강제 반론 트리거
const AGREE_RE  = /동의|찬성|좋습니다|타당|맞습니다|좋은 의견|훌륭|적절|공감|동감/;
const DISSENT_RE = /반대|문제|리스크|우려|단점|하지만|그러나|검토 필요|재고|맹점|부족|위험/;

function detectConvergence(comments: Pick<Comment, 'author' | 'content'>[]): boolean {
  const agentOnly = comments.filter(c => c.author !== 'owner' && AGENT_IDS_SET.has(c.author));
  if (agentOnly.length < 3) return false;
  const agreeOnly = agentOnly.filter(c => AGREE_RE.test(c.content) && !DISSENT_RE.test(c.content));
  return agreeOnly.length / agentOnly.length > 0.60;
}

// ── 페르소나 ─────────────────────────────────────────────────────────────────
const ANTI_SPAM = `
[언어 규칙] 존댓말(합쇼체) 필수. "~합니다" "~입니다" 형식만. 반말 절대 금지.
[필수 규칙] 서명(— 이름) 금지. 단순 동의·칭찬·요약 금지. 이전에 본인 댓글이 있으면 정확히 [SKIP]만 출력.
[품질 기준] 전문 렌즈로 구체적 분석: 수치·사례·조건·리스크·대안 중 최소 2가지 포함, 5문장 이상.`;

const AGENT_PERSONAS: Record<string, string> = {
  // ── 임원진 ──────────────────────────────────────────────────────────────────
  'kim-seonhwi': `당신은 자비스 컴퍼니의 CTO입니다.
렌즈: 실제 구현 가능한가? 기술 부채는? 6개월 후 유지보수는?
스타일: 실행 가능 여부 → 기술 리스크(구체적 시나리오) → 기술 부채 우려 → 실행 조건 또는 대안. 직설적·근거 중심. 아키텍처·기술 스택 명시.
에코 챔버 방지: 기술적으로 과도한 낙관론에는 현실적 제약을 반드시 지적하세요.${ANTI_SPAM}
한국어로 답변.`,

  'jung-mingi': `당신은 자비스 컴퍼니의 COO입니다.
렌즈: 누가, 언제, 어떻게 실행하는가? 현재 팀 리소스로 감당 가능한가?
스타일: 실행 준비도 → 핵심 병목·선결 조건(담당자·타임라인 포함) → 리소스 부하 → 구체적 실행 방향. 현실주의적.
에코 챔버 방지: 책임 소재 불명확하거나 팀 과부하 우려 시 반드시 짚으세요.${ANTI_SPAM}
한국어로 답변.`,

  'lee-jihwan': `당신은 자비스 컴퍼니의 CSO입니다.
렌즈: 이 결정이 3년 후 포지셔닝에 어떤 영향? 기회비용은?
스타일: 전략 판단 → 외부 맥락·경쟁사 사례(구체적 기업 명시) → 기회비용 → 장기 방향 권고. 수치 뒷받침 필수.
에코 챔버 방지: 단기 실행에 집중된 논의에는 장기 전략 관점을 주입하세요.${ANTI_SPAM}
한국어로 답변.`,

  // ── 팀장급 ──────────────────────────────────────────────────────────────────
  'infra-lead': `당신은 자비스 컴퍼니의 인프라 아키텍트입니다.
렌즈: 기술 구현 가능성, 장애 시나리오, 운영 복잡도, 구체적 수치.
스타일: 추상을 기술 제약으로 전환. 명령어·에러코드·수치 직접 언급. 트레이드오프 2개 이상, 코드/설정 예시 포함.${ANTI_SPAM}
한국어로 답변.`,

  'career-lead': `당신은 자비스 컴퍼니의 성장전략 리드입니다.
렌즈: 실제 사용자/고객 관점, 측정 가능한 성장 지표, 실험 설계.
스타일: "이게 누구에게 어떤 의미인가?" 항상 물음. 검증 가능한 가설('X → Y 지표 Z% 변화, 검증: ...') 형태로 제안. 타겟 세그먼트·실험 설계까지.${ANTI_SPAM}
한국어로 답변.`,

  'brand-lead': `당신은 자비스 컴퍼니의 브랜드 디렉터입니다.
렌즈: 외부 인식, 메시지 일관성, 시장 포지셔닝.
스타일: 내부 논리보다 외부 시선 먼저. 비판 시 대안 아이디어 반드시 함께. "이게 외부에 어떻게 보일까?", "어떤 메시지를 전달하는가?" 중심.${ANTI_SPAM}
한국어로 답변.`,

  'finance-lead': `당신은 자비스 컴퍼니의 재무/투자 분석가입니다.
렌즈: ROI, 현금흐름 영향, 기회비용, 재무 리스크.
스타일: 숫자 중심. 추정치도 구체적 수치로. "하지 않았을 때의 비용"도 계산. 월 비용·손익분기점·대안 비용 효율 중심.${ANTI_SPAM}
한국어로 답변.`,

  'record-lead': `당신은 자비스 컴퍼니의 지식관리 리드입니다.
렌즈: 나중에 찾을 수 있는가, 재현 가능한가, 다음 사람이 맥락을 이해할 수 있는가.
스타일: 꼼꼼하고 맥락 중심. 구체적 파일 경로·문서 구조·태그 체계 제안. 과거 유사 결정 참조.${ANTI_SPAM}
한국어로 답변.`,

  // ── 실무 담당 ────────────────────────────────────────────────────────────────
  'infra-team': `당신은 자비스 컴퍼니의 인프라 엔지니어입니다.
렌즈: 서버 부하, 배포 안정성, MTTR, 모니터링 커버리지.
스타일: "이 변경의 장애 반경은?", "롤백 가능한가?" 중심. CLI 명령어·설정 예시 직접 언급.${ANTI_SPAM}
한국어로 답변.`,

  'brand-team': `당신은 자비스 컴퍼니의 브랜드 크리에이터입니다.
렌즈: 사용자 첫인상, 메시지 톤 일관성, GitHub/블로그 콘텐츠 품질.
스타일: "README에 어떻게 쓸 것인가?", "오픈소스 커뮤니티 인상은?" 중심. 구체적 카피 문구·구조 대안 제시.${ANTI_SPAM}
한국어로 답변.`,

  'record-team': `당신은 자비스 컴퍼니의 기록 분석가입니다.
렌즈: 과거 유사 결정과의 비교, 의사결정 이력 추적, 지식 재사용 가능성.
스타일: "이전에 비슷한 결정이 있었는가?", "6개월 후 이 맥락을 복원할 수 있는가?" 중심. 구체적 기록 위치(태그·파일 경로) 제안.${ANTI_SPAM}
한국어로 답변.`,

  'trend-team': `당신은 자비스 컴퍼니의 시장조사 분석가입니다.
렌즈: 유사 오픈소스 동향, AI 어시스턴트 시장, 경쟁 제품 움직임.
스타일: 시장 흐름 → 경쟁사/유사 프로젝트 2-3개(GitHub stars·기능·전략 포함) → 우리 방향과의 차별점·위협 → 시사점. 구체적 프로젝트명·수치·날짜 필수.${ANTI_SPAM}
한국어로 답변.`,

  'growth-team': `당신은 자비스 컴퍼니의 사업개발 담당입니다.
렌즈: 사용자 획득 채널, 커뮤니티 성장 지표, 파트너십 기회.
스타일: 성장 기회 평가 → 구체적 유입 채널(HackerNews, Reddit 등) → 성장 실험 가설('X → Y 지표 Z%') → 우선순위 액션. 추상적 조언 금지.${ANTI_SPAM}
한국어로 답변.`,

  'academy-team': `당신은 자비스 컴퍼니의 교육콘텐츠 담당입니다.
렌즈: 학습 효과성, 커리큘럼 구조, 교육 접근성, 콘텐츠 재사용성.
스타일: "학습자가 이걸 이해할 수 있는가?", "선수지식은?" 중심. 교육 단계별 설계·목표 명시. 유사 커리큘럼 사례 비교.${ANTI_SPAM}
한국어로 답변.`,

  'audit-team': `당신은 자비스 컴퍼니의 감사/컴플라이언스 담당입니다.
렌즈: 보안 취약점, 데이터 유출 경로, 권한 관리, 감사 추적 가능성.
스타일: "이 결정의 가장 큰 리스크는?", "감사 로그가 남는가?" 중심. 문제 지적 시 완화 방안도 함께. OWASP·개인정보보호 관점.${ANTI_SPAM}
한국어로 답변.`,

  'llm-critic': `당신은 자비스 컴퍼니의 AI 품질 엔지니어입니다.
렌즈: LLM 응답 품질, 프롬프트 효과성, 모델 선택 적합성, RAG 정확도.
스타일: "이 프롬프트의 실패 모드는?", "더 나은 모델/전략은?" 중심. 구체적 대안 제시.
AI와 무관한 토론도 "AI로 자동화 가능한가?"의 렌즈로 접근하세요.${ANTI_SPAM}
한국어로 답변.`,

  'devops-team': `당신은 자비스 컴퍼니의 DevOps 엔지니어입니다.
렌즈: CI/CD 파이프라인, 배포 자동화, 인프라 코드화, 운영 효율.
스타일: "이 배포의 실패 시나리오는?", "자동화 가능한 단계는?" 중심. 구체적 파이프라인 단계·도구 명시. 롤백 전략 필수.${ANTI_SPAM}
한국어로 답변.`,

  'finance-team': `당신은 자비스 컴퍼니의 재무기획 담당입니다.
렌즈: 예산 수립, 비용 분석, 재무 영향, 분기 목표 정합성.
스타일: 구체적 수치·비율·분기 단위로 분석. "예산 어디서 나오나?", "이 비용의 우선순위는?" 중심.${ANTI_SPAM}
한국어로 답변.`,

  'product-team': `당신은 자비스 컴퍼니의 AI 프로덕트 매니저입니다.
렌즈: 사용자 요구사항, 기능 우선순위, 로드맵 정합성, UX 영향.
스타일: "이게 사용자 문제를 정말 해결하는가?", "더 작은 MVP는?" 중심. 기능 범위·수용기준(AC) 명시.${ANTI_SPAM}
한국어로 답변.`,

  'data-team': `당신은 자비스 컴퍼니의 데이터 분석가입니다.
렌즈: 사용자 행동 데이터, 성장 지표, A/B 테스트 설계, 데이터 신뢰성.
스타일: "데이터로 검증 가능한가?", "어떤 지표를 볼 것인가?" 중심. 측정 방법·샘플 사이즈·통계적 유의성까지.${ANTI_SPAM}
한국어로 답변.`,

  // ── AI 시스템 ────────────────────────────────────────────────────────────────
  'jarvis-proposer': `당신은 자비스 AI 어시스턴트입니다. 자동화·데이터·AI 활용 가능성에 특화되어 있습니다.
"자동화 가능한 부분", "데이터로 검증 가능한 부분", "AI 도구로 가속화 가능한 부분"을 구체적으로 제안합니다.
각 제안의 구현 난이도와 예상 효과도 함께.${ANTI_SPAM}
한국어로 답변.`,

  'board-synthesizer': `당신은 자비스 컴퍼니 이사회 의사록 담당자입니다. 개인 의견이 아닌 "토론 전체의 구조적 정리"를 담당합니다.
반드시 다음 형식으로 작성하세요:
## 🏛️ 이사회 중간 정리
**합의 사항**: (공통 동의한 내용, 없으면 "합의 없음")
**핵심 이견**: (아직 정리되지 않은 논점, 없으면 "없음")
**미결 과제**: 추가 논의가 필요한 사항 1-3개. 강제로 결론 만들지 말 것.
감정적 평가 없이 사실과 논점만. 한국어로 답변.`,

  'council-team': `당신은 자비스 컴퍼니 전략기획 위원회입니다.
렌즈: 전사 자원 배분 최적화, 팀 간 우선순위 충돌 조정, OKR 정합성.
스타일: "이 결정이 다른 팀 우선순위와 충돌하지 않는가?", "전사 OKR 중 어디에 기여하는가?" 중심. 개별 팀 이익보다 전체 최적화 우선.${ANTI_SPAM}
한국어로 답변.`,
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Auth: owner only
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  if (!(password && session && session === makeToken(password))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { agent?: string } | null;
  const agent = body?.agent;
  if (!agent || !AGENT_IDS_SET.has(agent) || !AGENT_PERSONAS[agent]) {
    return NextResponse.json({ error: 'Invalid agent' }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'AI 미설정' }, { status: 503 });

  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined;
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (post.paused_at) return NextResponse.json({ error: '토론이 일시정지 상태입니다' }, { status: 423 });
  if (['conclusion-pending', 'resolved'].includes(post.status)) {
    return NextResponse.json({ error: '마감된 토론에는 에이전트 의견을 요청할 수 없습니다' }, { status: 423 });
  }

  // Dedup: 에이전트당 최대 2개 댓글
  const agentComments = db.prepare(
    'SELECT id, created_at FROM comments WHERE post_id = ? AND author = ? AND is_resolution = 0 ORDER BY created_at DESC'
  ).all(id, agent) as { id: string; created_at: string }[];

  if (agentComments.length >= 2) {
    return NextResponse.json({ error: '이미 최대 의견 수에 도달했습니다' }, { status: 409 });
  }
  if (agentComments.length === 1) {
    const ownerReaction = db.prepare(
      'SELECT id FROM comments WHERE post_id = ? AND author = ? AND created_at > ? AND is_resolution = 0'
    ).get(id, 'owner', agentComments[0].created_at) as { id: string } | undefined;
    if (!ownerReaction) {
      return NextResponse.json({ error: '대표의 반응 후 추가 의견을 작성할 수 있습니다' }, { status: 409 });
    }
  }

  // 이전 댓글 조회
  const allComments = db.prepare(
    'SELECT id, author, content FROM comments WHERE post_id = ? AND is_resolution = 0 ORDER BY created_at ASC LIMIT 12'
  ).all(id) as Pick<Comment, 'id' | 'author' | 'content'>[];

  // ① 독립 생성: 첫 에이전트 댓글이면 선입견 없이 작성 (앵커링 방지)
  const priorAgentCount = allComments.filter(c => AGENT_IDS_SET.has(c.author)).length;
  const isFirstAgentComment = priorAgentCount === 0;

  // ② 수렴 감지: ≥3 에이전트 댓글 && 60%+ 동의 어조 → 강제 반론
  const isConverging = !isFirstAgentComment && detectConvergence(
    allComments as Pick<Comment, 'author' | 'content'>[]
  );

  // ③ 컨텍스트 익명화: 이름 제거, 역할 기능 레이블만 표시 (Identity Bias 차단)
  const commentsForContext = isFirstAgentComment ? [] : allComments;
  const commentText = commentsForContext.length > 0
    ? commentsForContext.map((c, idx) => {
        const roleLabel = c.author === 'owner' ? '대표' : (AGENT_ROLE_LABELS[c.author] ?? '팀원');
        return `#${idx + 1} [${roleLabel}]: ${c.content.slice(0, 500)}`;
      }).join('\n\n')
    : '(아직 댓글이 없습니다)';

  const convergenceWarning = isConverging
    ? '\n\n⚠️ **수렴 경보**: 현재까지 의견이 같은 방향으로 수렴하고 있습니다. 반드시 반론이나 맹점을 첫 번째로 제시하세요. 동의로 시작하는 답변은 금지합니다.'
    : '';

  const engageInstruction = commentsForContext.length > 0 ? `

**[이전 댓글 참조 — 필수]** 위 댓글을 읽고 다음 중 하나 이상:
- **반박**: "#N 의견에서 '…' 부분은 [이유]로 재고가 필요합니다." 형식으로 논리적 문제 지적.
- **보강**: "#N 포인트에 동의하며, 추가로 [새 근거/데이터]를 고려해야 합니다." 형식으로 강화.
- **확장**: 언급된 아이디어를 당신의 전문 렌즈로 다른 각도에서 분석.
단순 요약·모든 의견에 동의하는 답변 금지.` : '';

  const persona = AGENT_PERSONAS[agent];
  const agentMeta = AUTHOR_META[agent as keyof typeof AUTHOR_META];
  const agentDisplay = agentMeta?.name ?? agentMeta?.label ?? agent;

  const prompt = `${persona}

다음은 팀 토론 게시글입니다:

**제목**: ${post.title}
**내용**: ${(post.content as string).slice(0, 800)}

**현재까지의 댓글**:
${commentText.slice(0, 2000)}${convergenceWarning}${engageInstruction}

위 토론에 대해 당신의 역할과 전문성에 맞는 의견을 제시하세요. 마크다운 사용 가능.
⚠️ 댓글 끝에 서명("— 이름") 절대 추가 금지.`;

  broadcastEvent({ type: 'agent_typing', post_id: id, data: { agent, label: agentDisplay } });

  // ④ Temperature 차등 적용
  const temperature = AGENT_TEMPERATURE[agent] ?? AGENT_TEMPERATURE_DEFAULT;

  try {
    let raw: string;
    try {
      raw = await callLLM(prompt, { model: MODEL_QUALITY, maxTokens: 1200, timeoutMs: 15000, temperature });
    } catch (err) {
      if (err instanceof LLMError && err.isTimeout) {
        return NextResponse.json({ error: 'Agent response timed out' }, { status: 504 });
      }
      if (err instanceof LLMError && err.status === 503) {
        return NextResponse.json({ error: 'AI 미설정' }, { status: 503 });
      }
      throw err;
    }

    const content = raw.replace(/\n*—\s*[^\n]+$/, '').trim();
    if (!content || content === '[SKIP]') {
      return NextResponse.json({ error: '에이전트가 응답을 건너뛰었습니다' }, { status: 204 });
    }

    const cid = nanoid();
    db.prepare(
      `INSERT INTO comments (id, post_id, author, author_display, content, is_resolution, is_visitor, parent_id)
       VALUES (?, ?, ?, ?, ?, 0, 0, NULL)`
    ).run(cid, id, agent, agentDisplay, content);

    updatePostStatus(id, 'in-progress');

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(cid);
    broadcastEvent({ type: 'new_comment', post_id: id, data: comment });
    return NextResponse.json(comment, { status: 201 });
  } catch (e) {
    console.error('[ask-agent]', e);
    return NextResponse.json({ error: '에이전트 오류' }, { status: 500 });
  }
}
