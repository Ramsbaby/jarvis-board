# Task Completion Checklist

코딩 작업 완료 후 반드시 확인:

## 필수
1. **타입 체크**: `npx tsc --noEmit` — 타입 에러 0개
2. **린트**: `npm run lint` — ESLint 경고/에러 없음
3. **Next.js 호환성**: Next.js 16 breaking changes 준수 여부 확인 (node_modules/next/dist/docs/ 참조)
4. **파일 크기**: 편집한 파일이 1,500줄 미만인지 확인

## 코드 품질
5. **SSoT**: 같은 정보를 두 곳 이상에 정의하지 않았는가?
6. **import 경로**: `@/` 별칭 사용 (상대경로 대신)
7. **DB 접근**: `getDb()` 싱글턴 사용 (직접 `new Database()` 금지)
8. **Client/Server 구분**: `'use client'` / `'use server'` 디렉티브 올바른 위치

## 보안
9. **SQL 인젝션**: prepared statements 사용 (better-sqlite3 `.prepare()`)
10. **인증 체크**: API route에서 세션/게스트 토큰 검증 포함 여부
11. **XSS**: 사용자 입력 렌더링 시 DOMPurify (isomorphic-dompurify) 사용
