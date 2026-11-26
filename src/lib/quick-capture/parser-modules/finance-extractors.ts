import type { UniversalAccountRef, UniversalCategoryRef } from '../parser-types';

type SegmentText = string;
type CategorySlug = string;
type CategoryName = string;

const ACCOUNT_HINTS: Array<{ pattern: RegExp; type: string; fallbackLabel: string }> = [
  { pattern: /\b(slice|axis|hdfc|icici|sbi|cc|credit\s*card|card)\b/i, type: 'credit_card', fallbackLabel: 'Credit Card' },
  { pattern: /\b(upi|gpay|phonepe|paytm|bhim)\b/i, type: 'upi', fallbackLabel: 'UPI' },
  { pattern: /\bcash\b/i, type: 'cash', fallbackLabel: 'Cash' },
  { pattern: /\b(bank|neft|imps|debit)\b/i, type: 'bank', fallbackLabel: 'Bank' },
  { pattern: /\bwallet\b/i, type: 'wallet', fallbackLabel: 'Wallet' },
];

function matchAccountByName(
  segmentLower: string,
  accounts: UniversalAccountRef[]
): UniversalAccountRef | undefined {
  return accounts.find((acc) => {
    const cleanName = acc.name.toLowerCase();
    const firstWord = cleanName.split(/\s+/)[0];
    if (cleanName && segmentLower.includes(cleanName)) return true;
    return Boolean(firstWord && firstWord.length >= 3 && new RegExp(`\\b${firstWord}\\b`, 'i').test(segmentLower));
  });
}

function findDefaultAccount(accounts: UniversalAccountRef[]) {
  return accounts.find((a) => a.type === 'upi') ?? accounts.find((a) => a.type === 'bank') ?? accounts[0];
}

function matchAccountByHint(segmentLower: string, accounts: UniversalAccountRef[]) {
  const hint = ACCOUNT_HINTS.find((h) => h.pattern.test(segmentLower));
  if (!hint) return null;
  const byType = accounts.find((a) => a.type === hint.type);
  return { accountId: byType?.id, accountName: byType?.name ?? hint.fallbackLabel, matchedExplicitly: true };
}

export function resolveAccount(
  segmentLower: string,
  accounts: UniversalAccountRef[]
): { accountId?: string; accountName: string; matchedExplicitly: boolean } {
  const byName = matchAccountByName(segmentLower, accounts);
  if (byName) return { accountId: byName.id, accountName: byName.name, matchedExplicitly: true };

  const byHint = matchAccountByHint(segmentLower, accounts);
  if (byHint) return byHint;

  const defaultAcc = findDefaultAccount(accounts);
  return { accountId: defaultAcc?.id, accountName: defaultAcc?.name ?? 'UPI', matchedExplicitly: false };
}

const EXPENSE_CATEGORY_RULES: Array<{
  segmentPattern: RegExp;
  catPattern: RegExp;
  fallbackSlug: string;
  fallbackName: string;
}> = [
  {
    segmentPattern: /\b(whey|creatine|vitamin|vit\s*d|b12|magnesium|omega|fish\s*oil|supplement|medicine|doctor|pharmacy|gym)\b/i,
    catPattern: /supplement|health|medical|fitness/i,
    fallbackSlug: 'health-supplements',
    fallbackName: 'Health & Supplements',
  },
  {
    segmentPattern: /\b(swiggy|zomato|restaurant|dinner|lunch|breakfast|thali|coffee|chai|cafe)\b/i,
    catPattern: /food|dining/i,
    fallbackSlug: 'food-dining',
    fallbackName: 'Food & Dining',
  },
  {
    segmentPattern: /\b(uber|ola|rapido|auto|metro|bus|train|petrol|diesel|fuel|cab)\b/i,
    catPattern: /transport|travel|commute/i,
    fallbackSlug: 'transport-travel',
    fallbackName: 'Transport',
  },
  {
    segmentPattern: /\b(zepto|blinkit|instamart|grocery|groceries|bigbasket|dmart|milk|sabzi|fruit)\b/i,
    catPattern: /grocer/i,
    fallbackSlug: 'groceries-household',
    fallbackName: 'Groceries',
  },
  {
    segmentPattern: /\b(bill|recharge|wifi|jio|airtel|electricity|rent|emi)\b/i,
    catPattern: /bill|utilit|housing|rent/i,
    fallbackSlug: 'bills-utilities',
    fallbackName: 'Bills & Utilities',
  },
];

function findCategory(categories: UniversalCategoryRef[], re: RegExp) {
  return categories.find((c) => re.test(`${c.name} ${c.slug}`));
}

