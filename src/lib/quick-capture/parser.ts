import * as chrono from 'chrono-node';

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

/**
 * Detects whether the input phrase is likely an expense or a task.
 */
export function detectIntent(input: string): QuickCaptureIntent {
  const lower = input.toLowerCase().trim();
  if (!lower) return 'expense';

  const hasCurrency = /(?:₹|rs\.?|inr|\$|€)/i.test(input);
  const expenseKeywords = /\b(spent|spend|paid|pay|bought|buy|cost|ordered|bill|expense|split|recharge|swiggy|zomato|coffee|chai|uber|ola|lunch|dinner|groceries|zepto|blinkit)\b/i;
  const taskKeywords = /\b(call|email|send|write|finish|read|review|study|fix|prepare|meeting|meet|todo|remind|schedule|clean|submit|organize|task)\b/i;
  const hasNumbers = /\b\d+(?:\.\d{1,2})?\b/.test(input);

  if (hasCurrency) return 'expense';
  if (expenseKeywords.test(lower) && hasNumbers) return 'expense';
  if (taskKeywords.test(lower) && !hasCurrency) return 'task';
  if (expenseKeywords.test(lower)) return 'expense';
  if (hasNumbers && !taskKeywords.test(lower)) return 'expense';

  return 'task';
}

/**
 * Heuristically parses an expense from natural language input.
 */
export function parseExpenseNaturalLanguage(input: string): ParsedQuickExpense {
  const text = input.trim();
  const lower = text.toLowerCase();

  // 1. Amount
  const amountMatch =
    text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs|inr|rupees|bucks)\b/i) ||
    text.match(/\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/);

  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  // 2. Split with friend detection
  // e.g., "split with Rahul", "with Rahul split", "shared with Rahul", "Rahul split"
  let splitWithFriend: string | undefined;
  let isSplit = false;

  const splitWithMatch =
    text.match(/(?:split\s+with|shared\s+with)\s+([A-Za-z0-9_-]+)/i) ||
    text.match(/with\s+([A-Za-z0-9_-]+)(?:\s+(?:split|50-50))?/i) ||
    text.match(/([A-Za-z0-9_-]+)\s+split/i);

  if (splitWithMatch && !['the', 'my', 'a', 'an', 'me', 'it'].includes(splitWithMatch[1].toLowerCase())) {
    splitWithFriend = splitWithMatch[1].charAt(0).toUpperCase() + splitWithMatch[1].slice(1);
    isSplit = true;
  } else if (/\bsplit\b/i.test(lower)) {
    isSplit = true;
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
  const dateObj = chrono.parseDate(input) || new Date();
  const date = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(
    dateObj.getDate()
  ).padStart(2, '0')}`;

  // 5. Clean Title
  let cleaned = text
    .replace(/(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?/gi, '')
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:rs|inr|rupees|bucks)\b/gi, '')
    .replace(/\b\d+(?:\.\d{1,2})?\b/g, '')
    .replace(/\b(spent|spend|paid|pay|bought|buy|for|on|at)\b/gi, '')
    .replace(/(?:split\s+with|shared\s+with)\s+[A-Za-z0-9_-]+/gi, '')
    .replace(/with\s+[A-Za-z0-9_-]+/gi, '')
    .replace(/\bsplit\b/gi, '')
    .replace(/\b(today|yesterday|tomorrow)\b/gi, '')
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
    dueDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(
      dateObj.getDate()
    ).padStart(2, '0')}`;

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
