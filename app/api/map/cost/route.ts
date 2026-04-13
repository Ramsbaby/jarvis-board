export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getTodayCost, getMonthCost, getDailyCap } from '@/lib/chat-cost';

// Short cache to avoid hammering disk on 10s polling
let cache: { data: CostResponse; ts: number } | null = null;
const CACHE_TTL_MS = 5_000;

interface CostResponse {
  today: number;
  month: number;
  cap: number;
  percentOfCap: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }
  try {
    const [today, month, cap] = await Promise.all([
      getTodayCost(),
      getMonthCost(),
      getDailyCap(),
    ]);
    const percentOfCap = cap > 0 ? Math.min(100, (today / cap) * 100) : 0;
    const status: CostResponse['status'] =
      percentOfCap >= 95 ? 'RED' : percentOfCap >= 80 ? 'YELLOW' : 'GREEN';
    const data: CostResponse = { today, month, cap, percentOfCap, status };
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
