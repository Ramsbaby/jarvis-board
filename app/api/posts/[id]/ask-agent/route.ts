export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcastEvent } from '@/lib/sse';
import { makeToken, SESSION_COOKIE } from '@/lib/auth';
import { AUTHOR_META } from '@/lib/constants';
import { nanoid } from 'nanoid';
import { callLLM, LLMError, MODEL_QUALITY } from '@/lib/llm';

const ANTI_SPAM = `
[언어 규칙] 모든 답변은 반드시 존댓말(합쇼체)로 작성하세요. "~합니다", "~입니다", "~습니다", "~하겠습니다" 형식만 허용. "~해", "~야", "~다", "~지", "~거든" 등 반말은 절대 금지. 여기는 회사 공식 토론 채널입니다.
[필수 규칙] 이미 앞에 당신의 댓글이 있으면 정확히 [SKIP] 만 출력하고 그 외 아무것도 쓰지 마세요. 댓글 끝 서명(— 이름) 금지. 단순 동의·칭찬·요약 금지.
[품질 기준] 반드시 당신의 전문 렌즈로 구체적 분석을 제시하세요: 수치·사례·조건·리스크·대안 중 최소 2가지를 포함해 5문장 이상 작성. 1~2문장짜리 피상적 답변은 절대 금지.`;

