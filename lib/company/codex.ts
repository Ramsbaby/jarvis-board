import Database from 'better-sqlite3';
import { join } from 'node:path';
import { safeText } from '../command-room/derive';
import type { CompanySnapshot, CompanyTask } from './types';

// Internal storage adapter: explicit schema checks, read-only transactions, no resume/start calls.
// Never export reasoning, user prompts, tool arguments, command text or tool output.
// Exact command equality is used only in memory to link a failed execution to a later successful retry.
export function readCodex(directory: string, now = Date.now()): { tasks: CompanyTask[]; coverage: CompanySnapshot['coverage'][number] } {
  let index: Database.Database | undefined, history: Database.Database | undefined;
  try {
    index = new Database(join(directory, 'state_5.sqlite'), { readonly: true, fileMustExist: true });
    history = new Database(join(directory, 'thread_history_1.sqlite'), { readonly: true, fileMustExist: true });
    index.pragma('busy_timeout = 1500'); history.pragma('busy_timeout = 1500');
    const columns = new Set((index.prepare('PRAGMA table_info(threads)').all() as {name:string}[]).map(c=>c.name));
    const metadata = ['agent_nickname','agent_role'].filter(c=>columns.has(c));
    const threads = index.prepare(`SELECT id,name,title,source${metadata.map(c=>','+c).join('')} FROM threads WHERE archived=0 ORDER BY updated_at DESC LIMIT 101`).all() as { agent_nickname?:string; agent_role?:string; id: string; name: string | null; title: string; source: string }[];
    const tasks: CompanyTask[] = []; let missing = 0;
    history.transaction(() => {
      for (const thread of threads.slice(0, 100)) {
        const turns = history!.prepare('SELECT turn_id,status,started_at,completed_at FROM thread_turns WHERE thread_id=? ORDER BY rollout_ordinal DESC LIMIT 3').all(thread.id) as { turn_id: string; status: string; started_at: number; completed_at: number | null }[];
        if (!turns.length) { missing++; continue; }
        for (const turn of turns) {
          const rows = history!.prepare("SELECT item_id,item_type,created_at_ms,item_json FROM thread_items WHERE thread_id=? AND turn_id=? AND item_type IN ('agentMessage','commandExecution','fileChange','mcpToolCall','dynamicToolCall','webSearch') ORDER BY rollout_ordinal DESC LIMIT 40").all(thread.id, turn.turn_id) as { item_id: string; item_type: string; created_at_ms: number; item_json: string }[];
          const events = rows.map(row => {
            const item = JSON.parse(row.item_json);
            const label: Record<string, string> = { agentMessage: item.phase === 'final_answer' ? '결과 보고' : '진행 보고', commandExecution: '명령 실행', fileChange: '파일 수정', mcpToolCall: '연결 도구 사용', dynamicToolCall: '연결 도구 사용', webSearch: '웹 조사' };
            return { id: row.item_id, at: new Date(row.created_at_ms).toISOString(), label: label[row.item_type], status: String(item.status ?? 'recorded'), failed: item.exitCode != null && item.exitCode !== 0 || item.success === false || item.status === 'failed', text: row.item_type === 'agentMessage' ? safeText(item.text, '', 5000) : '', final: item.phase === 'final_answer' };
          });
          const visibleEvents = events.slice(0,12).map(({text,final,...e})=>e);
          for(const event of visibleEvents.filter(e=>e.failed)) {
            const failedRow=rows.find(r=>r.item_id===event.id);if(failedRow?.item_type!=='commandExecution')continue;
            const failedCommand=JSON.parse(failedRow.item_json).command;
            if(typeof failedCommand!=='string'||!failedCommand)continue;
            const success=visibleEvents.find(e=>!e.failed&&Date.parse(e.at)>Date.parse(event.at)&&rows.some(r=>{if(r.item_id!==e.id||r.item_type!=='commandExecution')return false;const i=JSON.parse(r.item_json);return i.exitCode===0&&i.status==='completed'&&i.command===failedCommand;}));
            if(success)Object.assign(event,{recoveryEventId:success.id});
          }
          const report = events.find(e => e.final) ?? events.find(e => e.text);
          const latestAt = Math.max(turn.started_at * 1000, ...rows.map(r => r.created_at_ms));
          const fresh = now >= latestAt && now - latestAt < 120_000;
          const ended = turn.status === 'completed';
          const failed = turn.status === 'failed' || turn.status === 'interrupted';
          const active = turn.status === 'inProgress';
          const state = failed ? 'blocked' : ended ? 'waiting' : active && fresh ? 'reported' : 'unknown';
          const ownerId = /QA|고스톱|검증/.test(thread.name || thread.title) ? 'qa' : 'work';
          const title = safeText(thread.name?.trim() || thread.title?.trim() || [thread.agent_nickname,thread.agent_role].filter(Boolean).join(' · '), `이름 미등록 대화 · ${thread.id.slice(0,8)}`, 100);
          tasks.push({ id: `codex:${thread.id}:${turn.turn_id}`, title, kind: 'codex', ownerId, state,
            summary: safeText(report?.text, active ? 'Codex 실행 이벤트 관측 · 결과 보고 대기' : '회차 상태 기록 · 최종 보고 없음', 700),
            next: failed ? '중단·실패 원인과 재개 조건 검토' : ended ? '이번 결과 보고의 미완료·다음 조치 검토' : fresh ? '실제 실행 항목과 후속 보고 확인' : '오래된 진행 상태 재확인',
            source: 'Codex 로컬 실행 원장', observedAt: new Date(now).toISOString(), eventAt: new Date((turn.completed_at || turn.started_at) * 1000).toISOString(),
            evidence: `${turn.status} 회차 · 최근 ${events.length}개 실행 항목 확인. 회차 종료는 전체 업무 완료가 아닙니다.${active ? ' 최근 이벤트는 프로세스 생존 확인과 구분합니다.' : ''}`,
            priority: active && fresh ? 110 : failed ? 95 : 40,
            ...(failed ? { issue: turn.status === 'interrupted' ? 'Codex 회차 중단 · 재개 확인 필요' : 'Codex 회차 실패 · 원인 검토 필요' } : {}),
            execution: { threadId: thread.id, turnId: turn.turn_id, status: turn.status, activity: events[0]?.label ?? '실행 기록 확인', lastEventAt: new Date(latestAt).toISOString(), events: visibleEvents, reportText: report?.text ?? '', reportEventId: report?.id ?? null, terminal: ended || failed },
          });
        }
      }
    })();
    return { tasks, coverage: { source: 'Codex 실제 업무·실행 이력', status: missing || threads.length > 100 ? 'partial' : 'connected', detail: `이 Mac의 비보관 대화 ${Math.min(threads.length, 100)}개 중 회차 ${tasks.length}개 연결 · 대화별 최근 3회·회차별 최근 40항목 · ${missing}개 대화 이력 없음 · 다른 기기·보관 대화 제외` } };
  } catch { return { tasks: [], coverage: { source: 'Codex 실제 업무·실행 이력', status: 'unavailable', detail: '로컬 실행 원장 조회 또는 스키마 확인 실패 · 이전 기록 보존' } }; }
  finally { index?.close(); history?.close(); }
}
