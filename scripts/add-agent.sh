#!/usr/bin/env bash
# add-agent.sh — 새 AI 에이전트를 lib/agents.ts에 자동 추가하고 수동 작업을 안내한다.
# 사용법: ./scripts/add-agent.sh --id "marketing-lead" --name "박지민" --emoji "📣" --tier "team-lead" --group "이사회"
set -euo pipefail

# ── 색상 정의 ───────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── 프로젝트 루트 (스크립트 위치 기준 ..) ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AGENTS_FILE="${PROJECT_ROOT}/lib/agents.ts"

# ── 인자 파싱 ────────────────────────────────────────────────────────────────
AGENT_ID=""
AGENT_NAME=""
AGENT_EMOJI=""
AGENT_TIER=""
AGENT_GROUP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id)    AGENT_ID="$2";    shift 2 ;;
    --name)  AGENT_NAME="$2";  shift 2 ;;
    --emoji) AGENT_EMOJI="$2"; shift 2 ;;
    --tier)  AGENT_TIER="$2";  shift 2 ;;
    --group) AGENT_GROUP="$2"; shift 2 ;;
    *)
      echo -e "${RED}알 수 없는 옵션: $1${RESET}" >&2
      echo "사용법: $0 --id ID --name 이름 --emoji 이모지 --tier TIER --group 그룹" >&2
      exit 1
      ;;
  esac
done

# ── 필수 인자 확인 ────────────────────────────────────────────────────────────
missing=()
if [[ -z "${AGENT_ID}"    ]]; then missing+=("--id");    fi
if [[ -z "${AGENT_NAME}"  ]]; then missing+=("--name");  fi
if [[ -z "${AGENT_EMOJI}" ]]; then missing+=("--emoji"); fi
if [[ -z "${AGENT_TIER}"  ]]; then missing+=("--tier");  fi
if [[ -z "${AGENT_GROUP}" ]]; then missing+=("--group"); fi

if [[ ${#missing[@]} -gt 0 ]]; then
  echo -e "${RED}필수 인자 누락: ${missing[*]}${RESET}" >&2
  echo "사용법: $0 --id ID --name 이름 --emoji 이모지 --tier TIER --group 그룹" >&2
  exit 1
fi

# ── ID 패턴 검사 ─────────────────────────────────────────────────────────────
if ! [[ "${AGENT_ID}" =~ ^[a-z][a-z0-9-]+$ ]]; then
  echo -e "${RED}오류: --id 는 소문자·숫자·하이픈만 허용되며 소문자로 시작해야 합니다. (입력: '${AGENT_ID}')${RESET}" >&2
  exit 1
fi

# ── tier 값 검사 ──────────────────────────────────────────────────────────────
valid_tiers=("executives" "team-lead" "staff")
tier_valid=false
for t in "${valid_tiers[@]}"; do
  if [[ "${AGENT_TIER}" == "$t" ]]; then
    tier_valid=true
    break
  fi
done
if [[ "${tier_valid}" == false ]]; then
  echo -e "${RED}오류: --tier 는 executives | team-lead | staff 중 하나여야 합니다. (입력: '${AGENT_TIER}')${RESET}" >&2
  exit 1
fi

# ── group 값 검사 ─────────────────────────────────────────────────────────────
valid_groups=("임원진" "이사회" "전문가")
group_valid=false
for g in "${valid_groups[@]}"; do
  if [[ "${AGENT_GROUP}" == "$g" ]]; then
    group_valid=true
    break
  fi
done
if [[ "${group_valid}" == false ]]; then
  echo -e "${RED}오류: --group 은 임원진 | 이사회 | 전문가 중 하나여야 합니다. (입력: '${AGENT_GROUP}')${RESET}" >&2
  exit 1
fi

# ── agents.ts 존재 확인 ───────────────────────────────────────────────────────
if [[ ! -f "${AGENTS_FILE}" ]]; then
  echo -e "${RED}오류: ${AGENTS_FILE} 파일을 찾을 수 없습니다.${RESET}" >&2
  exit 1
fi

# ── 중복 ID 확인 ──────────────────────────────────────────────────────────────
if grep -qE "id: '${AGENT_ID}'" "${AGENTS_FILE}"; then
  echo -e "${RED}오류: '${AGENT_ID}' 는 이미 lib/agents.ts에 존재합니다.${RESET}" >&2
  exit 1
fi

# ── lib/agents.ts 수정: tier의 마지막 항목 뒤에 삽입 ─────────────────────────
# python3 인라인으로 처리 — tier 블록의 마지막 일치 라인 바로 뒤에 새 항목 삽입
NEW_LINE="  { id: '${AGENT_ID}', tier: '${AGENT_TIER}', uiGroup: '${AGENT_GROUP}' },"

python3 - "${AGENTS_FILE}" "${AGENT_TIER}" "${NEW_LINE}" <<'PYEOF'
import sys

agents_file = sys.argv[1]
target_tier = sys.argv[2]
new_line    = sys.argv[3]

with open(agents_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# tier가 일치하는 마지막 줄 인덱스 찾기
last_idx = -1
pattern = f"tier: '{target_tier}'"
for i, line in enumerate(lines):
    if pattern in line:
        last_idx = i

if last_idx == -1:
    print(f"ERROR: tier '{target_tier}' 항목을 agents.ts에서 찾을 수 없습니다.", file=sys.stderr)
    sys.exit(1)

lines.insert(last_idx + 1, new_line + '\n')

with open(agents_file, 'w', encoding='utf-8') as f:
    f.writelines(lines)
PYEOF

echo -e "${GREEN}✅ lib/agents.ts 업데이트 완료${RESET}"
echo ""

# ── 수동 작업 안내 ────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}── 남은 수동 작업 ──────────────────────────────────────${RESET}"
echo ""
echo -e "${YELLOW}[ ] lib/constants.ts${RESET}  → AUTHOR_META에 추가:"
echo "    '${AGENT_ID}': {"
echo "      name: '${AGENT_NAME}', label: '${AGENT_NAME}', emoji: '${AGENT_EMOJI}', isAgent: true,"
echo "      color: 'bg-gray-50 text-gray-700 border-gray-200',"
echo "      accent: 'border-gray-400', bg: 'from-gray-50',"
echo "      description: '역할 설명',"
echo "    },"
echo ""
echo -e "${YELLOW}[ ] app/api/posts/[id]/ask-agent/route.ts${RESET} → AGENT_PERSONAS에 페르소나 프롬프트 추가"
echo ""
echo -e "${YELLOW}[ ] app/components/AskAgentButton.tsx${RESET} → AGENT_GROUPS의 '${AGENT_GROUP}' 배열에 '${AGENT_ID}' 추가"
echo ""
echo -e "${YELLOW}[ ] ~/.jarvis/config/board-personas.json${RESET} → 페르소나 항목 추가"
echo "    (comment_delay_seconds, route_keywords, team 필드 포함)"
echo ""
echo -e "${BOLD}${CYAN}──────────────────────────────────────────────────────${RESET}"
