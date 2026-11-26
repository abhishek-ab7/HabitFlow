import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiApiKeys,
  runWithGeminiFailover,
} from '@/lib/ai/gemini-server';
import { getIstIsoDate } from '@/lib/mcp/config';

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
  return getIstIsoDate();
}

function extractRelativeDate(rawText: string): string {
  const lower = rawText.toLowerCase();
  const isoMatch = rawText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  let daysOffset = 0;
  if (/\byesterday\b/.test(lower)) {
    daysOffset = 1;
  } else {
    const daysAgo = lower.match(/\b(\d+)\s*days?\s*ago\b/);
    if (daysAgo) {
      daysOffset = parseInt(daysAgo[1], 10);
    }
  }
  const target = new Date(Date.now() - daysOffset * 86_400_000);
  return getIstIsoDate(target);
}

const PAYMENT_METHOD_RULES: Array<[RegExp, ParsedExpenseResult['paymentMethodType']]> = [
  [/\b(credit\s*card|cc|amex|hdfc\s*card|icici\s*card|sbi\s*card)\b/, 'credit_card'],
  [/\bcash\b/, 'cash'],
  [/\b(bank|neft|imps|netbanking|debit)\b/, 'bank'],
  [/\bwallet\b/, 'wallet'],
];

const EXPENSE_CATEGORY_RULES: Array<[RegExp, string, string?]> = [
  [/\b(momos?|samosa|pakora|chaat|pani\s*puri|golgappa|jalebi|fries|chips|kurkure|lays|ice\s*cream|pastry|brownie|waffle|donut|burger|pizza|dominos|kfc|mcdonald|junk\s*food)\b/, 'junk-food', 'Fast Food & Street'],
  [/\b(zomato|swiggy|food|dinner|lunch|breakfast|coffee|chai|cafe|restaurant)\b/, 'food-dining', 'Online Delivery'],
  [/\b(zepto|blinkit|instamart|grocery|groceries|bigbasket|dmart|milk|vegetables)\b/, 'groceries-household', 'Supermarket'],
  [/\b(pharmacy|medicine|doctor|apollo|1mg|protein|whey|supplement|hospital)\b/, 'medical-supplements'],
  [/\b(electricity|wifi|broadband|recharge|bill|water|gas|jio|airtel)\b/, 'utilities-bills'],
  [/\b(uber|ola|rapido|metro|fuel|petrol|diesel|cab|auto|flight|train|irctc)\b/, 'transport-fuel'],
  [/\b(netflix|spotify|prime|movie|gym|subscription|hotstar|youtube)\b/, 'entertainment-subscriptions'],
  [/\b(mother|mom|father|dad|parents|family|gift)\b/, 'family-commitments'],
  [/\b(emi|loan|credit card bill|repay)\b/, 'emis-debt-repayment'],
];

function inferTxType(lower: string): ParsedExpenseResult['type'] {
  if (/\b(salary|received|credited|income|bonus|refund|cashback|dividend)\b/.test(lower)) return 'income';
  if (/\b(sip|mutual fund|nifty|index fund|stocks|zerodha|groww|invested)\b/.test(lower)) return 'investment';
  return 'expense';
}

function inferCategoryAndSub(type: ParsedExpenseResult['type'], lower: string): { categorySlug: string; subcategory: string } {
  if (type !== 'expense') return { categorySlug: 'investments-savings', subcategory: '' };
  const match = EXPENSE_CATEGORY_RULES.find(([re]) => re.test(lower));
  return { categorySlug: match?.[1] ?? 'shopping-personal-care', subcategory: match?.[2] ?? '' };
}

function inferCommitmentKeyword(lower: string): string | null {
  if (/\b(mother|mom|mummy|amma)\b/.test(lower)) return 'mother';
  if (/\b(father|dad|papa)\b/.test(lower)) return 'father';
  return null;
}

function cleanExpenseTitle(text: string, type: ParsedExpenseResult['type']): string {
  const cleaned = text
    .replace(/(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?/gi, '')
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:rs|inr|rupees|bucks)?\b/gi, '')
    .replace(/\b(spent|paid|bought|sent|received|got|for|on|at|to|via|using|by|with|from|yesterday|today|upi|gpay|phonepe|paytm|cash|credit card|card|bank|hdfc|icici|sbi)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned) return (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)).slice(0, 80);
  return type === 'income' ? 'Income Entry' : 'Quick Expense';
}

function extractExpenseAmount(text: string): number {
  const amountMatch =
    text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs|inr|rupees|bucks)\b/i) ||
    text.match(/\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/);
  const parsed = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseExpenseDeterministically(rawText: string): ParsedExpenseResult {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const amount = extractExpenseAmount(text);

  const type = inferTxType(lower);
  const paymentMethodType = PAYMENT_METHOD_RULES.find(([re]) => re.test(lower))?.[1] ?? 'upi';
  const { categorySlug, subcategory } = inferCategoryAndSub(type, lower);

  return {
    title: cleanExpenseTitle(text, type),
    amount,
    type,
    categorySlug,
    subcategory,
    paymentMethodType,
    date: extractRelativeDate(text),
    suggestedCommitmentKeyword: inferCommitmentKeyword(lower),
    tags: [],
    confidence: amount > 0 ? 78 : 40,
  };
}

