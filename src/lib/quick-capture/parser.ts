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
export function detectIntent(input: string): QuickCaptureIntent {
  const text = input.trim();
  const lower = text.toLowerCase();
  if (!lower) return 'expense';

  // Explicit currency indicator (₹, rs, inr, $, €, rupees, bucks)
  const hasCurrency = /(?:₹|rs\.?|inr|\$|€)\s*[\d,]+|[\d,]+\s*(?:rs|inr|rupees|bucks)/i.test(text);

  // Past-tense spend cues
  const pastSpendKeywords = /\b(spent|paid|bought|ordered|cost)\b/i;
  const merchantExpenseKeywords = /\b(swiggy|zomato|coffee|chai|uber|ola|lunch|dinner|groceries|zepto|blinkit)\b/i;

  // Task & Future reminder cues
  const taskKeywords = /\b(call|email|send|write|finish|read|review|study|fix|prepare|meeting|meet|todo|remind|schedule|clean|submit|organize|task)\b/i;
  const futureReminderCues = /\b(tomorrow|tonight|next\s+week|reminder|remind|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i;

  // Standalone numbers not part of time (e.g. not "6pm", "6:00", "6 am") or split ratios ("50/50")
  const textWithoutSplitRatios = text.replace(/\b50[-/]50\b/gi, '');
  const explicitNumberMatch = textWithoutSplitRatios.match(
    /(?<!:)\b(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?(?!\s*(?::|am|pm|hours?|mins?|minutes?|days?|months?|years?|o'clock|th|st|nd|rd))\b/i
  );
  const hasExplicitNumber = !!explicitNumberMatch;

  // 1. Explicit currency always indicates expense
  if (hasCurrency) return 'expense';

  // 2. Past-tense spending verbs or common spend services
  if (pastSpendKeywords.test(lower) || merchantExpenseKeywords.test(lower)) {
    if (taskKeywords.test(lower) && !hasExplicitNumber) return 'task';
    return 'expense';
  }

  // 3. For "pay ..." or "bill ...":
  // Only classify as expense when explicit monetary amount is present and no future reminder cues without currency
  const isPayOrBill = /\b(pay|bill|recharge|expense|split)\b/i.test(lower);
  if (isPayOrBill) {
    if (futureReminderCues.test(lower) || taskKeywords.test(lower)) {
      return 'task';
    }
    if (hasExplicitNumber) {
      return 'expense';
    }
    return 'task';
  }

  // 4. Task keywords or future cues
  if (taskKeywords.test(lower) || futureReminderCues.test(lower)) {
    return 'task';
  }

  // 5. Standalone number with spend context
  if (hasExplicitNumber && /\b(spend|buy)\b/i.test(lower)) {
    return 'expense';
  }

  // 6. Generic numbers without task verbs (e.g. "uber 350", "cab 100")
  if (hasExplicitNumber && !taskKeywords.test(lower)) {
    return 'expense';
  }

  return 'task';
}

/**
 * Heuristically parses an expense from natural language input.
 */
export function parseExpenseNaturalLanguage(input: string): ParsedQuickExpense {
  const text = input.trim();
  const lower = text.toLowerCase();

  // 1. Amount: matches ₹1,200, 1,200 rs, 12,500.50, 420 (excluding split ratios like 50/50)
  const textWithoutSplitRatios = text.replace(/\b50[-/]50\b/gi, '');
  const amountMatch =
    textWithoutSplitRatios.match(/(?:₹|rs\.?|inr|\$|€)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    textWithoutSplitRatios.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs|inr|rupees|bucks)\b/i) ||
    textWithoutSplitRatios.match(/(?<!:)\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?!\s*:)\b/);

  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  // 2. Split with friend detection
  // Requires explicit split cues (split, 50-50, 50/50, share, owes, half)
  let splitWithFriend: string | undefined;
  let isSplit = false;

  const hasExplicitSplitCue = /\b(split|50[-/]50|share|shared|sharing|owes?|half)\b/i.test(lower);

  if (hasExplicitSplitCue) {
    const splitWithMatch =
      text.match(/(?:split\s+with|shared\s+with|share\s+with|split\s+50[-/]50\s+with)\s+([A-Za-z0-9_-]+)/i) ||
      text.match(/with\s+([A-Za-z0-9_-]+)\s+(?:split|50[-/]50|half|shares?|owes?)/i) ||
      text.match(/([A-Za-z0-9_-]+)\s+(?:split|owes?|shares?|half)/i) ||
      text.match(/with\s+([A-Za-z0-9_-]+)/i);

    if (splitWithMatch) {
      const candidate = splitWithMatch[1].trim();
      const candidateLower = candidate.toLowerCase();
      if (!NON_PERSON_SPLIT_WORDS.has(candidateLower)) {
        splitWithFriend = candidate.charAt(0).toUpperCase() + candidate.slice(1);
        isSplit = true;
      } else {
        isSplit = true; // generic split without a valid friend name
      }
    } else {
      isSplit = true;
    }
  }

  const splitAmount = isSplit && amount > 0 ? Math.round((amount / 2) * 100) / 100 : undefined;

  // 3. Category inference
  let categorySlug = 'shopping-personal-care';
  if (/\b(zomato|swiggy|food|dinner|lunch|breakfast|coffee|chai|cafe|pizza|burger|restaurant|snack|tea)\b/.test(lower)) {
    categorySlug = 'food-dining';
  } else if (/\b(zepto|blinkit|instamart|grocery|groceries|bigbasket|dmart|milk|veggies|vegetables)\b/.test(lower)) {
    categorySlug = 'groceries-household';
  } else if (/\b(uber|ola|rapido|metro|fuel|petrol|diesel|cab|auto|flight|train|irctc|bus)\b/.test(lower)) {
    categorySlug = 'transport-fuel';
  } else if (/\b(electricity|wifi|broadband|recharge|bill|water|gas|jio|airtel)\b/.test(lower)) {
    categorySlug = 'utilities-bills';
  } else if (/\b(netflix|spotify|prime|movie|gym|subscription|hotstar|youtube|game|cinema)\b/.test(lower)) {
    categorySlug = 'entertainment-subscriptions';
  } else if (/\b(medicine|pharmacy|doctor|apollo|1mg|hospital|clinic)\b/.test(lower)) {
    categorySlug = 'medical-supplements';
  }

  // 4. Date
  const parsedDateObj = chrono.parseDate(input);
  const date = parsedDateObj ? getLocalIsoDate(parsedDateObj) : getLocalIsoDate();

  // 5. Clean Title (remove amounts, commas, explicit split phrases)
  let cleaned = text;

  if (isSplit && splitWithFriend) {
    const friendPattern = new RegExp(
      `(?:split\\s+with|shared\\s+with|share\\s+with|with)\\s+${splitWithFriend}(?:\\s+(?:split|50[-/]50|half))?`,
      'gi'
    );
    cleaned = cleaned.replace(friendPattern, '');
    cleaned = cleaned.replace(new RegExp(`\\b${splitWithFriend}\\s+(?:split|owes?|shares?|half)\\b`, 'gi'), '');
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

  // If title was stripped away, derive fallback from category
  if (!cleaned) {
    cleaned = categorySlug === 'food-dining' ? 'Food & Drinks' : 'Expense';
  } else {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return {
    amount,
    title: cleaned,
    categorySlug,
    splitWithFriend,
    isSplit,
    splitAmount,
    date,
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
