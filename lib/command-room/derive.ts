import type { InputSource, JsonRecord, ProcessObservation, Station, SourceObservation } from './types';

export function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}
export function entries(value: unknown): [string, JsonRecord][] {
  return Object.entries(record(value)).slice(-80).map(([id, v]) => [id, record(v)]);
}
export function epoch(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}
// No prompts, arbitrary exception text, paths, or source blobs pass through the DTO.
export function safeText(value: unknown, fallback = '기록 없음', limit = 180): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.replace(/(?:https?:\/\/|(?:\/[\w.~@-]+){2,})[^\s,;"']*/g, '[비공개 참조]')
    .replace(/(?:token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '[비공개]').slice(0, limit);
}
function base(id: Station['id'], title: string, subtitle: string, objective: string, sources: SourceObservation[]): Station {
  return { id, title, subtitle, objective, status: 'unknown', statusLabel: '확인 필요',
    current: '확인된 실행 정보 없음', reason: '소스가 아직 확인되지 않았습니다.', nextOwner: 'JARVIS',
    nextAction: '원본 상태를 확인합니다.', observedAt: sources[0]?.observedAt ?? null, sources, evidence: [], facts: [] };
}
export function deriveQa(stateInput: InputSource, checkpoint: InputSource, policyInput: InputSource,
  processes: Record<string, ProcessObservation>, now: number): Station {
  const station = base('qa', '고스톱 QA 연구실', '검증 · 수정 · 판정', '원본 451개 범위를 유지하며 후보 수정과 실제 기기 증거를 구분합니다.',
    [stateInput.source, checkpoint.source, policyInput.source]);
  if (!stateInput.value) { station.reason = 'QA 상태를 읽지 못했습니다. 실행 여부와 진척을 추정하지 않습니다.'; return station; }
  const state = stateInput.value;
  const jobs = entries(state.jobs);
  const liveJobs = jobs.filter(([, j]) => String(j.state).startsWith('running'));
  const failed = jobs.filter(([, j]) => j.state === 'needs_review');
  const work = record(state.model_work);
  const workers = entries(work.workers).filter(([, w]) => w.state === 'active');
  const verified = liveJobs.find(([id]) => processes[id]?.live && processes[id]?.identityMatched);
  const usage = record(state.usage), policy = policyInput.value ?? {};
  const observed = typeof usage.observed_at_epoch === 'number' ? usage.observed_at_epoch : 0;
  const remaining = typeof usage.remaining_percent === 'number' ? usage.remaining_percent : null;
  const freshness = typeof policy.snapshot_max_age_seconds === 'number' ? policy.snapshot_max_age_seconds : 300;
  const quotaFresh = observed > 0 && now >= observed && now - observed <= freshness && typeof usage.resets_at_epoch === 'number' && usage.resets_at_epoch > now;
  const today = new Date((now + 9 * 3600) * 1000).toISOString().slice(0, 10);
  const ledger = record(state.accounting);
  const accountingKnown = ledger.version === 1 && Array.isArray(ledger.entries) && Array.isArray(ledger.reconciliation_required);
  const intervals = accountingKnown ? (ledger.entries as unknown[]).map(record) : [];
  const accountingUnknown = accountingKnown && ((ledger.reconciliation_required as unknown[]).length > 0
    || intervals.some(e => e.category === 'qa_interval_estimate' && (typeof e.percentage_points !== 'number' || !Number.isFinite(e.percentage_points))));
  const qaIntervals = intervals.filter(e => e.category === 'qa_interval_estimate' && typeof e.percentage_points === 'number');
  const daily = accountingKnown ? qaIntervals.filter(e => e.day === today).reduce((sum, e) => sum + Number(e.percentage_points), 0) : null;
  const weekly = accountingKnown ? qaIntervals.filter(e => e.window_reset_anchor_epoch === state.window_reset_anchor_epoch).reduce((sum, e) => sum + Number(e.percentage_points), 0) : null;
  const outside = accountingKnown ? intervals.filter(e => e.category === 'outside_qa_or_unattributed').reduce((sum, e) => sum + (typeof e.percentage_points === 'number' ? e.percentage_points : 0), 0) : null;
  station.observedAt = epoch(observed) ?? stateInput.source.observedAt;
  station.current = '최근 기록에 진행 중인 검사는 없습니다';
  station.status = 'waiting'; station.statusLabel = '다음 작업 대기';
  station.reason = '등록된 진행 작업이 없습니다. 프로젝트 전체가 완료된 것은 아닙니다.';
  station.nextOwner = 'Astra · 설계 / 판정';
  station.nextAction = '신선한 사용량을 확인하고 다음 묶음을 등록합니다.';
  if (workers.length) {
    const role = workers[0][0] === 'implementation' ? 'Sol 구현' : workers[0][0] === 'review' ? 'Astra 판정' : 'Astra 설계';
    station.current = `${role} 단계가 활성으로 보고됨`;
    station.statusLabel = '진행 보고 받음';
    station.reason = '최근 작업 보고이며 현재 실행 여부는 별도로 확인해야 합니다.';
    station.nextAction = '담당자의 작업 완료 보고를 확인한 뒤 이어갑니다.';
  }
  if (liveJobs.length) {
    station.current = verified ? '등록된 검사가 실제로 실행되고 있습니다' : '정산되지 않은 로컬 실행 기록';
    station.status = verified ? 'running' : 'attention';
    station.statusLabel = verified ? '실행 확인됨' : '실행 상태 확인 필요';
    station.reason = verified ? 'PID와 시작 정체성이 현재 프로세스와 일치합니다.' : '현재 PID·시작 정체성을 확인하지 못했습니다. 종료나 재시작을 추정하지 않습니다.';
    station.nextAction = '기존 작업 완료영수증과 정리 증거를 확인합니다.';
  } else if (failed.length) {
    station.status = 'attention'; station.statusLabel = 'Astra 검토 대기';
    station.current = failed[0][0].includes('legal') ? '법적 링크 재현 검사 실패 · 검토 대기' : `검토하지 않은 검사 실패 ${failed.length}건`;
    station.reason = '실패 원인과 후속 작업이 판정되지 않아 새 실행이 차단됩니다.';
    station.nextAction = 'Astra가 원인·변경 가설·승인할 후속 작업을 기록합니다.';
  } else if (state.awaiting_usage) {
    station.statusLabel = '사후 사용량 대기'; station.reason = '완료 후 사용량 관측이 아직 없습니다.';
  } else if (quotaFresh && ((remaining !== null && remaining <= Number(policy.account_reserve_percent ?? 5))
    || (weekly !== null && weekly >= Number(policy.weekly_qa_percentage_points ?? 25))
    || (daily !== null && daily >= Number(policy.daily_qa_percentage_points ?? 3)) || state.stop_day === today)) {
    station.statusLabel = '예산 재개 대기'; station.reason = 'QA 구간 추정 또는 실제 계정 잔여가 운영 한도에 도달했습니다.';
    station.nextAction = '다음 유효 예산과 신선한 관측을 확인합니다.';
  } else if (!quotaFresh) {
    station.statusLabel = workers.length ? '단계 보고 · 사용량 만료' : '사용량 확인 대기';
    station.reason = workers.length ? station.reason + ' 사용량 관측도 만료되었습니다.' : '사용량 관측이 만료되었거나 없습니다. 새 작업 전에 재확인이 필요합니다.';
  }
  if (!liveJobs.length && !failed.length && !state.awaiting_usage && quotaFresh
    && station.statusLabel !== '예산 재개 대기' && (!accountingKnown || accountingUnknown)) {
    station.status = 'attention'; station.statusLabel = accountingKnown ? 'QA 회계 정산 대기' : 'QA 회계 확인 대기';
    station.reason = accountingKnown ? '초기화 경계 등 소비를 확인할 수 없는 구간이 있어 새 QA 작업 전에 정산이 필요합니다.' : 'QA 구간 원장이 없어 QA 소모를 확인할 수 없습니다.';
    station.nextAction = accountingKnown ? '미확인 구간의 원본 증거를 확인하고 정산합니다.' : '감사 가능한 QA 회계 이행을 확인합니다.';
  }
  if (stateInput.source.freshness !== 'fresh' && !verified) {
    station.status = 'unknown'; station.statusLabel = `최근 기록 · ${station.statusLabel}`;
    station.current = `마지막 관측: ${station.current}`;
    station.reason += ' 관측이 오래되어 현재 상태는 다시 확인해야 합니다.';
  }
  if (checkpoint.value?.next_action) station.evidence.push({ label: '체크포인트의 다음 지시', detail: safeText(checkpoint.value.next_action, '', 300), at: checkpoint.source.observedAt });
  station.facts = [
    { label: '검증 범위', value: `${record(policy.scope_guard).total_cases ?? '미확인'}개 · 전수 완료 추정 안 함` },
    { label: '계정 잔여', value: remaining === null ? '미확인' : `${remaining}% · ${quotaFresh ? '관측 유효' : '관측 만료'}` },
    { label: 'QA 구간 추정', value: daily === null ? '미확인' : `오늘 ${daily}%p / 주간 ${weekly ?? '?'}%p${accountingUnknown ? ' · 미정산 구간 있음' : ''}` },
    { label: 'QA 외·미분류 누적', value: outside === null ? '미확인' : `관측 누적 ${outside}%p · 작업별 귀속 불가` },
  ];
  for (const [id, job] of jobs.slice(-5).reverse()) station.evidence.push({ label: safeText(id),
    detail: job.state === 'passed_local' ? `${job.evidence_kind === 'source' ? '소스' : job.evidence_kind === 'native' ? 'native' : '로컬'} 범위 실행 성공 · 원본 전체 통과 아님`
      : job.state === 'needs_review' ? `미판정 실패 · 종료 ${typeof job.exit_code === 'number' ? job.exit_code : '미확인'}` : safeText(job.state), at: epoch(job.ended_at_epoch) });
  for (const [, history] of entries(state.model_work_history).slice(-1)) station.evidence.push({ label: '이전 worker 묶음 종료', detail: '작업 묶음 종료 기록입니다. 프로젝트 완료를 뜻하지 않습니다.', at: epoch(history.ended_at_epoch) });
  return station;
}
export function deriveSecretary(input: InputSource): Station {
  const station = base('secretary', '아침 비서 데스크', '일정 · 메일 · 브리핑', '확인한 원본을 바탕으로 오늘 준비할 일과 확인이 필요한 항목을 정리합니다.', [input.source]);
  if (!input.value) { station.reason = '읽을 수 있는 비서 원본이 없습니다. 일정과 메일이 없다는 뜻은 아닙니다.'; return station; }
  const receipt = record(input.value.secretary_receipt);
  const sources = Array.isArray(input.value.sources) ? input.value.sources.slice(0, 20).map(record) : [];
  const errors = sources.filter(s => s.status !== 'ok').length;
  const partial = input.value.status !== 'ok' || errors > 0;
  station.status = partial ? 'attention' : 'waiting';
  station.statusLabel = partial ? '원본 확인 일부 실패' : '브리핑 원본 확인';
  station.current = `${receipt.run_type === 'scheduled' ? '예약' : receipt.run_type === 'manual' ? '수동' : '유형 미확인'} 브리핑 · ${partial ? '일부 소스 확인 불가' : '소스 확인 기록 있음'}`;
  station.reason = partial ? '메일·일정 등 일부 원본을 읽지 못했습니다. 비어 있는 일정으로 표시하지 않습니다.' : '원본 확인 결과입니다. 전달 성공은 별도 영수증으로만 확인합니다.';
  const authNeeded = input.source.freshness === 'fresh' && (record(receipt.gmail).status === 'authentication_error' || record(receipt.calendar_discovery).status === 'authentication_error');
  station.nextOwner = authNeeded ? '주인님 · 원본 연결 확인' : 'JARVIS · 원본 재확인';
  station.nextAction = authNeeded ? '인증이 만료된 소스의 연결을 확인합니다. 확인되지 않은 일정과 메일은 추정하지 않습니다.' : partial ? '조회 실패의 원인을 확인한 뒤 원본을 다시 읽습니다.' : '다음 예정 회차에서 원본을 다시 확인합니다.';
  if (input.source.freshness !== 'fresh') { station.status = 'unknown'; station.statusLabel = '이전 브리핑 · 재확인 필요'; station.reason += ' 오래된 관측이므로 현재 인증 상태를 단정하지 않습니다.'; }
  station.observedAt = typeof input.value.checked_at === 'string' ? input.value.checked_at : input.source.observedAt;
  station.facts = [{ label: '원본 확인 실패', value: `${errors}개 소스` }, { label: '전달 여부', value: '실제 전달 영수증 별도 확인 필요' }];
  station.evidence = sources.slice(0, 6).map((source, i) => ({ label: `${safeText(source.kind, '원본')} ${i + 1}`, detail: source.status === 'ok' ? '원본 조회 성공 기록' : '원본 조회 실패 · 내용/개수 미확인', at: station.observedAt }));
  return station;
}
export function deriveCodex(input: InputSource): Station {
  const station = base('codex', 'Codex 관제탑', '예약 · 감독 · 재개', '설치된 예약과 실제 실행 증거를 구분해 다음 점검을 놓치지 않습니다.', [input.source]);
  if (!input.value) { station.reason = '예약 설정을 읽지 못했습니다.'; return station; }
  const jobs = Array.isArray(input.value.jobs) ? input.value.jobs.map(record) : [];
  const active = jobs.filter(j => j.status === 'ACTIVE');
  station.status = 'scheduled'; station.statusLabel = `${active.length}개 예약 활성`;
  station.current = '예약 설정 확인 · 실제 실행 중 여부는 미확인';
  station.reason = 'ACTIVE는 예약 설정 상태입니다. worker 생존이나 회차 실행 성공을 뜻하지 않습니다.';
  station.nextOwner = 'Codex · 예약 감독'; station.nextAction = '예약 회차가 도착하면 기존 worker와 예산을 먼저 확인합니다.';
  station.facts = [{ label: '등록된 예약', value: `${jobs.length}개` }, { label: '확인 범위', value: '설정만 확인 · 실행 영수증 별도' }];
  station.evidence = jobs.map(job => ({ label: safeText(job.name), detail: `${job.status === 'ACTIVE' ? '활성' : '비활성/기타'} · ${safeText(job.rrule, '주기 미확인', 120)}`, at: epoch(typeof job.updated_at === 'number' ? job.updated_at / 1000 : null) }));
  return station;
}

export function deriveCurrentWork(input: InputSource, now: number): Station {
  const station = base('work', '현재 작업 스튜디오', '주인님의 요청 · 다음 한 걸음', '현재 맡긴 일의 진행 보고와 다음 행동을 한곳에서 확인합니다.', [input.source]);
  if (!input.value) { station.reason = '등록된 현재 작업 보고를 읽지 못했습니다. 자동으로 진행 중이라 추정하지 않습니다.'; return station; }
  const value = input.value;
  const valid = ['id', 'title', 'objective', 'current', 'nextAction', 'nextOwner', 'observedAt'].every(key => typeof value[key] === 'string' && String(value[key]).trim().length > 0 && String(value[key]).length <= 300);
  if (!valid || !['reported_running', 'waiting', 'completed'].includes(String(value.status))) {
    station.reason = '작업 보고 형식이 유효하지 않습니다.'; station.sources[0] = { ...input.source, freshness: 'error' }; return station;
  }
  const at = Date.parse(String(value.observedAt));
  const recent = Number.isFinite(at) && now * 1000 >= at && now * 1000 - at <= 15 * 60_000;
  station.title = safeText(value.title, '현재 작업 스튜디오', 80);
  station.objective = safeText(value.objective); station.current = safeText(value.current);
  station.nextAction = safeText(value.nextAction); station.nextOwner = safeText(value.nextOwner);
  station.observedAt = Number.isFinite(at) ? new Date(at).toISOString() : null;
  station.status = recent ? 'waiting' : 'unknown';
  station.statusLabel = recent ? value.status === 'reported_running' ? '진행 보고 받음' : '다음 행동 대기' : '진행 확인 필요';
  station.reason = recent ? '최근 작업 보고이며 현재 실행 여부는 별도로 확인해야 합니다.' : '작업 보고가 15분 이상 지났거나 관측 시각이 유효하지 않습니다.';
  if (value.status === 'completed' && Number.isFinite(at) && now * 1000 >= at) {
    const evidence = safeText(value.completionEvidence, '');
    station.status = evidence ? 'waiting' : 'unknown';
    station.statusLabel = evidence ? '최근 작업 완료' : '완료 증거 확인 필요';
    station.reason = evidence ? '이 작업의 완료 보고입니다. 다른 프로젝트의 완료를 뜻하지 않습니다.' : '완료라고 보고했지만 완료 근거가 없습니다.';
    if (evidence) station.evidence.push({ label: '작업 완료 근거', detail: evidence, at: station.observedAt });
  }
  if (!recent) station.sources[0] = { ...input.source, freshness: 'stale' };
  return station;
}
