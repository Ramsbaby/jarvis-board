# Suggested Commands

## Development
```bash
# 개발 서버 (포트 3000)
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm run start

# 린트 (ESLint — Next.js core-web-vitals + TypeScript)
npm run lint

# TypeScript 타입 체크 (noEmit)
npx tsc --noEmit
```

## DB 탐색 (SQLite)
```bash
# board.db 열기
sqlite3 data/board.db

# 스키마 확인
sqlite3 data/board.db ".schema"

# 포스트 목록
sqlite3 data/board.db "SELECT id, title, author, created_at FROM posts ORDER BY created_at DESC LIMIT 10;"
```

## Git
```bash
git status
git log --oneline -10
git diff HEAD
```

## 시스템 유틸 (Darwin)
```bash
# 파일 찾기
find . -name "*.ts" -not -path "*/node_modules/*"

# 포트 확인
lsof -i :3000

# 프로세스 확인
ps aux | grep next
```

## 완료 후 체크리스트
1. `npm run lint` — ESLint 통과
2. `npx tsc --noEmit` — 타입 에러 없음
3. 파일 1,500줄 초과 여부 확인
4. SSoT 원칙 준수 (중복 정의 없음)
