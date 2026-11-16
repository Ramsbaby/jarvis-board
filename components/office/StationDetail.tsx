import { BookOpen, Radio } from 'lucide-react';
import type { Station } from '@/lib/command-room/types';
const FRESHNESS = { fresh: '관측 유효', stale: '오래된 관측', missing: '원본 없음', error: '조회 실패' };
const ICONS = { work: '✦', qa: '◇', codex: '⌘', secretary: '☀', openclaw: '⌘' };
function time(value: string | null) { return value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미확인'; }
export default function StationDetail({ station }: { station: Station }) {
  return <aside className="hq-detail" aria-label="선택한 데스크의 미션">
    <div className="hq-detail-top"><span className="hq-eyebrow">선택한 데스크</span><span className={`hq-status ${station.status}`}>{station.statusLabel}</span></div>
    <div className="hq-detail-title"><span className="hq-station-icon">{ICONS[station.id]}</span><h2>{station.title}</h2></div>
    <div className="hq-now"><span className="hq-eyebrow">지금</span><p className="hq-clamp" title={station.current}>{station.current}</p></div>
    <div className="hq-next"><span className="hq-eyebrow">다음 · {station.nextOwner}</span><p className="hq-clamp" title={station.nextAction}>{station.nextAction}</p></div>
    <div className="hq-reason"><span className="hq-eyebrow">{station.status === 'attention' || (station.status === 'waiting' && station.id !== 'work' && !station.reason.includes('최근 작업 보고')) ? '대기 이유' : '상태 근거'}</span><p className="hq-clamp" title={station.reason}>{station.reason}</p></div>
    <div className="hq-observed"><Radio size={12} /><span>관측 {time(station.observedAt)}</span></div>
    <details className="hq-evidence"><summary><BookOpen size={14} /> 전체 내용과 근거 <span>{station.evidence.length}</span></summary>
      <div className="hq-full-report"><p>{station.subtitle}</p><strong>목표</strong><p>{station.objective}</p><strong>지금</strong><p>{station.current}</p><strong>다음 · {station.nextOwner}</strong><p>{station.nextAction}</p><strong>상태 근거</strong><p>{station.reason}</p></div>
      {station.facts.length > 0 && <dl className="hq-facts">{station.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
      <div className="hq-sources">{station.sources.map(source => <div key={source.id}><span className={`hq-source-dot ${source.freshness}`} /><div><strong>{source.label}</strong><p>{FRESHNESS[source.freshness]} · {time(source.observedAt)}</p><small>{source.detail}</small></div></div>)}</div>
      <ul>{station.evidence.map((item, i) => <li key={i}><strong>{item.label}</strong><p>{item.detail}</p><small>{time(item.at)}</small></li>)}</ul>
    </details>
  </aside>;
}
