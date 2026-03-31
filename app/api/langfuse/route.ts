export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/guest-guard';

const LANGFUSE_BASE_URL = process.env.LANGFUSE_BASE_URL || 'http://localhost:3200';
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY || '';
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY || '';

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
      const json = await r.json() as { data?: Record<string, unknown>[] };
      return json.data ?? [];
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
    // task-name breakdown for top callers
    const taskMap: Record<string, { calls: number; cost: number }> = {};
    for (const g of gens) {
      const name = String((g.metadata as Record<string, unknown> | null)?.task_id ?? g.name ?? 'unknown');
      if (!taskMap[name]) taskMap[name] = { calls: 0, cost: 0 };
      taskMap[name].calls++;
      taskMap[name].cost += parseFloat(String((g.metadata as Record<string, unknown> | null)?.cost_usd ?? 0));
    }
    const topTasks = Object.entries(taskMap)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5)
      .map(([name, v]) => ({ name, ...v, cost: Math.round(v.cost * 10000) / 10000 }));

    return {
      total, errors,
      errorRate: total ? Math.round(errors / total * 1000) / 10 : 0,
      inputTokens, outputTokens,
      cost: Math.round(cost * 10000) / 10000,
      avgDurMs: durs.length ? Math.round(durs.reduce((s, d) => s + d, 0) / durs.length) : 0,
      p95DurMs: durs.length ? Math.round(durs[Math.floor(durs.length * 0.95)] ?? 0) : 0,
      topModels: Object.entries(modelMap).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([model, count]) => ({ model, count })),
      topTasks,
      daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    };
  }

  const [gens7, gens1] = await Promise.all([getGens(daysAgoIso(7)), getGens(daysAgoIso(1))]);
  return { configured: true, healthy: true, week: summarise(gens7), today: summarise(gens1) };
}

export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth.isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const langfuse = await fetchLangfuse();
  return NextResponse.json({ langfuse, ts: new Date().toISOString() });
}
