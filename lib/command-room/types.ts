export type Freshness = 'fresh' | 'stale' | 'missing' | 'error';
export type StationId = 'qa' | 'codex' | 'secretary' | 'openclaw' | 'work';
export interface SourceObservation {
  id: string;
  label: string;
  freshness: Freshness;
  observedAt: string | null;
  detail: string;
}
export interface EvidenceItem { label: string; detail: string; at: string | null }
export interface Station {
  id: StationId;
  title: string;
  subtitle: string;
  status: 'running' | 'waiting' | 'attention' | 'unknown' | 'scheduled';
  statusLabel: string;
  objective: string;
  current: string;
  reason: string;
  nextOwner: string;
  nextAction: string;
  observedAt: string | null;
  sources: SourceObservation[];
  evidence: EvidenceItem[];
  facts: { label: string; value: string }[];
}
export interface CommandRoomSnapshot {
  generatedAt: string;
  stations: Station[];
  company?: import('../company/types').CompanySnapshot;
  employees?: import('./employees').OfficeEmployee[];
}
export type JsonRecord = Record<string, unknown>;
export interface InputSource { value: JsonRecord | null; source: SourceObservation }
export interface ProcessObservation { live: boolean; identityMatched: boolean }
