export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { getDb } from '@/lib/db';

// 팀별 시스템 프롬프트
const TEAM_PROMPTS: Record<string, string> = {
  ceo: '나는 Jarvis Company의 CEO(이정우)입니다. 전체 시스템 운영 현황을 파악하고 전략적 의사결정을 내립니다. 질문에 대표로서 답변합니다.',
  'infra-lead': '나는 인프라팀장 박태성입니다. 서버, 디스크, 크론, Discord 봇 상태를 관리합니다. 시스템 상태에 대해 쉽게 설명합니다.',
  'trend-lead': '나는 정보팀장 강나연입니다. 뉴스, 시장 트렌드, 기술 동향을 분석합니다. 시장 상황을 쉽게 설명합니다.',
  'record-lead': '나는 기록팀장 한소희입니다. 일일 대화 기록, RAG 인덱싱, 데이터 아카이빙을 담당합니다.',
  'career-lead': '나는 커리어팀장 김서연입니다. 채용 시장 분석, 이력서, 면접 준비를 지원합니다.',
  'brand-lead': '나는 브랜드팀장 정하은입니다. 오픈소스 전략, 기술 블로그, GitHub 성장을 관리합니다.',
  'audit-lead': '나는 감사팀장 류태환입니다. 크론 실패 추적, E2E 테스트, 시스템 품질을 감시합니다.',
  'academy-lead': '나는 학습팀장 신유진입니다. 학습 계획, 스터디 큐레이션을 관리합니다.',
  'cron-engine': '나는 크론 엔진 관리자입니다. 자동화 태스크 스케줄링과 실행 상태를 관리합니다.',
  'discord-bot': '나는 Discord 봇 관리자입니다. 봇 프로세스 상태와 채팅 시스템을 관리합니다.',
  'disk-storage': '나는 디스크 스토리지 관리자입니다. 로컬 스토리지 사용량과 정리 상태를 관리합니다.',
};

export async function POST(req: NextRequest) {
  try {
    const { teamId, message } = await req.json();

    if (!teamId || !message) {
      return NextResponse.json({ error: 'teamId와 message는 필수입니다.' }, { status: 400 });
    }

    const systemPrompt = TEAM_PROMPTS[teamId] || `나는 Jarvis Company의 ${teamId} 담당자입니다. 질문에 답변합니다.`;
    const db = getDb();

    // 사용자 메시지 저장
    db.prepare('INSERT INTO game_chat (team_id, role, content) VALUES (?, ?, ?)').run(teamId, 'user', message);

    // 최근 대화 컨텍스트 (최근 6개)
    const recentMessages = db.prepare(
      'SELECT role, content FROM game_chat WHERE team_id = ? ORDER BY created_at DESC LIMIT 6'
    ).all(teamId) as Array<{ role: string; content: string }>;

    const conversationContext = recentMessages.reverse()
      .map(m => `${m.role === 'user' ? '사용자' : '나'}: ${m.content}`)
      .join('\n');

    const fullPrompt = `${systemPrompt}\n\n짧고 자연스럽게 한국어로 답변해주세요.\n\n최근 대화:\n${conversationContext}`;

    let assistantContent: string;
    // Claude CLI 절대경로 탐색 (LaunchAgent PATH 제약 회피)
    const CLAUDE_BIN = process.env.CLAUDE_BINARY ||
      (existsSync(`${process.env.HOME}/.local/bin/claude`) ? `${process.env.HOME}/.local/bin/claude` : 'claude');

    try {
      // 깨끗한 환경 (NODE_OPTIONS 상속 차단 + CLAUDE.md 로드 방지)
      // HOME을 /tmp로 설정하면 claude가 ~/.claude/CLAUDE.md를 로드하지 않음
      const realHome = process.env.HOME || '/Users/ramsbaby';
      const cleanEnv: Record<string, string> = {
        HOME: realHome, // claude 인증은 ~/.claude 필요
        USER: process.env.USER || 'ramsbaby',
        PATH: `${realHome}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
        TERM: 'dumb',
        LANG: 'en_US.UTF-8',
      };

      // 메시지에 시스템 프롬프트를 인라인으로 포함 (standalone 환경 문제 회피)
      const combinedPrompt = `${fullPrompt}\n\n[질문] ${message}\n\n위 질문에 ${systemPrompt.split('입니다')[0]}입니다의 입장에서 한국어로 짧게 답변해주세요. 절대 "이전 세션" 같은 말 하지 마세요.`;

      assistantContent = execFileSync(CLAUDE_BIN, [
        '-p', combinedPrompt,
        '--output-format', 'text',
        '--dangerously-skip-permissions',
      ], {
        timeout: 60_000,
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
        cwd: '/tmp',
        env: cleanEnv as unknown as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch (err: unknown) {
      // 상세 에러 정보 수집
      const e = err as { message?: string; stderr?: Buffer | string; status?: number; code?: string };
      const stderrStr = e.stderr ? (Buffer.isBuffer(e.stderr) ? e.stderr.toString('utf8') : String(e.stderr)) : '';
      const detail = stderrStr || e.message || String(err);
      assistantContent = `잠시 응답을 처리하지 못했어요.\n상세: ${detail.slice(0, 400)}\nstatus=${e.status} code=${e.code}`;
      console.error('[game-chat] claude error:', { message: e.message, stderr: stderrStr.slice(0, 500), status: e.status, code: e.code });
    }

    // 어시스턴트 응답 저장
    const result = db.prepare(
      'INSERT INTO game_chat (team_id, role, content) VALUES (?, ?, ?)'
    ).run(teamId, 'assistant', assistantContent);

    const saved = db.prepare('SELECT * FROM game_chat WHERE id = ?').get(result.lastInsertRowid) as {
      id: number; team_id: string; role: string; content: string; created_at: number;
    };

    return NextResponse.json({
      id: saved.id,
      role: saved.role,
      content: saved.content,
      created_at: saved.created_at,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
