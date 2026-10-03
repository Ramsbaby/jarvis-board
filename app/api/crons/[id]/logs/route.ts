export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { LOGS_DIR, CRON_LOG, RESULTS_DIR } from '@/lib/jarvis-paths';
import { getRequestAuth } from '@/lib/guest-guard';
import { findAutomation, listAutomationRuns, toKstString } from '@/lib/openclaw-automations';

/**
 * GET /api/crons/[id]/logs?lines=100&source=all
 *
 * source: "task" (태스크 전용 로그), "cron" (cron.log grep), "result" (최근 결과), "all" (전부)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 실행 요약·로그에는 개인 일정 등 민감 내용이 섞일 수 있다 — 오너 전용
  const { isOwner } = getRequestAuth(req);
  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: cronId } = await params;
  const url = new URL(req.url);
  const lines = Math.min(Number(url.searchParams.get('lines') || '100'), 500);
  const source = url.searchParams.get('source') || 'all';

  const sections: Array<{ title: string; content: string; path?: string }> = [];

  // 0. OpenClaw 자동화 (2026-09-12 이관 후 정본) — 실행 이력을 돌려준다
  const job = await findAutomation(cronId);
  if (job) {
    const runs = await listAutomationRuns(job.id, Math.min(Math.max(Math.round(lines / 8), 5), 30));
    if (runs === null) {
      sections.push({ title: '실행 이력', content: 'OpenClaw 실행 이력을 읽지 못했습니다.' });
    } else if (runs.length === 0) {
      sections.push({ title: '실행 이력', content: '아직 실행 기록이 없습니다.' });
    } else {
      const body = runs.map(r => {
        const at = toKstString(r.runAtMs ?? r.ts);
        const dur = typeof r.durationMs === 'number' ? ` · ${Math.round(r.durationMs / 1000)}s` : '';
        const text = (r.error || r.summary || '').replace(/\s+/g, ' ').slice(0, 400);
        return `[${at}] ${r.status ?? '?'}${dur}${text ? `\n  ${text}` : ''}`;
      }).join('\n');
      sections.push({ title: `실행 이력 (OpenClaw · 최근 ${runs.length}건)`, content: body });
    }
    return NextResponse.json({ cronId, jobId: job.id, source: 'openclaw-automations', sections });
  }

  // 아래는 이관 전 옛 크론(~/.jarvis/logs·cron.log)용 폴백 — 읽기 전용

  // 1. 태스크 전용 로그 파일
  if (source === 'all' || source === 'task') {
    const taskLog = join(LOGS_DIR, `${cronId}.log`);
    if (existsSync(taskLog)) {
      const content = tailFile(taskLog, lines);
      sections.push({ title: '태스크 로그', content, path: taskLog });
    }

    // Claude stderr 로그
    const stderrLog = join(LOGS_DIR, `claude-stderr-${cronId}.log`);
    if (existsSync(stderrLog)) {
      const content = tailFile(stderrLog, Math.min(lines, 50));
      sections.push({ title: 'Claude stderr', content, path: stderrLog });
    }
  }

  // 2. cron.log에서 해당 크론 grep
  if (source === 'all' || source === 'cron') {
    if (existsSync(CRON_LOG)) {
      const full = readFileSync(CRON_LOG, 'utf-8');
      const matched = full
        .split('\n')
        .filter((l) => l.includes(cronId))
        .slice(-lines);
      if (matched.length > 0) {
        sections.push({ title: 'cron.log (grep)', content: matched.join('\n'), path: CRON_LOG });
      }
    }
  }

  // 3. 최근 결과 파일
  if (source === 'all' || source === 'result') {
    const resultDir = join(RESULTS_DIR, cronId);
    if (existsSync(resultDir)) {
      try {
        const files = readdirSync(resultDir)
          .filter((f) => f.endsWith('.md') || f.endsWith('.json') || f.endsWith('.txt'))
          .map((f) => ({ name: f, mtime: statSync(join(resultDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 3);

        for (const f of files) {
          const content = readFileSync(join(resultDir, f.name), 'utf-8').slice(0, 3000);
          sections.push({ title: `결과: ${f.name}`, content, path: join(resultDir, f.name) });
        }
      } catch { /* 디렉토리 읽기 실패 무시 */ }
    }
  }

  if (sections.length === 0) {
    return NextResponse.json({
      cronId,
      sections: [{ title: '로그 없음', content: `'${cronId}'에 대한 로그 파일을 찾을 수 없습니다.\n탐색 위치: ${LOGS_DIR}/${cronId}.log, ${CRON_LOG}` }],
    });
  }

  return NextResponse.json({ cronId, sections });
}

function tailFile(filePath: string, maxLines: number): string {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    return lines.slice(-maxLines).join('\n');
  } catch {
    return '(파일 읽기 실패)';
  }
}
