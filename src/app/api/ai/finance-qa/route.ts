import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiApiKeys,
  runWithGeminiFailover,
} from '@/lib/ai/gemini-server';
import { buildDeterministicFinanceAnswer } from '@/lib/finance/qa-analyzer';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildLocalFinanceFallback(question: string, context: unknown, fallbackReason: string) {
  return NextResponse.json({
    answer: buildDeterministicFinanceAnswer(question, context),
    source: 'local',
    model: 'local-analyzer',
    fallbackReason,
  });
}

function buildFinanceQaPrompt(
  question: string,
  context: unknown,
  history: ChatHistoryMessage[]
): string {
  const conversationHistory = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`)
    .join('\n');
  const recentBlock = conversationHistory ? `RECENT CONVERSATION:\n${conversationHistory}\n` : '';

  return `You are HabitFlow's concise, high-signal Life OS Analyst (Finance + Fitness + Sleep + Supplements + Mood Triggers).
Answer the user's specific question directly and concisely using ONLY the verified Life OS & Financial snapshot below (currency: INR ₹).
When asked about supplements/whey ROI, gym ₹/workout ROI, junk food empty kcal & fat-loss drag (kcal/7700), or sleep/mood spend triggers, cite the exact computed values from lifeOs.crossDomain & lifeOs.fitnessTelemetry.
Do NOT repeat a generic full monthly summary if the user asks a targeted question.
Never invent transactions, meals, workouts, or balances that are not in the snapshot. If data is missing, state it directly.
Keep responses crisp (2–5 short sentences or clean '-' bullets), format numbers in Indian rupee format (e.g. ₹12,450), bold only key totals or section labels sparingly, avoid backticks around transaction names, and end with one concrete next step when helpful.

LIFE OS & FINANCIAL SNAPSHOT (JSON):
${JSON.stringify(context)}

${recentBlock}USER QUESTION:
${question}`;
}

async function queryGeminiFinanceQa(
  question: string,
  context: unknown,
  history: ChatHistoryMessage[]
) {
  try {
    const prompt = buildFinanceQaPrompt(question, context, history);
    const response = await runWithGeminiFailover((ai) =>
      ai.models.generateContent({ model: DEFAULT_GEMINI_MODEL, contents: prompt })
    );
    const answer = response.text?.trim();
    if (answer) {
      return NextResponse.json({ answer, source: 'gemini', model: DEFAULT_GEMINI_MODEL });
    }
    return buildLocalFinanceFallback(question, context, 'empty_response');
  } catch (aiErr) {
    console.warn('[finance-qa] Gemini error, falling back to local analyzer:', aiErr);
    const reason = aiErr instanceof Error ? aiErr.message : 'gemini_error';
    return buildLocalFinanceFallback(question, context, reason);
  }
}

async function parseFinanceQaInput(req: NextRequest) {
  const body = await req.json();
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const context = body?.context ?? {};
  const history: ChatHistoryMessage[] = Array.isArray(body?.history) ? body.history.slice(-6) : [];
  return { question, context, history };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limitResult = await rateLimit(req, { limit: 25, windowMs: 60 * 1000 });
    if (!limitResult.success) return rateLimitResponse(limitResult.retryAfter);

    const { question, context, history } = await parseFinanceQaInput(req);
    if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 });

    if (resolveGeminiApiKeys().length === 0) {
      return buildLocalFinanceFallback(question, context, 'missing_api_key');
    }

    return await queryGeminiFinanceQa(question, context, history);
  } catch (error) {
    console.error('[finance-qa] Error:', error);
    return NextResponse.json({ error: 'Unable to answer financial query' }, { status: 500 });
  }
}
