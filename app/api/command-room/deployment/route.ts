import {NextResponse,type NextRequest} from 'next/server';
import {getRequestAuth} from '@/lib/guest-guard';
import {readDeploymentEvidence} from '@/lib/company/deployment-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
/** Read-only release identity. Only the host deploy verifier can write receipts. */
export async function GET(req:NextRequest){if(!getRequestAuth(req).isOwner)return NextResponse.json({error:'소유자 로그인 필요'},{status:401});const {release,manifestHash}=readDeploymentEvidence();return NextResponse.json({release,manifestHash},{headers:{'Cache-Control':'private, no-store'}});}
