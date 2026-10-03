export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/guest-guard';
import { findAutomation } from '@/lib/openclaw-automations';

/**
 * PATCH /api/crons/[id] — 은퇴.
 *
 * 예전에는 ~/.jarvis/config/effective-tasks.json 을 직접 고쳐 썼다. 2026-09-12 이관 이후
 * 그 파일을 읽는 스케줄러가 없으므로 고쳐도 아무 일도 일어나지 않는다(오히려 오해만 남는다).
 * 켜기/끄기는 OpenClaw 에서 한다: `openclaw cron enable|disable <job id>`.
 */
export async function PATCH(req: NextRequest) {
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) {
    return NextResponse.json({ error: '크론 설정 변경은 오너 인증이 필요합니다.' }, { status: 403 });
  }
  return NextResponse.json(
    {
      success: false,
      error: '보드에서의 크론 설정 변경은 종료됐습니다. 자동화 켜기/끄기는 OpenClaw에서 합니다 (openclaw cron enable|disable).',
    },
    { status: 410 },
  );
}

/**
 * GET /api/crons/[id] — 단일 자동화 정보 (OpenClaw automations, id 는 job 이름 또는 job id)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: cronId } = await params;
  const job = await findAutomation(cronId);
  if (!job) {
    return NextResponse.json({ error: `자동화 '${cronId}'를 찾을 수 없습니다.` }, { status: 404 });
  }
  return NextResponse.json({
    task: {
      id: job.name,
      jobId: job.id,
      name: job.displayName || job.name,
      description: job.description || '',
      enabled: job.enabled,
      schedule: job.schedule,
      payloadKind: job.payload?.kind,
      state: job.state ?? null,
    },
  });
}