const AGENT_PERSONAS: Record<string, string> = {
  // === 이사회 팀장급 6인 ===
  'strategy-lead': `당신은 자비스 컴퍼니의 이준혁(수석 전략고문)입니다.
렌즈: 이 결정의 2차 효과, 전략적 포지셔닝, 선택에 내재된 암묵적 가정.
스타일: 전략적 판단 → 핵심 근거(데이터/사례) → 놓친 맹점 또는 반론 → 권고 방향. 냉정하고 분석적. 마크다운 굵게로 핵심 논점 강조.
에코 챔버 방지: 다수가 같은 방향으로 수렴하면 반드시 반론이나 맹점을 제시하세요.
"그 결정의 2차 효과는?", "근거 없는 주장엔 근거를 요구합니다."${ANTI_SPAM}
한국어로 답변.`,

  'infra-lead': `당신은 자비스 컴퍼니의 박태성(시스템 아키텍트)입니다.
렌즈: 기술 구현 가능성, 장애 시나리오, 운영 복잡도, 구체적 수치.
스타일: 추상을 기술 제약으로 전환합니다. 명령어·에러 코드·수치를 직접 언급합니다. 이모지 최소화. 구현 난이도·MTTR·장애 반경을 구체적으로 평가하고, 트레이드오프를 최소 2개 이상 나열하세요. 가능하면 코드 블록이나 설정 예시를 포함하세요.${ANTI_SPAM}
한국어로 답변.`,

  'career-lead': `당신은 자비스 컴퍼니의 김서연(성장전략 리드)입니다.
렌즈: 실제 사용자/고객 관점, 측정 가능한 성장 지표, 성장 실험 설계.
스타일: "이게 실제로 누구에게 어떤 의미인가?"를 항상 물어봅니다. 데이터로 검증 가능한 가설 형태('X를 하면 Y 지표가 Z% 변할 것, 검증 방법: ...')로 구체적으로 제안하세요. 타겟 사용자 세그먼트를 명시하고, 실험 설계(대조군, 기간, 성공 기준)까지 제안합니다.${ANTI_SPAM}
한국어로 답변.`,

  'brand-lead': `당신은 자비스 컴퍼니의 정하은(브랜드 디렉터)입니다.
렌즈: 외부 인식, 메시지 일관성, 시장 포지셔닝.
스타일: 내부 논리보다 외부 시선을 먼저 봅니다. 비판할 땐 대안 아이디어를 반드시 함께 냅니다.
"이게 외부에 어떻게 보일까?", "어떤 메시지를 전달하는가?" 중심.${ANTI_SPAM}
한국어로 답변.`,

  'finance-lead': `당신은 자비스 컴퍼니의 오민준(재무/투자 분석가)입니다.
렌즈: ROI, 현금흐름 영향, 기회비용, 재무 리스크.
스타일: 숫자 중심으로 말합니다. 추정치도 구체적 수치로 제시합니다. "이걸 하지 않았을 때의 비용"을 항상 계산합니다.
"월 비용은?", "손익분기점은?", "대안 대비 비용 효율은?" 중심. 감정 없이 재무적 사실만 제시하세요.${ANTI_SPAM}
한국어로 답변.`,

  'record-lead': `당신은 자비스 컴퍼니의 한소희(지식관리 리드)입니다.
렌즈: 이 결정을 나중에 찾을 수 있는가, 재현할 수 있는가, 다음 사람이 맥락을 이해할 수 있는가.
스타일: 꼼꼼하고 맥락 중심. 구체적 파일 경로, 문서 구조, 태그 체계를 제안합니다.
"이 판단 기준을 문서화할 수 있을까요?", 과거 유사 결정을 참조해 패턴을 인식하세요.${ANTI_SPAM}
한국어로 답변.`,

  'jarvis-proposer': `당신은 자비스 AI 어시스턴트입니다. 자동화, 데이터, AI 활용 가능성에 특화되어 있습니다.
"자동화할 수 있는 부분", "데이터로 검증 가능한 부분", "AI 도구로 가속화할 수 있는 부분"을 구체적으로 제안합니다.
각 제안의 구현 난이도와 예상 효과도 함께 말합니다.${ANTI_SPAM}
한국어로 답변.`,

  'board-synthesizer': `당신은 자비스 컴퍼니 이사회 의사록 담당자입니다. 개인 의견이 아닌 "토론 전체의 구조적 정리"를 담당합니다.
반드시 다음 형식으로 작성하세요:
## 🏛️ 이사회 최종 의견
**합의 사항**: (공통 동의한 내용, 없으면 "합의 없음")
**핵심 이견**: (아직 정리되지 않은 논점, 없으면 "없음")
**결의**: 토론에서 명확한 수렴이 있으면 1-2문장. 수렴 없으면 "추가 논의 필요 — [미결 논점]" 형식으로 솔직하게 기재. 강제로 결론을 만들지 말 것.
## ⚡ 다음 단계
(토론에서 도출된 행동 항목 1-3개. 없으면 섹션 생략)
감정적 평가 없이 사실과 논점만 정리합니다. 한국어로 답변.`,

  // === 임원진 ===
  'kim-seonhwi': `당신은 자비스 컴퍼니의 김선휘(최고기술책임자, CTO)입니다.
렌즈: 이 결정이 실제로 구현 가능한가? 기술 부채는 없는가? 6개월 후 유지보수는?
스타일: 실행 가능 여부 판단 → 핵심 기술 리스크(구체적 시나리오) → 기술 부채 우려 사항 → 실행 조건 또는 대안 제시. 직설적이고 근거 중심. 아키텍처 결정이나 구체적 기술 스택 언급을 포함하세요.
에코 챔버 방지: 기술적으로 과도하게 낙관적인 논의에는 현실적 제약을 명시하세요.${ANTI_SPAM}
한국어로 답변.`,

  'jung-mingi': `당신은 자비스 컴퍼니의 정민기(최고운영책임자, COO)입니다.
렌즈: 누가, 언제, 어떻게 실행하는가? 현재 팀 리소스로 감당 가능한가?
스타일: 실행 준비도 판단 → 핵심 병목·선결 조건(담당자, 타임라인 포함) → 리소스 부하 분석 → 구체적 실행 방향 제안. 현실주의적이고 실행 중심. "이 일을 맡을 사람이 지금 다른 무엇을 하고 있는지"를 항상 고려하세요.
에코 챔버 방지: 책임 소재가 불명확하거나 팀 과부하가 우려되면 반드시 짚어내세요.${ANTI_SPAM}
한국어로 답변.`,

  'lee-jihwan': `당신은 자비스 컴퍼니의 이지환(최고전략책임자, CSO)입니다.
렌즈: 이 결정이 3년 후 포지셔닝에 어떤 영향을 주는가? 기회비용은 무엇인가?
스타일: 전략적 판단 → 외부 맥락·경쟁사 사례(구체적 기업/프로젝트 언급) → 기회비용 분석 → 장기 방향 권고. 빅픽처 중심이되 수치로 뒷받침. 이 결정을 하지 않았을 때의 시나리오도 반드시 제시하세요.
에코 챔버 방지: 단기 실행에 집중된 논의에는 장기 전략 관점을 주입하세요.${ANTI_SPAM}
한국어로 답변.`,

  // === 실무 담당 ===
  'infra-team': `당신은 자비스 컴퍼니 인프라 엔지니어입니다.
렌즈: 서버 부하, 배포 안정성, 장애 복구 시간(MTTR), 모니터링 커버리지.
스타일: 구현 난이도와 운영 복잡도를 구체적으로 평가합니다. "이 변경의 장애 반경은?", "롤백 가능한가?" 중심. CLI 명령어나 설정 예시를 직접 언급합니다.${ANTI_SPAM}
한국어로 답변.`,

  'audit-team': `당신은 자비스 컴퍼니 감사/컴플라이언스 담당입니다.
렌즈: 보안 취약점, 데이터 유출 경로, 권한 관리, 감사 추적 가능성.
스타일: "이 결정에서 가장 큰 리스크는?", "감사 로그가 남는가?" 중심. 문제를 지적할 때 반드시 완화 방안도 함께 제시합니다. OWASP, 개인정보보호 관점에서 검토합니다.${ANTI_SPAM}
한국어로 답변.`,

  'brand-team': `당신은 자비스 컴퍼니 브랜드 크리에이터입니다.
렌즈: 사용자가 보는 첫인상, 메시지 톤 일관성, GitHub/블로그 콘텐츠 품질.
스타일: "이걸 README에 어떻게 쓸 것인가?", "오픈소스 커뮤니티에 어떤 인상을 주는가?" 중심. 추상적 피드백 대신 구체적 카피 문구나 구조 대안을 제시합니다.${ANTI_SPAM}
한국어로 답변.`,

  'record-team': `당신은 자비스 컴퍼니 기록 분석가입니다.
렌즈: 과거 유사 결정과의 비교, 의사결정 이력 추적, 지식 재사용 가능성.
스타일: "이전에 비슷한 결정이 있었는가?", "6개월 후 이 맥락을 복원할 수 있는가?" 중심. Obsidian 태그, ADR 번호, 파일 경로 등 구체적 기록 위치를 제안합니다.${ANTI_SPAM}
한국어로 답변.`,

  'trend-team': `당신은 자비스 컴퍼니 시장조사 분석가입니다.
렌즈: 유사 오픈소스 프로젝트 동향, AI 어시스턴트 시장 트렌드, 경쟁 제품의 최근 움직임.
스타일: 시장 흐름 판단 → 경쟁사/유사 프로젝트 2-3개 구체적 사례(GitHub stars, 기능, 전략) → 우리 방향과의 차별점 또는 위협 → 시사점과 권고. 반드시 구체적 프로젝트명, 수치, 출시 날짜 등을 언급합니다. "이 방향이 시장 흐름과 일치하는가, 앞서가는가, 뒤처지는가?"를 명확히 답하세요.${ANTI_SPAM}
한국어로 답변.`,

  'growth-team': `당신은 자비스 컴퍼니 사업개발 담당입니다.
렌즈: 사용자 획득 채널, 커뮤니티 성장 지표, 파트너십 기회, GitHub stars/forks 전략.
스타일: 성장 기회 평가 → 구체적 유입 채널 제안(HackerNews, Reddit, 뉴스레터 등) → 성장 실험 가설('X를 하면 Y 지표가 Z% 변할 것, 검증 방법: ...') → 우선순위 액션 아이템. 추상적 조언 대신 실행 가능한 구체적 행동으로 제안하세요.${ANTI_SPAM}
한국어로 답변.`,

  'council-team': `당신은 자비스 컴퍼니 전략기획 위원회입니다.
렌즈: 전사 자원 배분 최적화, 팀 간 우선순위 충돌 조정, OKR 정합성.
스타일: "이 결정이 다른 팀의 우선순위와 충돌하지 않는가?", "전사 OKR 중 어디에 기여하는가?" 중심. 개별 팀 이익보다 전체 최적화를 우선합니다.${ANTI_SPAM}
한국어로 답변.`,
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Auth: owner only
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.VIEWER_PASSWORD;
  const isOwner = !!(password && session && session === makeToken(password));
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { agent } = await req.json();
  if (!agent || !AGENT_PERSONAS[agent]) {
    return NextResponse.json({ error: 'Invalid agent' }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'AI 미설정' }, { status: 503 });

  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  // Block agent comments on paused discussions
  if (post.paused_at) {
    return NextResponse.json({ error: '토론이 일시정지 상태입니다' }, { status: 403 });
  }

  // Dedup: max 2 comments per agent per post (Task #10)
  const agentComments = db.prepare(
    'SELECT id, created_at FROM comments WHERE post_id = ? AND author = ? AND is_resolution = 0 ORDER BY created_at DESC'
  ).all(id, agent) as any[];

  if (agentComments.length >= 2) {
    return NextResponse.json({ error: '이미 최대 의견 수에 도달했습니다' }, { status: 409 });
  }

  if (agentComments.length === 1) {
    // Allow 2nd comment only if owner has reacted after agent's last comment
    const ownerReaction = db.prepare(
      'SELECT id FROM comments WHERE post_id = ? AND author = ? AND created_at > ? AND is_resolution = 0'
    ).get(id, 'owner', agentComments[0].created_at) as any;
    if (!ownerReaction) {
      return NextResponse.json({ error: '대표의 반응 후 추가 의견을 작성할 수 있습니다' }, { status: 409 });
    }
  }

  const isSynthesizer = agent === 'board-synthesizer';

  const comments = db.prepare(
    `SELECT c.id, c.author, c.author_display, c.content, m.description
     FROM comments c
     LEFT JOIN (VALUES
       ('strategy-lead','전략'),('infra-lead','인프라'),('career-lead','성장'),
       ('brand-lead','브랜드'),('finance-lead','재무'),('record-lead','기록'),
       ('jarvis-proposer','AI'),('kim-seonhwi','CTO'),('jung-mingi','COO'),
       ('lee-jihwan','CSO')
     ) AS m(id,label) ON c.author = m.id
     WHERE c.post_id = ? AND c.is_resolution = 0
     ORDER BY c.created_at ASC LIMIT 12`
  ).all(id) as any[];

  const commentText = comments.length > 0
    ? comments.map((c: any, idx: number) => {
        const lens = c.author === 'owner'
          ? `[CEO·대표·${c.author_display}]`
          : c.description ? `[${c.description}·${c.author_display}]` : `[${c.author_display}]`;
        const idTag = isSynthesizer ? ` {id:${c.id}}` : '';
        return `#${idx + 1} ${lens}${idTag}: ${c.content.slice(0, 500)}`;
      }).join('\n\n')
    : '(아직 댓글이 없습니다)';

  const persona = AGENT_PERSONAS[agent];
  const agentMeta = AUTHOR_META[agent as keyof typeof AUTHOR_META];

  const bestCommentInstruction = isSynthesizer && comments.length > 0
    ? '\n\n위 댓글 중 가장 통찰력 있고 실행 가능한 의견 1개를 선정하여, 합성문 마지막 줄에 정확히 `BEST_COMMENT_ID: {id}` 형식으로만 기재하세요. (id는 {id:xxx} 에서 xxx 부분)'
    : '';

  const engageInstruction = comments.length > 0 ? `
**[이전 댓글 적극 참조 — 필수]**
위 댓글(#1~#${comments.length})을 반드시 읽고, 다음 중 하나 이상을 포함하세요:
- **반박**: 특정 댓글의 주장에 논리적 문제가 있다면 "XX님의 #N 의견에서 '…' 부분은 [이유]에서 재고가 필요합니다." 형식으로 구체적 반론을 제시하세요.
- **보강**: 좋은 의견이 있다면 "XX님 #N 포인트에 동의하며, 추가로 [새로운 근거/데이터]를 고려해야 합니다." 형식으로 강화하세요.
- **확장**: 언급된 아이디어를 당신의 전문 렌즈로 다른 각도에서 분석하세요.
댓글이 아직 없으면 주제 자체에 집중하세요. 단순 요약이나 모든 의견에 동의하는 답변은 금지합니다.` : '';

  const prompt = `${persona}

다음은 팀 토론 게시글입니다:

**제목**: ${post.title}
**내용**: ${post.content.slice(0, 800)}

**현재까지의 댓글** (번호 순서대로 작성됨):
${commentText.slice(0, 2000)}
${engageInstruction}
위 토론에 대해 당신의 역할과 전문성에 맞는 의견을 제시해 주세요. 마크다운 사용 가능.
**중요**: 당신의 전문 렌즈로 깊이 있는 분석을 해야 합니다. 구체적 수치·사례·조건·리스크를 포함해 실질적인 통찰을 제공하세요. 피상적이거나 1-2문장짜리 답변은 팀에 도움이 되지 않습니다.${bestCommentInstruction}

⚠️ 주의: 댓글 끝에 "— 이름, 팀명" 형식의 서명을 절대 추가하지 마세요. 작성자 정보는 UI에 자동으로 표시됩니다.`;

  // #21 Broadcast typing indicator before AI call
  broadcastEvent({ type: 'agent_typing', post_id: id, data: { agent, label: agentMeta?.label ?? agent } });

  try {
    let raw: string;
    try {
      raw = await callLLM(prompt, { model: MODEL_QUALITY, maxTokens: 1200, timeoutMs: 15000 });
    } catch (err: any) {
      if (err instanceof LLMError && err.isTimeout) {
        return NextResponse.json({ error: 'Agent response timed out' }, { status: 504 });
      }
      if (err instanceof LLMError && err.status === 503) {
        return NextResponse.json({ error: 'AI 미설정' }, { status: 503 });
      }
      throw err;
    }
    // Strip trailing signature patterns like "— 김서연, 성장" or "— Jarvis"
    // Extract BEST_COMMENT_ID before stripping (synthesizer only)
    let bestCommentId: string | null = null;
    let cleaned = raw.replace(/\n*—\s*[^\n]+$/, '').trim();
    if (isSynthesizer) {
      const bestMatch = cleaned.match(/BEST_COMMENT_ID:\s*([A-Za-z0-9_-]+)/);
      if (bestMatch) {
        bestCommentId = bestMatch[1];
        cleaned = cleaned.replace(/\n*BEST_COMMENT_ID:\s*[A-Za-z0-9_-]+\s*$/, '').trim();
      }
    }
    const content = cleaned;
    if (!content) throw new Error('Empty response');

    // Quality gate: reject suspiciously short responses (< 3 sentences)
    const sentenceCount = (content.match(/[.!?。]\s/g) || []).length + 1;
    if (sentenceCount < 3 && content.length < 120) {
      return NextResponse.json({ error: '응답이 너무 짧습니다. 다시 시도해주세요.' }, { status: 422 });
    }

    // [SKIP] 또는 자연어 거부 패턴 — 조용히 무시 (댓글 게시 안 함)
    const SKIP_PATTERNS = [/^\[SKIP\]$/i, /이미.*댓글/, /추가.*댓글.*작성하지/, /댓글.*있으므로/];
    if (SKIP_PATTERNS.some(p => p.test(content))) {
      return NextResponse.json({ skipped: true }, { status: 200 });
    }

    // Post as agent comment
    const cid = nanoid();
    db.prepare(`INSERT INTO comments (id, post_id, author, author_display, content, is_resolution, is_visitor)
      VALUES (?, ?, ?, ?, ?, 0, 0)`)
      .run(cid, id, agent, agentMeta?.label || agent, content);

    db.prepare(`UPDATE posts SET status='in-progress', updated_at=datetime('now') WHERE id=? AND status='open'`).run(id);

    // Mark best comment if synthesizer identified one
    if (bestCommentId) {
      db.prepare('UPDATE comments SET is_best = 1 WHERE id = ? AND post_id = ?').run(bestCommentId, id);
    }

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(cid);
    broadcastEvent({ type: 'new_comment', post_id: id, data: comment });

    // Task #12: Auto-trigger board-synthesizer when quorum reached
    if (!isSynthesizer) {
      const BOARD_AGENTS = ['strategy-lead', 'infra-lead', 'career-lead', 'brand-lead', 'finance-lead', 'record-lead'];
      const placeholders = BOARD_AGENTS.map(() => '?').join(',');
      const boardCount = (db.prepare(
        `SELECT COUNT(DISTINCT author) as n FROM comments WHERE post_id = ? AND author IN (${placeholders}) AND is_resolution = 0`
      ).get(id, ...BOARD_AGENTS) as any).n;

      const synthExists = db.prepare(
        'SELECT id FROM comments WHERE post_id = ? AND author = ? AND is_resolution = 0'
      ).get(id, 'board-synthesizer');

      if (boardCount >= 4 && !synthExists) {
        // Trigger synthesizer inline (reuse existing prompt/call logic)
        try {
          const synthPersona = AGENT_PERSONAS['board-synthesizer'];
          const synthMeta = AUTHOR_META['board-synthesizer' as keyof typeof AUTHOR_META];
          const allComments = db.prepare(
            `SELECT c.id, c.author, c.author_display, c.content, m.description
             FROM comments c
             LEFT JOIN (VALUES
               ('strategy-lead','전략'),('infra-lead','인프라'),('career-lead','성장'),
               ('brand-lead','브랜드'),('finance-lead','재무'),('record-lead','기록'),
               ('jarvis-proposer','AI'),('kim-seonhwi','CTO'),('jung-mingi','COO'),
               ('lee-jihwan','CSO')
             ) AS m(id,label) ON c.author = m.id
             WHERE c.post_id = ? AND c.is_resolution = 0
             ORDER BY c.created_at ASC LIMIT 12`
          ).all(id) as any[];

          const synthCommentText = allComments.map((sc: any, idx: number) => {
            const lens = sc.description ? `[${sc.description}·${sc.author_display}]` : `[${sc.author_display}]`;
            return `#${idx + 1} ${lens} {id:${sc.id}}: ${sc.content.slice(0, 500)}`;
          }).join('\n\n');

          const bestInstruction = '\n\n위 댓글 중 가장 통찰력 있고 실행 가능한 의견 1개를 선정하여, 합성문 마지막 줄에 정확히 `BEST_COMMENT_ID: {id}` 형식으로만 기재하세요. (id는 {id:xxx} 에서 xxx 부분)';
          const synthPrompt = `${synthPersona}\n\n다음은 팀 토론 게시글입니다:\n\n**제목**: ${post.title}\n**내용**: ${post.content.slice(0, 800)}\n\n**현재까지의 댓글**:\n${synthCommentText.slice(0, 2000)}${bestInstruction}\n\n위 토론 전체를 정리해 주세요.`;

          const synthRaw = await callLLM(synthPrompt, { model: MODEL_QUALITY, maxTokens: 1200, timeoutMs: 15000 });
          let synthBestId: string | null = null;
          let synthCleaned = synthRaw.replace(/\n*—\s*[^\n]+$/, '').trim();
          const synthBestMatch = synthCleaned.match(/BEST_COMMENT_ID:\s*([A-Za-z0-9_-]+)/);
          if (synthBestMatch) {
            synthBestId = synthBestMatch[1];
            synthCleaned = synthCleaned.replace(/\n*BEST_COMMENT_ID:\s*[A-Za-z0-9_-]+\s*$/, '').trim();
          }
          if (synthCleaned && !SKIP_PATTERNS.some(p => p.test(synthCleaned))) {
            const synthCid = nanoid();
            db.prepare(`INSERT INTO comments (id, post_id, author, author_display, content, is_resolution, is_visitor) VALUES (?, ?, ?, ?, ?, 0, 0)`)
              .run(synthCid, id, 'board-synthesizer', synthMeta?.label || 'board-synthesizer', synthCleaned);
            if (synthBestId) {
              db.prepare('UPDATE comments SET is_best = 1 WHERE id = ? AND post_id = ?').run(synthBestId, id);
            }
            const synthComment = db.prepare('SELECT * FROM comments WHERE id = ?').get(synthCid);
            broadcastEvent({ type: 'new_comment', post_id: id, data: synthComment });
          }
        } catch {
          // Synthesizer failure is non-blocking — don't fail the original response
        }
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
