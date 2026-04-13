export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { exec } from 'child_process';
import { homedir } from 'os';
import path from 'path';

const HOME = homedir();
const TASKS_FILE = path.join(HOME, '.jarvis', 'config', 'tasks.json');

interface TaskDef {
  id: string;
  script?: string;
  prompt?: string;
  enabled?: boolean;
}

// Rate limit: 1 retry per task per 30 seconds
const lastRetry = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const { cronId } = (await req.json()) as { cronId?: string };
    if (!cronId) {
      return NextResponse.json({ success: false, message: '크론 ID가 필요합니다.' }, { status: 400 });
    }

    // Rate limit check
    const now = Date.now();
    const last = lastRetry.get(cronId) ?? 0;
    if (now - last < 30_000) {
      const wait = Math.ceil((30_000 - (now - last)) / 1000);
      return NextResponse.json({ success: false, message: `${wait}초 후 재시도 가능합니다.` }, { status: 429 });
    }

    // Find task definition
    let tasks: TaskDef[] = [];
    try {
      const raw = readFileSync(TASKS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      tasks = Array.isArray(parsed) ? parsed : parsed.tasks ?? [];
    } catch {
      return NextResponse.json({ success: false, message: 'tasks.json을 읽을 수 없습니다.' }, { status: 500 });
    }

    const task = tasks.find(t => t.id === cronId);
    if (!task) {
      return NextResponse.json({ success: false, message: `태스크 "${cronId}"를 찾을 수 없습니다.` }, { status: 404 });
    }

    if (!task.script) {
      return NextResponse.json({
        success: false,
        message: task.prompt
          ? 'LLM 프롬프트 태스크는 자동 재실행이 불가합니다. ask-claude.sh를 통해 수동 실행하세요.'
          : '실행 가능한 스크립트가 없습니다.',
      }, { status: 400 });
    }

    lastRetry.set(cronId, now);

    // Execute script with timeout
    const scriptPath = task.script.startsWith('/') ? task.script : path.join(HOME, '.jarvis', task.script);

    const result = await new Promise<{ success: boolean; message: string }>((resolve) => {
      exec(`bash "${scriptPath}"`, { timeout: 30_000, env: { ...process.env, HOME } }, (err, stdout, stderr) => {
        if (err) {
          const msg = stderr?.slice(-200) || err.message;
          resolve({ success: false, message: `실패: ${msg.slice(0, 150)}` });
        } else {
          const msg = stdout?.slice(-200) || '완료';
          resolve({ success: true, message: `성공: ${msg.slice(0, 150)}` });
        }
      });
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ success: false, message: `서버 오류: ${String(e)}` }, { status: 500 });
  }
}