function formatCategoryResult(
  cat: UniversalCategoryRef | undefined,
  fallbackSlug: CategorySlug,
  fallbackName: CategoryName
) {
  return {
    categoryId: cat?.id,
    categorySlug: cat?.slug || fallbackSlug,
    categoryName: cat?.name || fallbackName,
  };
}

export function resolveExpenseCategory(
  lower: string,
  categories: UniversalCategoryRef[],
  isJunkFood: boolean,
  isFood: boolean
): { categoryId?: string; categorySlug: string; categoryName: string } {
  if (isJunkFood) {
    const junk = findCategory(categories, /junk/i) || findCategory(categories, /food|dining/i);
    return formatCategoryResult(junk, 'junk-food', 'Junk Food');
  }

  const matchedRule = EXPENSE_CATEGORY_RULES.find((r) => r.segmentPattern.test(lower));
  if (matchedRule) {
    return formatCategoryResult(
      findCategory(categories, matchedRule.catPattern),
      matchedRule.fallbackSlug,
      matchedRule.fallbackName
    );
  }

  if (isFood) {
    return formatCategoryResult(findCategory(categories, /food|dining/i), 'food-dining', 'Food & Dining');
  }

  const fallback = categories.find((c) => c.type === 'expense' || c.type === 'both') || categories[0];
  return formatCategoryResult(fallback, 'other-expense', 'General Expense');
}

const NON_CURRENCY_UNITS_REGEX =
  /\b\d+(?:\.\d+)?\s*(?:steps?|ml|l|liters?|litres?|kg|kgs|cm|in|inch|inches|h|hr|hrs|hours?|m|min|mins|minutes?|cal|kcal|g|gm|gms|eggs?|anda|ande|rotis?|chapatis?|scoops?|cups?|bowls?|glasses?)\b/gi;
const EXPENSE_CONTEXT_REGEX =
  /\b(spent|paid|expense|bill|cost|price|bought|order|swiggy|zomato|momo|momos|chai|samosa|auto|uber|ola|petrol)\b/i;

function parseSegmentAmount(segment: string, lower: string, matchedExplicitly: boolean): number | null {
  const explicitCurrency =
    segment.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    segment.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|rupees|bucks)\b/i);
  if (explicitCurrency) return parseFloat(explicitCurrency[1].replace(/,/g, ''));

  const stripped = segment.replace(NON_CURRENCY_UNITS_REGEX, ' ').replace(/\b[1-5]\s*\/\s*5\b/g, ' ');
  const bareNumber = stripped.match(/\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/);
  if (!bareNumber) return null;

  const candidate = parseFloat(bareNumber[1].replace(/,/g, ''));
  const hasExpenseContext = matchedExplicitly || candidate >= 10 || EXPENSE_CONTEXT_REGEX.test(lower);
  return hasExpenseContext && candidate > 0 ? candidate : null;
}

function stripAccountWords(
  title: SegmentText,
  accountInfo: { accountName: string; matchedExplicitly: boolean }
): SegmentText {
  if (!accountInfo.matchedExplicitly || !accountInfo.accountName) return title;
  const firstWord = accountInfo.accountName.split(/\s+/)[0];
  if (!firstWord || firstWord.length < 3) return title;
  return title.replace(new RegExp(`\\b${firstWord}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
}

function stripCurrencyAndAmount(segment: SegmentText, amount: number | null): SegmentText {
  let out = segment
    .replace(/(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?/gi, ' ')
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:rs\.?|inr|rupees|bucks)\b/gi, ' ');
  if (amount !== null) {
    out = out.replace(new RegExp(`\\b${String(amount).replace('.', '\\.')}\\b`, 'i'), ' ');
  }
  return out;
}

function cleanExpenseTitle(
  segment: SegmentText,
  amount: number | null,
  accountInfo: { accountName: string; matchedExplicitly: boolean }
): string {
  const withoutAmount = stripCurrencyAndAmount(segment, amount)
    .replace(/\b(via|on|using|from|with|by)\b/gi, ' ')
    .replace(/\b(slice|axis|hdfc|icici|sbi|cc|credit\s*card|upi|gpay|phonepe|paytm|cash|wallet|bank)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleaned = stripAccountWords(withoutAmount, accountInfo);
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Expense';
}

export function extractAmountAndCleanSegment(segment: SegmentText, accounts: UniversalAccountRef[]) {
  const lower = segment.toLowerCase();
  const accountInfo = resolveAccount(lower, accounts);
  const amount = parseSegmentAmount(segment, lower, accountInfo.matchedExplicitly);
  const cleanedTitle = cleanExpenseTitle(segment, amount, accountInfo);
  return { amount, accountInfo, cleanedTitle };
}
