import { NextRequest, NextResponse } from 'next/server';
import { HabitFlowAI } from '@/lib/ai/service';
import { expenseParseSchema } from '@/lib/ai/schemas';
import {
  buildExpenseParsePrompt,
  parseExpenseDeterministically,
} from '@/lib/ai/prompts';
import type { ExpenseParseInput, ExpenseParseOutput } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
  let body: ExpenseParseInput = { rawText: '' };
  try {
    body = await request.json();
    const { rawText } = body;

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
      const fallback = parseExpenseDeterministically(body);
      return NextResponse.json({
        data: fallback,
        cached: false,
        deterministic: true,
        generatedAt: new Date().toISOString(),
      });
    }

    try {
      const ai = new HabitFlowAI('tasks');
      const prompt = buildExpenseParsePrompt(body);
      const result = await ai.generate<ExpenseParseOutput>(
        'parse-expense',
        prompt,
        expenseParseSchema
      );
      return NextResponse.json({
        data: result,
        cached: false,
        deterministic: false,
        generatedAt: new Date().toISOString(),
      });
    } catch {
      const fallback = parseExpenseDeterministically(body);
      return NextResponse.json({
        data: fallback,
        cached: false,
        deterministic: true,
        generatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    const fallback = parseExpenseDeterministically(body);
    return NextResponse.json({
      data: fallback,
      cached: false,
      deterministic: true,
      error: error instanceof Error ? error.message : 'Used deterministic parser',
    });
  }
}
