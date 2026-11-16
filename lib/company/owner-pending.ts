import { createHash } from 'node:crypto';
import { safeText } from '../command-room/derive';
import type { CompanyTask } from './types';

// 당직 지시함의 `- [!]` 줄 = 주인님 답을 기다리는 항목. 선별 기준의 원본은
// ~/.openclaw/workspace/scripts/owner-pending.sh 이며 여기서는 읽기만 한다(같은 정규식 유지).
const OWNER_QA = /폰에서[^.。\n]{0,20}(확인|이상\s?없|해\s?보)|주인님[^.。\n]{0,15}(플레이(?!\s?(스토어|콘솔))|두\s?판|실기)|실기[^.。\n]{0,10}주인님/;
const OWNER_ONLY = /결제|카드|승인|인증|프로덕션|송출/;
const clean = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '').trim();

export interface OwnerPending { id: string; title: string; detail: string; advice: string | null }

export function parseOwnerPending(text: string): OwnerPending[] {
  const items: OwnerPending[] = [];
  for (const line of text.split('\n')) {
    const m = /^\s*- \[!\]\s*(.+)$/.exec(line);
    if (!m) continue;
    const raw = m[1];
    // 게임 실기 확인처럼 자비스 몫인 항목은 주인님 결정으로 올리지 않는다.
    if (OWNER_QA.test(raw) && !OWNER_ONLY.test(raw)) continue;
    const bold = /\*\*(.+?)\*\*/.exec(raw);
    const title = clean(bold ? bold[1] : raw).replace(/[:：]\s*$/, '').slice(0, 80);
    const adviceMatch = /권고\s*[:：]\s*((?:[^.。\n]|\.(?=\S)){2,})/.exec(raw);
    const advice = adviceMatch ? clean(adviceMatch[1]).slice(0, 160) : null;
    const after = bold ? raw.slice(raw.indexOf(bold[0]) + bold[0].length) : raw;
    const detail = clean(after.split(/\*{0,2}권고\s*[:：]/)[0]).replace(/^[:：\s]+/, '');
    items.push({ id: createHash('sha1').update(title).digest('hex').slice(0, 12), title, detail, advice });
  }
  return items;
}

export function ownerPendingTasks(text: string, observedAt: string): CompanyTask[] {
  return parseOwnerPending(text).map(p => ({
    id: `owner-pending:${p.id}`, title: safeText(p.title, '결정 요청', 80), kind: 'work', ownerId: 'secretary', state: 'decision',
    summary: safeText(p.detail, '요청 배경 기록 없음', 260),
    next: p.advice ? `자비스 권고: ${safeText(p.advice, '', 160)} · 자비스에게 예/아니오로 답하시면 기록합니다.` : '권고가 기록되지 않았습니다. 자비스에게 배경과 권고를 먼저 물어보세요.',
    source: '당직 지시함(주인님 답 대기 표시)', observedAt, eventAt: null,
    evidence: '지시함에 답 대기로 표시된 원문입니다. 화면에서 바로 승인되지는 않으며, 답은 자비스가 지시함에 기록합니다.',
    priority: 3,
  }));
}
