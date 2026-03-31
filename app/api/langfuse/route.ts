export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/guest-guard';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

const JARVIS_HOME = process.env.JARVIS_HOME || join(process.env.HOME || '/Users/ramsbaby', '.jarvis');
const LANGFUSE_BASE_URL = process.env.LANGFUSE_BASE_URL || 'http://localhost:3200';
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY || '';
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY || '';

// ── File helpers ──────────────────────────────────────────────────────────────

function readJson<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch { return fallback; }
}

function readText(path: string): string {
  try {
    if (!existsSync(path)) return '';
    return readFileSync(path, 'utf-8');
  } catch { return ''; }
}

// ── 1. Cron log parser ────────────────────────────────────────────────────────

function parseCronLog() {
  const content = readText(join(JARVIS_HOME, 'logs', 'cron.log'));
  const lines = content.split('\n');

  const today = new Date().toISOString().slice(0, 10);
  const daily: Record<string, { ok: number; fail: number }> = {};

  let todayOk = 0, todayFail = 0;
  const recentFails: Array<{ task: string; time: string; detail: string }> = [];

  for (const line of lines) {
    const m = line.match(/^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\] \[([^\]]+)\] (SUCCESS|FAIL|ERROR)/);
    if (!m) continue;
    const [, date, time, task, status] = m;
    if (!daily[date]) daily[date] = { ok: 0, fail: 0 };
    if (status === 'SUCCESS') {
      daily[date].ok++;
      if (date === today) todayOk++;
    } else {
      daily[date].fail++;
      if (date === today) {
        todayFail++;
        if (recentFails.length < 10) {
          const detail = line.slice(line.indexOf(status) + status.length).trim().slice(0, 80);
          recentFails.push({ task, time: `${date} ${time}`, detail });
        }
      }
    }
  }

  const trend = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, v]) => ({ date, ...v, rate: v.ok + v.fail ? Math.round(v.ok / (v.ok + v.fail) * 100) : 100 }));

  const todayTotal = todayOk + todayFail;
  return {
    todayOk, todayFail, todayTotal,
    todayRate: todayTotal ? Math.round(todayOk / todayTotal * 100) : 100,
    recentFails,
    trend,
  };
}

// ── 2. FSM task stats ─────────────────────────────────────────────────────────

function parseFsmStats() {
  try {
    const raw = execFileSync(
      'node',
      ['--experimental-sqlite', '--no-warnings',
        join(JARVIS_HOME, 'lib/task-store.mjs'), 'list'],
      { timeout: 8000, env: { ...process.env, BOT_HOME: JARVIS_HOME } }
    ).toString();
    const tasks = JSON.parse(raw) as Array<Record<string, unknown>>;
    const by: Record<string, number> = {};
    const failed: string[] = [];
    const skipped: string[] = [];
    for (const t of tasks) {
      const s = String(t.status ?? 'unknown');
      by[s] = (by[s] ?? 0) + 1;
      if (s === 'failed' && failed.length < 8) failed.push(String(t.id ?? ''));
      if (s === 'skipped' && skipped.length < 5) skipped.push(String(t.id ?? ''));
    }
    return { total: tasks.length, by, failed, skipped };
  } catch {
    return { total: 0, by: {}, failed: [], skipped: [] };
  }
}

// ── 3. Discord error stats ────────────────────────────────────────────────────

