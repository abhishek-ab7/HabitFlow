import { NextRequest, NextResponse } from 'next/server';
import { resolveGeminiApiKeys } from '@/lib/ai/gemini-server';
import {
  runFinanceQaLoop,
  type FinanceQaHistoryMessage,
} from '@/lib/ai/tools/finance-qa-loop';
import { buildDeterministicFinanceAnswer } from '@/lib/finance/qa-analyzer';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function buildLocalFinanceFallback(question: string, context: unknown, fallbackReason: string) {
  return NextResponse.json({
    answer: buildDeterministicFinanceAnswer(question, context),
    source: 'local',
    model: 'local-analyzer',
    fallbackReason,
  });
}

async function parseFinanceQaInput(req: NextRequest) {
  const body = await req.json();
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const context = body?.context ?? {};
  const history: FinanceQaHistoryMessage[] = Array.isArray(body?.history) ? body.history.slice(-6) : [];
  return { question, context, history };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limitResult = await rateLimit(req, { limit: 25, windowMs: 60 * 1000 });
    if (!limitResult.success) return rateLimitResponse(limitResult.retryAfter);

    const { question, context, history } = await parseFinanceQaInput(req);
    if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 });

    if (resolveGeminiApiKeys().length === 0) {
      return buildLocalFinanceFallback(question, context, 'missing_api_key');
    }

    try {
      const result = await runFinanceQaLoop({ question, context, history });
      if (result) {
        return NextResponse.json({
          answer: result.answer,
          source: 'gemini',
          model: result.model,
          steps: result.steps,
          toolCallsUsed: result.toolCallsUsed,
        });
      }
      return buildLocalFinanceFallback(question, context, 'empty_response');
    } catch (aiErr) {
      console.warn('[finance-qa] Gemini error, falling back to local analyzer:', aiErr);
      const reason = aiErr instanceof Error ? aiErr.message : 'gemini_error';
      return buildLocalFinanceFallback(question, context, reason);
    }
  } catch (error) {
    console.error('[finance-qa] Error:', error);
    return NextResponse.json({ error: 'Unable to answer financial query' }, { status: 500 });
  }
}
