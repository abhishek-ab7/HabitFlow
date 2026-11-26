import * as chrono from 'chrono-node';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';

export type QuickCaptureIntent = 'expense' | 'task';

export interface ParsedQuickExpense {
  amount: number;
  title: string;
  categorySlug: string;
  splitWithFriend?: string;
  isSplit: boolean;
  splitAmount?: number;
  date: string;
}

export interface ParsedQuickTask {
  title: string;
  dueDate?: string;
  dueTime?: string;
  priority: 'low' | 'medium' | 'high';
}

const NON_PERSON_SPLIT_WORDS = new Set([
  'milk',
  'sugar',
  'tea',
  'coffee',
  'card',
  'credit',
  'credit card',
  'debit',
  'debit card',
  'upi',
  'cash',
  'tax',
  'taxes',
  'gst',
  'tip',
  'extra',
  'cheese',
  'butter',
  'the',
  'my',
  'a',
  'an',
  'me',
  'it',
  'friends',
  'colleagues',
  'family',
  'discount',
  'coupon',
]);

/**
 * Detects whether the input phrase is likely an expense or a task.
 */
const PAST_SPEND_RE = /\b(spent|paid|bought|ordered|cost)\b/i;
const MERCHANT_EXPENSE_RE = /\b(swiggy|zomato|coffee|chai|uber|ola|lunch|dinner|groceries|zepto|blinkit)\b/i;
const TASK_KEYWORDS_RE = /\b(call|email|send|write|finish|read|review|study|fix|prepare|meeting|meet|todo|remind|schedule|clean|submit|organize|task)\b/i;
const FUTURE_CUE_RE = /\b(tomorrow|tonight|next\s+week|reminder|remind|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i;

interface QuickTextCtx {
  text: string;
  lower: string;
}

function hasStandaloneNumber(text: string): boolean {
  const cleaned = text.replace(/\b50[-/]50\b/gi, '');
  return /(?<!:)\b(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?(?!\s*(?::|am|pm|hours?|mins?|minutes?|days?|months?|years?|o'clock|th|st|nd|rd))\b/i.test(
    cleaned
  );
}

function classifyPayOrBillIntent(ctx: QuickTextCtx, hasNumber: boolean): QuickCaptureIntent {
  if (FUTURE_CUE_RE.test(ctx.lower) || TASK_KEYWORDS_RE.test(ctx.lower)) return 'task';
  return hasNumber ? 'expense' : 'task';
}

function hasCurrencyMention(text: string): boolean {
  return /(?:₹|rs\.?|inr|\$|€)\s*[\d,]+|[\d,]+\s*(?:rs|inr|rupees|bucks)/i.test(text);
}

function classifySpendOrMerchantIntent(ctx: QuickTextCtx, hasNumber: boolean): QuickCaptureIntent {
  return TASK_KEYWORDS_RE.test(ctx.lower) && !hasNumber ? 'task' : 'expense';
}

function isLikelyTaskCue(lower: string, hasNumber: boolean): boolean {
  if (!hasNumber) return true;
  return TASK_KEYWORDS_RE.test(lower) || FUTURE_CUE_RE.test(lower);
}

function resolveIntentFromCues(ctx: QuickTextCtx, hasNumber: boolean): QuickCaptureIntent {
  if (PAST_SPEND_RE.test(ctx.lower) || MERCHANT_EXPENSE_RE.test(ctx.lower)) {
    return classifySpendOrMerchantIntent(ctx, hasNumber);
  }
  if (/\b(pay|bill|recharge|expense|split)\b/i.test(ctx.lower)) {
    return classifyPayOrBillIntent(ctx, hasNumber);
  }
  return isLikelyTaskCue(ctx.lower, hasNumber) ? 'task' : 'expense';
}

export function detectIntent(input: string): QuickCaptureIntent {
  const text = input.trim();
  const lower = text.toLowerCase();
  if (!lower || hasCurrencyMention(text)) return 'expense';
  return resolveIntentFromCues({ text, lower }, hasStandaloneNumber(text));
}

const EXPENSE_CATEGORY_RULES: Array<[RegExp, string]> = [
  [/\b(zomato|swiggy|food|dinner|lunch|breakfast|coffee|chai|cafe|pizza|burger|restaurant|snack|tea)\b/, 'food-dining'],
  [/\b(zepto|blinkit|instamart|grocery|groceries|bigbasket|dmart|milk|veggies|vegetables)\b/, 'groceries-household'],
  [/\b(uber|ola|rapido|metro|fuel|petrol|diesel|cab|auto|flight|train|irctc|bus)\b/, 'transport-fuel'],
  [/\b(electricity|wifi|broadband|recharge|bill|water|gas|jio|airtel)\b/, 'utilities-bills'],
  [/\b(netflix|spotify|prime|movie|gym|subscription|hotstar|youtube|game|cinema)\b/, 'entertainment-subscriptions'],
  [/\b(medicine|pharmacy|doctor|apollo|1mg|hospital|clinic)\b/, 'medical-supplements'],
];

function inferExpenseCategorySlug(ctx: QuickTextCtx): string {
  return EXPENSE_CATEGORY_RULES.find(([re]) => re.test(ctx.lower))?.[1] ?? 'shopping-personal-care';
}

const SPLIT_FRIEND_PATTERNS: RegExp[] = [
  /(?:split\s+with|shared\s+with|share\s+with|split\s+50[-/]50\s+with)\s+([A-Za-z0-9_-]+)/i,
  /with\s+([A-Za-z0-9_-]+)\s+(?:split|50[-/]50|half|shares?|owes?)/i,
  /([A-Za-z0-9_-]+)\s+(?:split|owes?|shares?|half)/i,
  /with\s+([A-Za-z0-9_-]+)/i,
];

function parseSplitDetails(ctx: QuickTextCtx): { isSplit: boolean; splitWithFriend?: string } {
  if (!/\b(split|50[-/]50|share|shared|sharing|owes?|half)\b/i.test(ctx.lower)) {
    return { isSplit: false };
  }
  const match = SPLIT_FRIEND_PATTERNS.map((re) => ctx.text.match(re)).find(Boolean);
  if (!match) return { isSplit: true };
  const candidate = match[1].trim();
  if (NON_PERSON_SPLIT_WORDS.has(candidate.toLowerCase())) return { isSplit: true };
  return { isSplit: true, splitWithFriend: candidate.charAt(0).toUpperCase() + candidate.slice(1) };
}

function cleanExpenseTitle(params: { text: string; categorySlug: string; splitWithFriend?: string }): string {
  const { text, categorySlug, splitWithFriend } = params;
  let cleaned = text;
  if (splitWithFriend) {
    const friendPattern = new RegExp(
      `(?:split\\s+with|shared\\s+with|share\\s+with|with)\\s+${splitWithFriend}(?:\\s+(?:split|50[-/]50|half))?`,
      'gi'
    );
    cleaned = cleaned
      .replace(friendPattern, '')
      .replace(new RegExp(`\\b${splitWithFriend}\\s+(?:split|owes?|shares?|half)\\b`, 'gi'), '');
  }
  cleaned = cleaned
    .replace(/\b(split|50[-/]50|half)\b/gi, '')
    .replace(/(?:₹|rs\.?|inr|\$|€)\s*[\d,]+(?:\.\d{1,2})?/gi, '')
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:rs|inr|rupees|bucks)\b/gi, '')
    .replace(/(?<!:)\b(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?(?!\s*:)\b/g, '')
    .replace(/\b(spent|spend|paid|pay|bought|buy|for|on|at)\b/gi, '')
    .replace(/\b(today|yesterday|tomorrow)\b/gi, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return categorySlug === 'food-dining' ? 'Food & Drinks' : 'Expense';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function parseExpenseNaturalLanguage(input: string): ParsedQuickExpense {
  const text = input.trim();
  const ctx: QuickTextCtx = { text, lower: text.toLowerCase() };
  const stripped = text.replace(/\b50[-/]50\b/gi, '');
  const amountMatch =
    stripped.match(/(?:₹|rs\.?|inr|\$|€)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    stripped.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs|inr|rupees|bucks)\b/i) ||
    stripped.match(/(?<!:)\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?!\s*:)\b/);

  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
  const { isSplit, splitWithFriend } = parseSplitDetails(ctx);
  const splitAmount = isSplit && amount > 0 ? Math.round((amount / 2) * 100) / 100 : undefined;
  const categorySlug = inferExpenseCategorySlug(ctx);
  const parsedDateObj = chrono.parseDate(input);

  return {
    amount,
    title: cleanExpenseTitle({ text, categorySlug, splitWithFriend }),
    categorySlug,
    splitWithFriend,
    isSplit,
    splitAmount,
    date: parsedDateObj ? getLocalIsoDate(parsedDateObj) : getLocalIsoDate(),
  };
}

/**
 * Heuristically parses a task and due date/time using chrono-node.
 */
export function parseTaskNaturalLanguage(input: string): ParsedQuickTask {
  const text = input.trim();
  const lower = text.toLowerCase();

  // Priority
  let priority: ParsedQuickTask['priority'] = 'medium';
  if (/\b(urgent|asap|p1|high\s+priority|critical|emergency)\b/i.test(lower)) {
    priority = 'high';
  } else if (/\b(low\s+priority|someday|whenever|p3|minor)\b/i.test(lower)) {
    priority = 'low';
  }

  // Chrono date extraction
  const parsedResults = chrono.parse(input);
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  let textWithoutDate = text;

  if (parsedResults.length > 0) {
    const result = parsedResults[0];
    const dateObj = result.start.date();
    dueDate = getLocalIsoDate(dateObj);

    if (result.start.isCertain('hour')) {
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      dueTime = `${hours}:${minutes}`;
    }

    // Remove parsed date segment from title
    textWithoutDate = text.replace(result.text, '');
  }

  // Clean title
  let cleaned = textWithoutDate
    .replace(/\b(urgent|asap|p1|high\s+priority|critical|low\s+priority|p3)\b/gi, '')
    .replace(/\b(remind\s+me\s+to|need\s+to|have\s+to|todo:?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    cleaned = 'Untitled Task';
  } else {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return {
    title: cleaned,
    dueDate,
    dueTime,
    priority,
  };
}
