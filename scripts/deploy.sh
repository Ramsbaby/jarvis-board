#!/usr/bin/env bash
# jarvis-board 배포 스크립트
# 빌드 → standalone 청크 동기화 → 서비스 재시작
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🏗  Building..."
NEXT_TELEMETRY_DISABLED=1 npx next build

STANDALONE_NEXT="/Users/ramsbaby/jarvis-board/.next/standalone/jarvis-board/.next"
SRC_NEXT="/Users/ramsbaby/jarvis-board/.next"

echo "📦 Syncing server chunks → standalone..."
rsync -a "${SRC_NEXT}/server/"    "${STANDALONE_NEXT}/server/"
rsync -a "${SRC_NEXT}/static/"    "${STANDALONE_NEXT}/static/"
cp -f    "${SRC_NEXT}/routes-manifest.json" "${STANDALONE_NEXT}/" 2>/dev/null || true

echo "🔄 Restarting ai.jarvis.board..."
launchctl kickstart -k "gui/$(id -u)/ai.jarvis.board"

sleep 3
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/company)
echo "✅ Done — /company HTTP ${STATUS}"

# Pre-warm: 핵심 API 라우트를 병렬 컴파일 — 첫 유저 요청이 6~12s 걸리는 현상 방지
# x-agent-key 헤더로 미들웨어 인증 우회, 라우트 핸들러까지 도달해야 컴파일됨
echo "🔥 Pre-warming API routes..."
AGENT_KEY="jarvis-board-internal-2026"
WARM_ROUTES=(
  "/api/crons"
  "/api/agent-live"
  "/api/map/statusline"
  "/api/entity/disk-storage/briefing"
  "/api/entity/discord-bot/briefing"
  "/api/entity/rag-memory/briefing"
)
for route in "${WARM_ROUTES[@]}"; do
  t=$( { time curl -s -o /dev/null -H "x-agent-key: ${AGENT_KEY}" "http://localhost:3100${route}"; } 2>&1 | grep real | awk '{print $2}' )
  echo "  → ${route} (${t})"
done
echo "✅ Pre-warm complete (${#WARM_ROUTES[@]} routes)"