const EXPENSE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    amount: { type: Type.NUMBER },
    type: { type: Type.STRING, enum: ['expense', 'income', 'investment'] },
    categorySlug: { type: Type.STRING },
    subcategory: { type: Type.STRING },
    paymentMethodType: { type: Type.STRING, enum: ['upi', 'bank', 'cash', 'credit_card', 'wallet'] },
    date: { type: Type.STRING },
    suggestedCommitmentKeyword: { type: Type.STRING, nullable: true },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.NUMBER },
  },
  required: ['title', 'amount', 'type', 'categorySlug', 'paymentMethodType', 'date'],
};

interface ExpensePromptInput {
  rawText: string;
  categories: CategoryInput[];
  todayIso: string;
}

function buildExpensePrompt({ rawText, categories, todayIso }: ExpensePromptInput): string {
  const categoryCatalog = categories.length
    ? categories
        .map((c) => `- slug: "${c.slug}" | name: "${c.name}" | subcategories: [${(c.subcategories || []).join(', ')}]`)
        .join('\n')
    : 'junk-food, food-dining, groceries-household, medical-supplements, utilities-bills, family-commitments, shopping-personal-care, transport-fuel, emis-debt-repayment, entertainment-subscriptions, investments-savings';

  return `Parse this Indian personal finance note or voice transcript into structured transaction JSON.
Today's date is ${todayIso}.

User input: "${rawText}"

Available categories:
${categoryCatalog}

Rules:
- Extract clean concise merchant/title (e.g. "Zepto Groceries", "Zomato Dinner", "HDFC SIP").
- Resolve relative dates like "yesterday" or "2 days ago" to YYYY-MM-DD relative to ${todayIso}.
- Choose the closest matching categorySlug from the list above.
- Detect paymentMethodType among: upi, bank, cash, credit_card, wallet.`;
}

function resolveMergedType(
  rawType: Partial<ParsedExpenseResult>['type'],
  fallbackType: ParsedExpenseResult['type']
): ParsedExpenseResult['type'] {
  if (rawType === 'income' || rawType === 'investment' || rawType === 'expense') return rawType;
  return fallbackType;
}

function resolveParsedDate(params: { rawDate?: string; fallbackDate: string }): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(params.rawDate || '') ? params.rawDate! : params.fallbackDate;
}

function mergeParsedExpense(parsed: Partial<ParsedExpenseResult>, fallback: ParsedExpenseResult): ParsedExpenseResult {
  const parsedAmount = Number(parsed.amount);
  return {
    title: parsed.title?.trim() || fallback.title,
    amount: parsedAmount > 0 ? parsedAmount : fallback.amount,
    type: resolveMergedType(parsed.type, fallback.type),
    categorySlug: parsed.categorySlug ?? fallback.categorySlug,
    subcategory: parsed.subcategory ?? fallback.subcategory,
    paymentMethodType: parsed.paymentMethodType ?? fallback.paymentMethodType,
    date: resolveParsedDate({ rawDate: parsed.date, fallbackDate: fallback.date }),
    suggestedCommitmentKeyword: parsed.suggestedCommitmentKeyword ?? fallback.suggestedCommitmentKeyword,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : [],
    confidence: Number(parsed.confidence) || 92,
  };
}

async function parseExpenseWithGemini(params: {
  rawText: string;
  categories: CategoryInput[];
  fallback: ParsedExpenseResult;
}): Promise<{ data: ParsedExpenseResult; source: 'gemini' | 'deterministic' }> {
  const { rawText, categories, fallback } = params;
  try {
    const response = await runWithGeminiFailover((ai) =>
      ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: buildExpensePrompt({ rawText, categories, todayIso: getTodayIso() }),
        config: { responseMimeType: 'application/json', responseSchema: EXPENSE_RESPONSE_SCHEMA },
      })
    );
    const text = response.text?.trim();
    if (!text) return { data: fallback, source: 'deterministic' };
    return {
      data: mergeParsedExpense(JSON.parse(text) as Partial<ParsedExpenseResult>, fallback),
      source: 'gemini',
    };
  } catch (aiErr) {
    console.warn('[parse-expense] Gemini fallback triggered:', aiErr);
    return { data: fallback, source: 'deterministic' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = typeof body?.rawText === 'string' ? body.rawText.trim() : '';
    if (!rawText) return NextResponse.json({ error: 'rawText is required' }, { status: 400 });

    const categories: CategoryInput[] = Array.isArray(body?.categories) ? body.categories : [];
    const fallback = parseExpenseDeterministically(rawText);
    if (resolveGeminiApiKeys().length === 0) {
      return NextResponse.json({ data: fallback, source: 'deterministic' });
    }

    return NextResponse.json(await parseExpenseWithGemini({ rawText, categories, fallback }));
  } catch (error) {
    console.error('[parse-expense] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to parse expense text' }, { status: 500 });
  }
}
