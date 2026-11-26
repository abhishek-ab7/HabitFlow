import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiApiKeys,
  runWithGeminiFailover,
} from '@/lib/ai/gemini-server';
import { getIstIsoDate } from '@/lib/mcp/config';

interface ReceiptImagePayload {
  data: string; // base64 without data: prefix
  mimeType: string;
  fileName?: string;
}

interface CategoryInput {
  id: string;
  name: string;
  slug: string;
}

export interface ScannedReceiptDraft {
  id: string;
  title: string;
  merchantName: string;
  amount: number;
  type: 'expense' | 'income' | 'investment';
  date: string;
  categorySlug: string;
  paymentMethodType: 'upi' | 'bank' | 'cash' | 'credit_card' | 'wallet';
  referenceId?: string;
  notes?: string;
  confidence: number;
  fileName?: string;
}

function getTodayIso(): string {
  return getIstIsoDate();
}

const DEFAULT_RECEIPT_CATEGORIES =
  'junk-food, food-dining, groceries-household, medical-supplements, utilities-bills, family-commitments, shopping-personal-care, transport-fuel, emis-debt-repayment, entertainment-subscriptions, investments-savings';

const RECEIPT_SCAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          merchantName: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          type: { type: Type.STRING, enum: ['expense', 'income', 'investment'] },
          date: { type: Type.STRING },
          categorySlug: { type: Type.STRING },
          paymentMethodType: { type: Type.STRING, enum: ['upi', 'bank', 'cash', 'credit_card', 'wallet'] },
          referenceId: { type: Type.STRING, nullable: true },
          notes: { type: Type.STRING, nullable: true },
          confidence: { type: Type.NUMBER },
        },
        required: ['title', 'amount', 'type', 'date', 'categorySlug', 'paymentMethodType'],
      },
    },
  },
  required: ['items'],
};

function buildReceiptScanParts(rawImages: ReceiptImagePayload[], categories: CategoryInput[], todayIso: string) {
  const categorySlugs = categories.length
    ? categories.map((c) => `${c.slug} (${c.name})`).join(', ')
    : DEFAULT_RECEIPT_CATEGORIES;

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    {
      text: `You are an expert Indian receipt, bill, and UPI payment screenshot (GPay, PhonePe, Paytm, CRED, Amazon Pay, bank app) OCR extractor.
Today's date is ${todayIso}.
Analyze the ${rawImages.length} attached image(s). Extract one structured transaction entry per valid receipt or payment screenshot.
Ignore failed/cancelled payment screenshots.
Available category slugs: ${categorySlugs}.
Return JSON with an "items" array. Use YYYY-MM-DD for dates (default ${todayIso} if unclear).`,
    },
  ];

  for (const img of rawImages) {
    if (!img?.data) continue;
    const cleanBase64 = img.data.includes(',') ? img.data.split(',')[1] : img.data;
    parts.push({ inlineData: { data: cleanBase64, mimeType: img.mimeType || 'image/jpeg' } });
  }
  return parts;
}

const VALID_RECEIPT_TYPES = new Set<ScannedReceiptDraft['type']>(['income', 'investment', 'expense']);

function resolveReceiptType(rawType: ScannedReceiptDraft['type'] | undefined): ScannedReceiptDraft['type'] {
  return rawType && VALID_RECEIPT_TYPES.has(rawType) ? rawType : 'expense';
}

function normalizeReceiptTextFields(item: Partial<ScannedReceiptDraft>) {
  const titleSource = item.title || item.merchantName || 'Scanned Receipt';
  const merchantSource = item.merchantName || item.title || '';
  return {
    title: titleSource.trim().slice(0, 80),
    merchantName: merchantSource.trim().slice(0, 60),
    referenceId: item.referenceId || undefined,
    notes: item.notes || undefined,
  };
}

function normalizeScannedReceiptItem(
  item: Partial<ScannedReceiptDraft>,
  fileName: string | undefined,
  todayIso: string
): ScannedReceiptDraft {
  return {
    id: crypto.randomUUID(),
    ...normalizeReceiptTextFields(item),
    amount: Math.round(Number(item.amount) * 100) / 100,
    type: resolveReceiptType(item.type),
    date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date! : todayIso,
    categorySlug: item.categorySlug || 'shopping-personal-care',
    paymentMethodType: item.paymentMethodType || 'upi',
    confidence: Number(item.confidence) || 90,
    fileName,
  };
}

async function runReceiptOcr(rawImages: ReceiptImagePayload[], categories: CategoryInput[]) {
  const todayIso = getTodayIso();
  const parts = buildReceiptScanParts(rawImages, categories, todayIso);
  const response = await runWithGeminiFailover((ai) =>
    ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json', responseSchema: RECEIPT_SCAN_SCHEMA },
    })
  );

  const rawJson = response.text?.trim();
  if (!rawJson) return [];

  const parsed = JSON.parse(rawJson) as { items?: Array<Partial<ScannedReceiptDraft>> };
  return (parsed.items || [])
    .filter((item) => Number(item.amount) > 0)
    .map((item, idx) => normalizeScannedReceiptItem(item, rawImages[idx]?.fileName, todayIso));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawImages: ReceiptImagePayload[] = Array.isArray(body?.images) ? body.images.slice(0, 5) : [];
    const categories: CategoryInput[] = Array.isArray(body?.categories) ? body.categories : [];

    if (rawImages.length === 0) {
      return NextResponse.json({ error: 'Please attach 1 to 5 receipt or UPI screenshot images.' }, { status: 400 });
    }

    if (resolveGeminiApiKeys().length === 0) {
      return NextResponse.json(
        {
          error: 'Receipt OCR requires a configured server key (such as GEMINI_KEY_TASKS_1 or GEMINI_KEY_TASKS_3), or enter the expense manually.',
          code: 'AI_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const items = await runReceiptOcr(rawImages, categories);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[scan-receipt] OCR failed:', error);
    return NextResponse.json(
      { error: 'Could not read receipt image. Please try a clearer screenshot or enter manually.' },
      { status: 500 }
    );
  }
}
