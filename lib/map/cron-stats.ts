/**
 * 크론 통계 SSoT.
 *
 * 이전에는 briefing/route.ts 의 `getCronStats24h` 와 chat/route.ts 의
 * `cronStats24h` 가 독립적으로 구현되어 있어서 같은 팀에 대해 서로 다른
 * 숫자를 반환했다 (예: trend-lead briefing failed=8, chat LLM "실패 0건").
 * 이 차이는 CEO 가 같은 방의 두 뷰(팝업·채팅)에서 모순된 정보를 보게
 * 만드는 신뢰성 버그였다. 이 모듈 하나를 두 route 가 공유하면 재발 불가.
 *
 * 규칙:
 *   - keyword 매칭: 소문자 substring. ENTITIES.keywords/TEAM_REGISTRY 와 동일.
 *   - 시간 창: 24h (wall clock). KST 로그와 비교할 때 시간대 오프셋을
 *     명시적으로 더해서 string 비교가 안전하게 되도록 한다.
 *   - 상태 분류 우선순위: SUCCESS|DONE → success, FAILED|ERROR|CRITICAL → failed,
 *     SKIPPED → skipped.
 */

export interface CronStats24h {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  rate: number;
}

/**
 * cron.log raw 문자열을 받아 팀 키워드에 해당하는 최근 24h 실행 통계를 계산.
 * @param cronLogRaw cron.log 파일 전체 텍스트 (readFileSync 결과)
 * @param keywords   팀 엔티티에서 관리하는 태스크 식별 키워드 리스트
 */
export function computeCronStats24h(cronLogRaw: string, keywords: string[]): CronStats24h {
  if (!cronLogRaw || keywords.length === 0) {
    return { total: 0, success: 0, failed: 0, skipped: 0, rate: 0 };
  }
  // cron.log 에서 최근 3000줄만 스캔해서 성능 보호
  const lines = cronLogRaw.split('\n').filter(Boolean).slice(-3000);

  // 24h 컷오프를 KST 벽시계 기준으로 잡는다.
  // cron.log 라인의 타임스탬프는 "YYYY-MM-DD HH:mm:ss" (KST) 이므로
  // 같은 포맷의 문자열을 만들어 단순 사전식 비교로 시간 비교한다.
  const KST_OFFSET = 9 * 3600_000;
  const cutoff = new Date(Date.now() - 24 * 3600_000 + KST_OFFSET)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const line of lines) {
    const m = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[([^\]]+)\]/);
    if (!m) continue;
    const [, ts, task] = m;
    if (ts < cutoff) continue;
    if (/^task_\d+_/.test(task)) continue;
    const lower = task.toLowerCase();
    if (!keywords.some(kw => lower.includes(kw))) continue;
    if (/\bSUCCESS\b|\bDONE\b/.test(line)) success++;
    else if (/FAILED|ERROR|CRITICAL/.test(line)) failed++;
    else if (/\bSKIPPED\b/.test(line)) skipped++;
  }

  const total = success + failed;
  return {
    total,
    success,
    failed,
    skipped,
    rate: total > 0 ? Math.round((success / total) * 100) : 0,
  };
}
