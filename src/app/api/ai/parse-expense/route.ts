import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiApiKeys,
  runWithGeminiFailover,
} from '@/lib/ai/gemini-server';

interface CategoryInput {
  id: string;
  name: string;
  slug: string;
  subcategories?: string[];
}

interface ParsedExpenseResult {
  title: string;
  amount: number;
  type: 'expense' | 'income' | 'investment';
  categorySlug: string;
  subcategory: string;
  paymentMethodType: 'upi' | 'bank' | 'cash' | 'credit_card' | 'wallet';
  date: string;
  suggestedCommitmentKeyword: string | null;
  tags: string[];
  confidence: number;
}

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function extractRelativeDate(rawText: string): string {
  const lower = rawText.toLowerCase();
  const d = new Date();
  if (/\byesterday\b/.test(lower)) {
    d.setDate(d.getDate() - 1);
  } else {
    const daysAgo = lower.match(/\b(\d+)\s*days?\s*ago\b/);
    if (daysAgo) {
      d.setDate(d.getDate() - parseInt(daysAgo[1], 10));
    }
  }
  const isoMatch = rawText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function parseExpenseDeterministically(rawText: string): ParsedExpenseResult {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  const amountMatch =
    text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs|inr|rupees|bucks)\b/i) ||
    text.match(/\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/);

  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  let type: 'expense' | 'income' | 'investment' = 'expense';
  if (/\b(salary|received|credited|income|bonus|refund|cashback|dividend)\b/.test(lower)) {
    type = 'income';
  } else if (/\b(sip|mutual fund|nifty|index fund|stocks|zerodha|groww|invested)\b/.test(lower)) {
    type = 'investment';
  }

  let paymentMethodType: ParsedExpenseResult['paymentMethodType'] = 'upi';
  if (/\b(credit\s*card|cc|amex|hdfc\s*card|icici\s*card|sbi\s*card)\b/.test(lower)) {
    paymentMethodType = 'credit_card';
  } else if (/\bcash\b/.test(lower)) {
    paymentMethodType = 'cash';
  } else if (/\b(bank|neft|imps|netbanking|debit)\b/.test(lower)) {
    paymentMethodType = 'bank';
  } else if (/\bwallet\b/.test(lower)) {
    paymentMethodType = 'wallet';
  }

  let categorySlug = 'shopping-personal-care';
  let subcategory = '';
  if (type === 'income' || type === 'investment') {
    categorySlug = 'investments-savings';
  } else if (/\b(zomato|swiggy|food|dinner|lunch|breakfast|coffee|chai|cafe|pizza|burger|restaurant)\b/.test(lower)) {
    categorySlug = 'food-dining';
    subcategory = 'Online Delivery';
  } else if (/\b(zepto|blinkit|instamart|grocery|groceries|bigbasket|dmart|milk|vegetables)\b/.test(lower)) {
    categorySlug = 'groceries-household';
    subcategory = 'Supermarket';
  } else if (/\b(pharmacy|medicine|doctor|apollo|1mg|protein|whey|supplement|hospital)\b/.test(lower)) {
    categorySlug = 'medical-supplements';
  } else if (/\b(electricity|wifi|broadband|recharge|bill|water|gas|jio|airtel)\b/.test(lower)) {
    categorySlug = 'utilities-bills';
  } else if (/\b(uber|ola|rapido|metro|fuel|petrol|diesel|cab|auto|flight|train|irctc)\b/.test(lower)) {
    categorySlug = 'transport-fuel';
  } else if (/\b(netflix|spotify|prime|movie|gym|subscription|hotstar|youtube)\b/.test(lower)) {
    categorySlug = 'entertainment-subscriptions';
  } else if (/\b(mother|mom|father|dad|parents|family|gift)\b/.test(lower)) {
    categorySlug = 'family-commitments';
  } else if (/\b(emi|loan|credit card bill|repay)\b/.test(lower)) {
    categorySlug = 'emis-debt-repayment';
  }

  let suggestedCommitmentKeyword: string | null = null;
  if (/\b(mother|mom|mummy|amma)\b/.test(lower)) {
    suggestedCommitmentKeyword = 'mother';
  } else if (/\b(father|dad|papa)\b/.test(lower)) {
    suggestedCommitmentKeyword = 'father';
  }

  // Clean title by stripping filler words, amounts, payment cues, and temporal cues
  const cleanedTitle = text
    .replace(/(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?/gi, '')
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:rs|inr|rupees|bucks)?\b/gi, '')
    .replace(/\b(spent|paid|bought|sent|received|got|for|on|at|to|via|using|by|with|from|yesterday|today|upi|gpay|phonepe|paytm|cash|credit card|card|bank|hdfc|icici|sbi)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const title = cleanedTitle
    ? cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1)
    : type === 'income'
    ? 'Income Entry'
    : 'Quick Expense';

  return {
    title: title.slice(0, 80),
    amount: isNaN(amount) ? 0 : amount,
    type,
    categorySlug,
    subcategory,
    paymentMethodType,
    date: extractRelativeDate(text),
    suggestedCommitmentKeyword,
    tags: [],
    confidence: amount > 0 ? 78 : 40,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = typeof body?.rawText === 'string' ? body.rawText.trim() : '';
    const categories: CategoryInput[] = Array.isArray(body?.categories) ? body.categories : [];

    if (!rawText) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    const fallback = parseExpenseDeterministically(rawText);

    if (resolveGeminiApiKeys().length === 0) {
      return NextResponse.json({ data: fallback, source: 'deterministic' });
    }

    try {
      const categoryCatalog = categories.length
        ? categories
            .map(
              (c) =>
                `- slug: "${c.slug}" | name: "${c.name}" | subcategories: [${(c.subcategories || []).join(', ')}]`
            )
            .join('\n')
        : 'food-dining, groceries-household, medical-supplements, utilities-bills, family-commitments, shopping-personal-care, transport-fuel, emis-debt-repayment, entertainment-subscriptions, investments-savings';

      const todayIso = getTodayIso();

      const response = await runWithGeminiFailover((ai) =>
        ai.models.generateContent({
          model: DEFAULT_GEMINI_MODEL,
          contents: `Parse this Indian personal finance note or voice transcript into structured transaction JSON.
Today's date is ${todayIso}.

User input: "${rawText}"

Available categories:
${categoryCatalog}

Rules:
- Extract clean concise merchant/title (e.g. "Zepto Groceries", "Zomato Dinner", "HDFC SIP").
- Resolve relative dates like "yesterday" or "2 days ago" to YYYY-MM-DD relative to ${todayIso}.
- Choose the closest matching categorySlug from the list above.
- Detect paymentMethodType among: upi, bank, cash, credit_card, wallet.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                type: { type: Type.STRING, enum: ['expense', 'income', 'investment'] },
                categorySlug: { type: Type.STRING },
                subcategory: { type: Type.STRING },
                paymentMethodType: {
                  type: Type.STRING,
                  enum: ['upi', 'bank', 'cash', 'credit_card', 'wallet'],
                },
                date: { type: Type.STRING },
                suggestedCommitmentKeyword: { type: Type.STRING, nullable: true },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                confidence: { type: Type.NUMBER },
              },
              required: ['title', 'amount', 'type', 'categorySlug', 'paymentMethodType', 'date'],
            },
          },
        })
      );

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text) as Partial<ParsedExpenseResult>;
        const merged: ParsedExpenseResult = {
          title: parsed.title?.trim() || fallback.title,
          amount: Number(parsed.amount) > 0 ? Number(parsed.amount) : fallback.amount,
          type:
            parsed.type === 'income' || parsed.type === 'investment' || parsed.type === 'expense'
              ? parsed.type
              : fallback.type,
          categorySlug: parsed.categorySlug || fallback.categorySlug,
          subcategory: parsed.subcategory || fallback.subcategory,
          paymentMethodType: parsed.paymentMethodType || fallback.paymentMethodType,
          date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date || '') ? parsed.date! : fallback.date,
          suggestedCommitmentKeyword:
            parsed.suggestedCommitmentKeyword ?? fallback.suggestedCommitmentKeyword,
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : [],
          confidence: Number(parsed.confidence) || 92,
        };
        return NextResponse.json({ data: merged, source: 'gemini' });
      }
    } catch (aiErr) {
      console.warn('[parse-expense] Gemini fallback triggered:', aiErr);
    }

    return NextResponse.json({ data: fallback, source: 'deterministic' });
  } catch (error) {
    console.error('[parse-expense] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to parse expense text' }, { status: 500 });
  }
}
