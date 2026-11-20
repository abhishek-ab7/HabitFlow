import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildDeterministicAnswer(question: string, context: any): string {
  const q = question.toLowerCase();
  const s = context?.monthlySummary || {};
  const nw = context?.netWorth || {};
  const fmt = (n: number) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

  if (q.includes('afford') || q.includes('safe') || q.includes('buy')) {
    return `You currently have **${fmt(s.safeToSpendMonthly)}** safe to spend for the rest of ${context?.selectedMonth || 'this month'} (**${fmt(s.safeToSpendDaily)}/day** across ${s.remainingDaysInMonth || 0} days left) and **${fmt(nw.liquidAssets)}** in liquid accounts.`;
  }

  if (q.includes('subscription') || q.includes('recurring') || q.includes('bill')) {
    const bills = Array.isArray(context?.recurringBills) ? context.recurringBills : [];
    if (bills.length === 0) {
      return 'You have no active recurring bills or subscriptions tracked yet. Add them in the **Bills & Debt** tab to audit annualized costs.';
    }
    const sorted = [...bills].sort((a, b) => (b.annualized || 0) - (a.annualized || 0));
    const totalAnnual = sorted.reduce((sum, b) => sum + (b.annualized || 0), 0);
    const topList = sorted
      .slice(0, 3)
      .map((b) => `- **${b.name}**: ${fmt(b.amount)}/${b.cadence} (${fmt(b.annualized)}/yr)`)
      .join('\n');
    return `Your active recurring bills total **${fmt(totalAnnual)}/year**:\n${topList}`;
  }

  const topCats = Array.isArray(context?.categories)
    ? [...context.categories].sort((a, b) => (b.spent || 0) - (a.spent || 0)).slice(0, 3)
    : [];
  const catSummary = topCats.length
    ? topCats.map((c) => `- **${c.name}**: ${fmt(c.spent)} (${c.transactionCount} txns)`).join('\n')
    : '- No expenses logged yet this month.';

  return `For **${context?.selectedMonth || 'this month'}**, you've spent **${fmt(s.totalSpent)}** against **${fmt(s.totalIncome)}** income (savings rate **${s.savingsRatePct || 0}%**), with a net worth of **${fmt(nw.netWorth)}**.\n\nTop spending categories:\n${catSummary}`;
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        answer: buildDeterministicAnswer(question, context),
        source: 'deterministic',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const conversationHistory = history
        .map((m) => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are HabitFlow's concise, high-signal Personal Finance Analyst.
Answer the user's question strictly using the verified financial snapshot below (currency: INR ₹).
Never invent transactions or balances that are not in the snapshot. If data is missing, state it directly.
Keep responses crisp (2–5 short sentences or clean bullets), format numbers in Indian rupee format (e.g. ₹12,450), and end with one concrete next step when helpful.

FINANCIAL SNAPSHOT (JSON):
${JSON.stringify(context)}

${conversationHistory ? `RECENT CONVERSATION:\n${conversationHistory}\n` : ''}
USER QUESTION:
${question}`,
      });

      const answer = response.text?.trim();
      if (answer) {
        return NextResponse.json({ answer, source: 'gemini' });
      }
    } catch (aiErr) {
      console.warn('[finance-qa] Falling back to deterministic summary:', aiErr);
    }

    return NextResponse.json({
      answer: buildDeterministicAnswer(question, context),
      source: 'deterministic',
    });
  } catch (error) {
    console.error('[finance-qa] Error:', error);
    return NextResponse.json({ error: 'Unable to answer financial query' }, { status: 500 });
  }
}
