export type WorkState = 'running' | 'reported' | 'scheduled' | 'waiting' | 'blocked' | 'completed' | 'unknown' | 'decision';
export interface CompanyTask {
  id: string; title: string; kind: 'automation' | 'development' | 'work' | 'overview' | 'codex'; ownerId: string;
  state: WorkState; summary: string; next: string; source: string;
  observedAt: string | null; eventAt: string | null; evidence: string;
  execution?: { threadId: string; turnId: string; status: string; activity: string; lastEventAt: string; terminal: boolean; reportText: string; reportEventId: string | null; events: { id: string; at: string; label: string; status: string; failed: boolean; recoveryEventId?: string }[] };
  automationEnabled?: boolean; archived?: boolean; parentId?: string; href?: string; priority: number; issue?: string; result?: string;
}
export interface CompanyIssue {
  id: string; taskId: string; title: string; ownerId: string; state: 'open' | 'recovered' | 'grouped';
  triage?: {category:'current'|'history'|'check'; reason:string; next:string}; impact: string; next: string; eventAt?: string | null; recoveryEventAt?: string | null; firstSeenAt: string; lastSeenAt: string; recoveredAt: string | null;
}
export interface CompanyReport {
  id: string; taskId: string; ownerId: string; title: string; summary: string;
  eventAt: string | null; receivedAt: string; state: WorkState;
  receipt: 'received'; review: 'not_reviewed' | 'reviewed';
  context?: { result?: string; next: string; evidence: string; issue: string | null; body: string; executionStatus: string | null; eventIds: string[]; events?: { id: string; at: string; label: string; status: string; failed: boolean; recoveryEventId?: string }[] };
  assessment?: CompanyReview;
}
export interface CompanySnapshot {
  tasks: CompanyTask[]; issues: CompanyIssue[]; reports: CompanyReport[];
  coverage: { source: string; status: 'connected' | 'partial' | 'unavailable'; detail: string }[];
  reviewQueue?: { budgetWait?: boolean; sourceReady?: number; linked?: number; stale?: number; budget?: {used:number;actual?:number;reserved?:number;remaining?:number;limit:number;nextAt:string|null}; oldestAt?: string|null; processedLastHour?: number; throttledLastHour?: number; lastRun?: {at:string;outcome:string;durationMs:number;totalTokens:number|null;limitKind?:string|null}|null; nextAt: string | null; queued: number; reviewing: number; limited: boolean };
  receiptAvailable: boolean;
}
export const STATE_LABEL: Record<WorkState, string> = {
  running: '실행 확인', reported: '진행 보고', scheduled: '예약 대기', waiting: '대기',
  blocked: '문제 확인 필요', completed: '완료 기록', unknown: '현재 미확인', decision: '사장 결정 대기',
};

export interface CompanyReview {
  reportId: string; status: 'queued' | 'reviewing' | 'reviewed' | 'failed' | 'stale' | 'source_ready' | 'linked';
  method?: 'source_selection'|'codex_audit'; auditBatch?: string; linkedReportId?: string; routingVersion?: number; policyVersion?: number; reviewedAt: string | null; model: string; summary: string; problems: string[];
  nextActions: string[]; ownerDecision: string; evidenceIds: string[];
  limitations: string[]; error?: string;
}
