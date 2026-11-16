/** Only known QA identifier vocabulary; the original title stays in details. */
export function displayTitle(title:string):string {
 if(!/^[a-z0-9-]+-20\d{6}$/.test(title))return title;
 const topics:[RegExp,string][]=[[/avatar-persistence/,'아바타 저장 검사'],[/wallet-settings/,'지갑·설정 검사'],[/wallet/,'지갑 검사'],[/faq-chip/,'도움말 분류 버튼 검사'],[/faq/,'도움말 검사'],[/profile/,'프로필 검사'],[/persistence/,'저장 상태 검사'],[/preflight/,'실행 전 점검']];
 const topic=topics.find(([p])=>p.test(title));if(!topic)return title;
 const scope=title.startsWith('original-')?'원본':title.startsWith('candidate-')?'후보':'QA';
 const revision=title.match(/-(v\d+)-/)?.[1];return `${scope} · ${topic[1]}${revision?` (${revision})`:''}`;
}

/** Present evidence as readable prose; keep original identifiers in source details. */
export function readableText(value:string):string {
 return value.replace(/\bMeetingDesk\b/g,'면담창').replace(/\bOrderDesk\b/g,'업무 지시창').replace(/\btextarea\b/g,'입력창').replace(/해당 업무의 parent로 이어집니다/g,'보고받은 업무에 연결됩니다').replace(/\bparent\b/g,'이전 업무 연결').replace(/\borderId\b/g,'업무 번호').replace(/\brequestId\b/g,'접수 번호').replace(/\btests 실패/g,'자동 테스트 실패').replace(/\banalysis 실패/g,'정적 분석 실패').replace(/\bbuild 실패/g,'빌드 실패').replace(/<heartbeat\b[^>]*>[\s\S]*?<\/heartbeat>/gi,xml=>xml.match(/<message\b[^>]*>([\s\S]*?)<\/message>/i)?.[1]||'내부 점검 기록').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*#`]/g,'').replace(/^원본 보고 기준:\s*/,'').replace(/^주인님[,，]?\s*/,'').replace(/\s+/g,' ').trim();
}
export function workTitle(title:string,summary:string):string {
 const clean=displayTitle(title);
 if(/[가-힣]/.test(clean))return clean;
 const context=readableText(summary);
 if(!context)return '업무 내용 확인 필요';
 return context.length>64?context.slice(0,64)+'…':context;
}

/** A short owner-facing lead; the complete evidence remains in disclosure. */
export function reportSummary(value:string):string {const first=value.split(/\n|(?<=[.!?。])\s/)[0];const text=readableText(first);return text.length>140?text.slice(0,140)+'…':text;}
