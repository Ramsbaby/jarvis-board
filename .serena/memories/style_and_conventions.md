# Code Style & Conventions

## TypeScript
- **strict mode** 활성화 (`tsconfig.json`)
- 타입 단언(`as`) 최소화, `unknown` > `any`
- 인터페이스 명: PascalCase (e.g., `AgentDef`, `PostRow`)
- 함수/변수: camelCase
- 상수: SCREAMING_SNAKE_CASE (e.g., `MODEL_FAST`, `DB_PATH`)

## Next.js 16 App Router 규칙
- **IMPORTANT**: Next.js 16 has breaking changes. Always check `node_modules/next/dist/docs/` for current API.
- Route Handlers: `app/api/[resource]/route.ts` — export named `GET`, `POST`, `PUT`, `DELETE`
- Server Components by default; Client Components need `'use client'` directive
- `'use server'` for Server Actions
- Layout: `app/layout.tsx`, page: `app/page.tsx`
- Dynamic routes: `app/posts/[id]/page.tsx`

## React
- React 19 — use new hooks/APIs where available
- Client Components suffix: `*Client.tsx` (e.g., `DevTasksClient.tsx`, `TaskDetailClient.tsx`)
- Context in `contexts/` directory

## File Naming
- Components: PascalCase `.tsx` (e.g., `PostList.tsx`)
- Lib utilities: camelCase `.ts` (e.g., `auto-poster.ts`)
- API routes: `route.ts`

## DB 패턴
- `getDb()` 싱글턴으로 항상 접근 (import from `@/lib/db`)
- WAL 모드 활성화됨
- 날짜: SQLite `datetime('now')` — ISO 8601 문자열
- ID: `nanoid()` 사용

## LLM 패턴
- `callLLM(prompt, options)` — `lib/llm.ts`
- 간단한 작업 (태그 생성, 요약): `MODEL_FAST` (llama-3.1-8b-instant)
- 에이전트 페르소나 응답: `MODEL_QUALITY` (llama-3.3-70b-versatile)
- 타임아웃/에러: `LLMError` 클래스

## 에러 처리
- API route에서 try-catch, `NextResponse.json({ error }, { status: N })`
- 중요 에러는 console.error

## 스타일 (CSS/Tailwind)
- TailwindCSS v4 — PostCSS 방식 (`@tailwindcss/postcss`)
- 다크모드: `dark:` prefix
- 폰트: Pretendard (CDN)
- 테마: `#18181b` 배경 (zinc-900 계열)

## 설계 원칙
- SSoT: 에이전트 정의는 `lib/agents.ts` 하나에만
- DRY: 3회 이상 반복 시 함수 추출
- 파일 1,500줄 초과 금지
