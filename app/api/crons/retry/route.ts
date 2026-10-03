export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/guest-guard';
import { findAutomation } from '@/lib/openclaw-automations';

/**
 * POST /api/crons/retry — 은퇴 (410 Gone)
 *
 * 예전에는 ~/.jarvis/bin/jarvis-cron.sh <id> 를 보드 프로세스 env 그대로 떼어 실행했다.
 * 2026-09-12 이관 후 스케줄러 정본은 OpenClaw automations 이므로, 옛 러너를 보드에서
 * 띄우면 같은 일을 두 번 하거나 이관 전 설정으로 일을 할 위험이 있다. 실행은 OpenClaw 에서 한다.
 */

interface AltAction {
  label: string;
  command?: string;
  description: string;
}

interface RetryResponse {
  success: boolean;
  message: string;
  alternativeActions?: AltAction[];
}

export async function POST(req: NextRequest) {
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) {
    return NextResponse.json<RetryResponse>(
      { success: false, message: '크론 재실행은 오너 인증이 필요합니다.' },
      { status: 403 },
    );
  }

  let cronId = '';
  try {
    cronId = ((await req.json()) as { cronId?: string }).cronId || '';
  } catch { /* body 없음 — 아래 일반 안내로 */ }

  const job = cronId ? await findAutomation(cronId) : null;
  return NextResponse.json<RetryResponse>(
    {
      success: false,
      message: '보드에서의 크론 재실행은 종료됐습니다. 자동화는 OpenClaw가 실행합니다.',
      alternativeActions: job
        ? [{
            label: 'OpenClaw에서 지금 실행',
            command: `openclaw cron run ${job.id}`,
            description: `'${job.name}' 자동화를 한 번 즉시 실행합니다 (터미널).`,
          }]
        : [{ label: '자동화 목록 보기', command: 'openclaw cron list --all', description: 'OpenClaw 에 등록된 자동화를 확인합니다.' }],
    },
    { status: 410 },
  );
}
