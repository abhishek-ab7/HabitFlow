import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiApiKeys,
  runWithGeminiFailover,
} from '@/lib/ai/gemini-server';
import { buildDeterministicFinanceAnswer } from '@/lib/finance/qa-analyzer';

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    const context = body?.context ?? {};
    const history: ChatHistoryMessage[] = Array.isArray(body?.history)
      ? body.history.slice(-6)
      : [];

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    if (resolveGeminiApiKeys().length === 0) {
      return NextResponse.json({
        answer: buildDeterministicFinanceAnswer(question, context),
        source: 'local',
        model: 'local-analyzer',
        fallbackReason: 'missing_api_key',
      });
    }

    try {
      const conversationHistory = history
        .map((m) => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`)
        .join('\n');

      const response = await runWithGeminiFailover((ai) =>
        ai.models.generateContent({
          model: DEFAULT_GEMINI_MODEL,
          contents: `You are HabitFlow's concise, high-signal Personal Finance Analyst.
Answer the user's specific question directly and concisely using ONLY the verified financial snapshot below (currency: INR ₹).
Do NOT repeat a generic full monthly summary if the user asks a targeted question (e.g. a category, merchant, net worth, bills, or affordability).
Never invent transactions or balances that are not in the snapshot. If data is missing, state it directly.
Keep responses crisp (2–5 short sentences or clean bullets), format numbers in Indian rupee format (e.g. ₹12,450), and end with one concrete next step when helpful.

FINANCIAL SNAPSHOT (JSON):
${JSON.stringify(context)}

${conversationHistory ? `RECENT CONVERSATION:\n${conversationHistory}\n` : ''}
USER QUESTION:
${question}`,
        })
      );

      const answer = response.text?.trim();
      if (answer) {
        return NextResponse.json({
          answer,
          source: 'gemini',
          model: DEFAULT_GEMINI_MODEL,
        });
      }
    } catch (aiErr) {
      console.warn('[finance-qa] Gemini error, falling back to local analyzer:', aiErr);
      return NextResponse.json({
        answer: buildDeterministicFinanceAnswer(question, context),
        source: 'local',
        model: 'local-analyzer',
        fallbackReason: aiErr instanceof Error ? aiErr.message : 'gemini_error',
      });
    }

    return NextResponse.json({
      answer: buildDeterministicFinanceAnswer(question, context),
      source: 'local',
      model: 'local-analyzer',
      fallbackReason: 'empty_response',
    });
  } catch (error) {
    console.error('[finance-qa] Error:', error);
    return NextResponse.json({ error: 'Unable to answer financial query' }, { status: 500 });
  }
}
