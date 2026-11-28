import { NextRequest, NextResponse } from 'next/server';
import { getIstIsoDate } from '@/lib/mcp/config';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { UniversalParserContext } from '@/lib/quick-capture/universal-parser';
import {
  RecentTransactionRefSchema,
  type RecentTransactionRef,
} from '@/lib/ai/graphs/capture-state';
import { runUniversalCaptureGraph } from '@/lib/ai/graphs/universal-capture';

const asArray = <T,>(val: unknown): T[] => (Array.isArray(val) ? val : []);

function buildContextFromBody(body: Record<string, unknown>, todayIso: string): UniversalParserContext {
  return {
    todayIso,
    accounts: asArray(body?.accounts),
    categories: asArray(body?.categories),
    mealTemplates: asArray(body?.mealTemplates),
    supplements: asArray(body?.supplements),
  };
}

function parseRecentTransactions(val: unknown): RecentTransactionRef[] {
  if (!Array.isArray(val)) return [];
  const out: RecentTransactionRef[] = [];
  for (const item of val.slice(0, 50)) {
    const parsed = RecentTransactionRefSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

async function authorizeUniversalCapture(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limitResult = await rateLimit(req, { limit: 25, windowMs: 60 * 1000 });
  if (!limitResult.success) return rateLimitResponse(limitResult.retryAfter);

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const authError = await authorizeUniversalCapture(req);
    if (authError) return authError;

    const body = (await req.json()) as Record<string, unknown>;
    const rawText = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!rawText) return NextResponse.json({ error: 'Capture text is required' }, { status: 400 });

    const todayIso = getIstIsoDate();
    const result = await runUniversalCaptureGraph({
      rawText,
      todayIso,
      context: buildContextFromBody(body, todayIso),
      recentTransactions: parseRecentTransactions(body?.recentTransactions),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[UniversalCapture API] Error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