function parseDiscordErrors() {
  const data = readJson<{ errors?: Array<{ errorMessage: string; timestamp: number }> }>(
    join(JARVIS_HOME, 'state/error-tracker.json'), {}
  );
  const errors = data.errors ?? [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = errors.filter(e => e.timestamp > cutoff);
  const counts: Record<string, number> = {};
  for (const e of recent) {
    const key = e.errorMessage.slice(0, 50);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([msg, count]) => ({ msg, count }));
  return { total24h: recent.length, totalAll: errors.length, top };
}

// ── 4. System health ──────────────────────────────────────────────────────────

function parseHealth() {
  const h = readJson<Record<string, unknown>>(join(JARVIS_HOME, 'state/health.json'), {});
  return {
    botStatus: String(h.discord_bot ?? 'unknown'),
    memoryMb: Number(h.memory_mb ?? 0),
    crashCount: Number(h.crash_count ?? 0),
    lastCheck: String(h.last_check ?? ''),
  };
}

// ── 5. Langfuse (optional) ────────────────────────────────────────────────────

function authHeader() {
  return `Basic ${Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString('base64')}`;
}

function daysAgoIso(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchLangfuse() {
  const configured = !!(LANGFUSE_PUBLIC_KEY && LANGFUSE_SECRET_KEY);
  if (!configured) return { configured: false };

  let healthy = false;
  try {
    const h = await fetch(`${LANGFUSE_BASE_URL}/api/public/health`, {
      headers: { Authorization: authHeader() }, signal: AbortSignal.timeout(3000),
    });
    healthy = h.ok;
  } catch { /* offline */ }

  if (!healthy) return { configured: true, healthy: false };

  async function getGens(fromIso: string) {
    try {
      const r = await fetch(
        `${LANGFUSE_BASE_URL}/api/public/generations?limit=500&fromStartTime=${fromIso}`,
        { headers: { Authorization: authHeader() }, signal: AbortSignal.timeout(6000) }
      );
      if (!r.ok) return [];
      return ((await r.json()).data ?? []) as Record<string, unknown>[];
    } catch { return []; }
  }

  function summarise(gens: Record<string, unknown>[]) {
    const total = gens.length;
    const errors = gens.filter(g => g.level === 'ERROR').length;
    const inputTokens = gens.reduce((s, g) => s + ((g.usage as Record<string, number> | null)?.input ?? 0), 0);
    const outputTokens = gens.reduce((s, g) => s + ((g.usage as Record<string, number> | null)?.output ?? 0), 0);
    const cost = gens.reduce((s, g) => s + parseFloat(String((g.metadata as Record<string, unknown> | null)?.cost_usd ?? 0)), 0);
    const durs = gens
      .map(g => parseFloat(String((g.metadata as Record<string, unknown> | null)?.duration_ms ?? 0)))
      .filter(d => d > 0).sort((a, b) => a - b);
    const daily: Record<string, { calls: number; errors: number }> = {};
    for (const g of gens) {
      const day = String(g.startTime ?? '').slice(0, 10);
      if (!day || day.length < 10) continue;
      if (!daily[day]) daily[day] = { calls: 0, errors: 0 };
      daily[day].calls++;
      if (g.level === 'ERROR') daily[day].errors++;
    }
    const modelMap: Record<string, number> = {};
    for (const g of gens) {
      const m = String(g.model ?? 'unknown').split('-')[0];
      modelMap[m] = (modelMap[m] ?? 0) + 1;
    }
    return {
      total, errors,
      errorRate: total ? Math.round(errors / total * 1000) / 10 : 0,
      inputTokens, outputTokens,
      cost: Math.round(cost * 10000) / 10000,
      avgDurMs: durs.length ? Math.round(durs.reduce((s, d) => s + d, 0) / durs.length) : 0,
      p95DurMs: durs.length ? Math.round(durs[Math.floor(durs.length * 0.95)] ?? 0) : 0,
      topModels: Object.entries(modelMap).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([model, count]) => ({ model, count })),
      daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    };
  }

  const [gens7, gens1] = await Promise.all([getGens(daysAgoIso(7)), getGens(daysAgoIso(1))]);
  return { configured: true, healthy: true, week: summarise(gens7), today: summarise(gens1) };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth.isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [langfuse, cron, fsm, discordErrors, health] = await Promise.all([
    fetchLangfuse(),
    Promise.resolve(parseCronLog()),
    Promise.resolve(parseFsmStats()),
    Promise.resolve(parseDiscordErrors()),
    Promise.resolve(parseHealth()),
  ]);

  return NextResponse.json({
    langfuse,
    cron,
    fsm,
    discordErrors,
    health,
    ts: new Date().toISOString(),
  });
}
