import { NextResponse, type NextRequest } from 'next/server';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getRequestAuth } from '@/lib/guest-guard';
import { followUps, updateFollowUp } from '@/lib/company/actions';
const journal=()=>process.env.JARVIS_OFFICE_JOURNAL||join(homedir(),'.openclaw-data/runtime/office/inbox.sqlite');
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:NextRequest){if(!getRequestAuth(request).isOwner)return NextResponse.json({error:'소유자 로그인 필요'},{status:401,headers});return NextResponse.json({items:followUps(journal())},{headers});}
export async function POST(request:NextRequest){
 if(!getRequestAuth(request).isOwner)return NextResponse.json({error:'소유자 로그인 필요'},{status:401,headers});
 let allowed=false;try{const u=new URL(request.headers.get('origin')||'');allowed=['http:','https:'].includes(u.protocol)&&u.host===request.headers.get('host');}catch{}
 if(!allowed)return NextResponse.json({error:'동일 출처 요청 필요'},{status:403,headers});
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.reportId!=='string'||!/^[a-f0-9]{64}$/.test(body.reportId)||!['acknowledge','link','verify'].includes(body.operation)||body.executionTaskId!==undefined&&typeof body.executionTaskId!=='string'||body.verification!==undefined&&typeof body.verification!=='string')return NextResponse.json({error:'입력 확인 필요'},{status:400,headers});
 try{return NextResponse.json({item:updateFollowUp(journal(),body)},{headers});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'저장 실패'},{status:409,headers});}
}
