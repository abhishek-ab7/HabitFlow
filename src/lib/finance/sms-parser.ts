import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceCategorizationRule,
  FinanceCategory,
  FinanceTransaction,
  FinanceTransactionType,
} from '@/lib/types';

export interface ParsedSmsExpense {
  id: string;
  rawText: string;
  title: string;
  rawMerchant?: string;
  amount: number;
  type: FinanceTransactionType;
  categoryId: string;
  categorySlug: string;
  accountId: string;
  paymentMethodType: FinanceAccountType;
  date: string; // YYYY-MM-DD
  referenceId?: string;
  tags?: string[];
  matchedRuleId?: string;
  matchedRulePattern?: string;
  isDuplicate: boolean;
  confidence: number;
  selected: boolean;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  sept: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Strips balance phrases ("Avl Bal Rs. 42,310.50") and reference/account numbers
 * before extracting the transaction amount so balances are never mistaken for spends.
 */
function extractTransactionAmount(text: string): number {
  const withoutBalances = text
    .replace(
      /(?:avl\.?\s*bal(?:ance)?|available\s*bal(?:ance)?|bal(?:ance)?\s*(?:is|:)?|closing\s*bal(?:ance)?|limit\s*(?:left|avl)?)\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?/gi,
      ' '
    )
    .replace(/(?:ref\s*(?:no|id|#)?|utr|txn\s*(?:id|no)?|rrn)\s*[:#-]?\s*[a-z0-9]{6,}/gi, ' ')
    .replace(/(?:a\/c|acct?|card|xx+)\s*(?:no\.?)?\s*[x*\d]{2,}/gi, ' ');

  // Prefer currency-prefixed amounts (₹1,249.00, Rs. 450, INR 850.00)
  const currencyRegex = /(?:₹|rs\.?|inr)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
  const currencyMatches = Array.from(withoutBalances.matchAll(currencyRegex));
  if (currencyMatches.length > 0) {
    const rawNum = currencyMatches[0][1].replace(/,/g, '');
    const parsed = Math.round(parseFloat(rawNum) * 100) / 100;
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Fallback: amount after verbs like "debited by 450.00", "paid 320", "spent 1200"
  const verbAmountRegex =
    /(?:debited\s*(?:by|for|with)?|credited\s*(?:by|with)?|spent|paid|sent|received)\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i;
  const verbMatch = withoutBalances.match(verbAmountRegex);
  if (verbMatch && verbMatch[1]) {
    const parsed = Math.round(parseFloat(verbMatch[1].replace(/,/g, '')) * 100) / 100;
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return 0;
}

function extractTransactionDate(text: string): string {
  // DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY or DD/MM/YY
  const dmyNumeric = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (dmyNumeric) {
    const day = dmyNumeric[1].padStart(2, '0');
    const month = dmyNumeric[2].padStart(2, '0');
    const rawYear = dmyNumeric[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // 18Nov26, 18-Nov-2026, 18 Nov 26
  const dmyText = text.match(/\b(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s,-]*(\d{2,4})\b/i);
  if (dmyText) {
    const day = dmyText[1].padStart(2, '0');
    const month = MONTH_MAP[dmyText[2].toLowerCase()] || '01';
    const rawYear = dmyText[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return getTodayDateString();
}

function extractReferenceId(text: string): string | undefined {
  const refMatch = text.match(
    /(?:ref\s*(?:no|id|#)?|utr|upi\s*ref|txn\s*(?:id|no)?|rrn)\s*[:#-]?\s*([a-z0-9]{6,22})/i
  );
  return refMatch?.[1];
}

function extractMerchantOrTitle(text: string, fallbackType: FinanceTransactionType): string {
  // Common Indian SMS/Notification merchant patterns
  const patterns = [
    /(?:trf\s+to|transferred\s+to|paid\s+to|sent\s+to)\s+([a-z0-9 &._'-]{2,40}?)(?=\s+(?:on|via|ref|utr|upi|from|a\/c|if\s+not|\d{2}[-/])|[.,;]|$)/i,
    /\bat\s+([a-z0-9 &._'-]{2,40}?)(?=\s+(?:on|via|ref|utr|for|avl|bal|\d{2}[-/])|[.,;]|$)/i,
    /\b(?:info|vpa|merchant)\s*[:/-]\s*([a-z0-9@ &._'-]{2,40}?)(?=[.,;\n]|$)/i,
    /\bfrom\s+([a-z0-9 &._'-]{2,40}?)(?=\s+(?:on|via|ref|utr|to\s+a\/c|\d{2}[-/])|[.,;]|$)/i,
    /\bfor\s+([a-z0-9 &._'-]{2,40}?)(?=\s+(?:on|via|ref|bbps|avl|\d{2}[-/])|[.,;]|$)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = match[1]
        .replace(/\b(upi|bbps|neft|imps|rtgs)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (candidate.length >= 2 && !/^(your|the|a\/c|account|card)$/i.test(candidate)) {
        return candidate
          .split(' ')
          .map((w) => (w === w.toUpperCase() && w.length > 3 ? w.charAt(0) + w.slice(1).toLowerCase() : w))
          .join(' ');
      }
    }
  }

  return fallbackType === 'income' ? 'Bank / UPI Credit' : 'SMS Expense';
}

function detectCategorySlug(text: string, type: FinanceTransactionType): string {
  const lower = text.toLowerCase();
  if (type === 'income') {
    return 'investments-savings';
  }
  if (/\b(zomato|swiggy|restaurant|cafe|coffee|starbucks|dominos|pizza|burger|kfc|mcdonald|biryani|food|dining|chai)\b/.test(lower)) {
    return 'food-dining';
  }
  if (/\b(blinkit|zepto|instamart|bigbasket|dmart|grocery|groceries|supermarket|vegetables|milk|dairy|mother dairy)\b/.test(lower)) {
    return 'groceries-household';
  }
  if (/\b(apollo|pharmeasy|1mg|netmeds|pharmacy|medicine|doctor|hospital|clinic|medical|health|whey|protein|vitamin)\b/.test(lower)) {
    return 'medical-supplements';
  }
  if (/\b(bescom|electricity|power|water|wifi|broadband|airtel|jio|vi|bsnl|recharge|bbps|gas|mahavitaran|tata power|bill)\b/.test(lower)) {
    return 'utilities-bills';
  }
  if (/\b(uber|ola|rapido|metro|irctc|makemytrip|indigo|fuel|petrol|diesel|hpcl|bpcl|iocl|indianoil|fastag|cab|auto)\b/.test(lower)) {
    return 'transport-fuel';
  }
  if (/\b(amazon|flipkart|myntra|ajio|nykaa|meesho|shopping|zara|h&m|decathlon|croma|reliance digital)\b/.test(lower)) {
    return 'shopping-personal-care';
  }
  if (/\b(netflix|spotify|hotstar|prime|sony|youtube|bookmyshow|pvr|inox|cinema|movie|gym|cult)\b/.test(lower)) {
    return 'entertainment-subscriptions';
  }
  if (/\b(emi|loan|bajaj|cred|credit card bill|repay|installment)\b/.test(lower)) {
    return 'emis-debt-repayment';
  }
  if (/\b(mother|mom|father|dad|parents|family|gift|ferns)\b/.test(lower)) {
    return 'family-commitments';
  }
  return 'shopping-personal-care';
}

function detectPaymentMethodType(text: string): FinanceAccountType {
  const lower = text.toLowerCase();
  if (
    /\bdebit\s*card\b/.test(lower)
  ) {
    return 'bank';
  }
  if (
    /\b(credit\s*card|card\s*(?:xx|\*\*|ending|no\.?|#)?\s*[x*\d]*\d{2,4}|(?:hdfc|icici|sbi|axis|kotak|yes|indusind)\s*(?:bank\s*)?card|amex)\b/.test(
      lower
    )
  ) {
    return 'credit_card';
  }
  if (/\b(upi|gpay|google\s*pay|phonepe|paytm|bhim|vpa)\b/.test(lower)) {
    return 'upi';
  }
  if (/\b(wallet|paytm\s*wallet|amazon\s*pay\s*balance)\b/.test(lower)) {
    return 'wallet';
  }
  if (/\b(neft|imps|rtgs|a\/c|acct|bank)\b/.test(lower)) {
    return 'bank';
  }
  if (/\bcash\b/.test(lower)) {
    return 'cash';
  }
  return 'upi';
}

function isLikelyOtpOrNonTransaction(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    /\b(otp|one\s*time\s*password|verification\s*code|do\s*not\s*share)\b/.test(lower) &&
    !/\b(debited|credited|spent|paid)\b/.test(lower)
  ) {
    return true;
  }
  if (/\b(failed|declined|unsuccessful|rejected|cancelled|reversed)\b/.test(lower)) {
    return true;
  }
  // Must have at least a transaction cue or currency marker
  const hasTransactionCue =
    /\b(debited|credited|spent|paid|sent|received|withdrawn|deducted|trf|purchase|upi|rs\.?|inr)\b/i.test(
      text
    ) || text.includes('₹');
  return !hasTransactionCue;
}

function matchCategorizationRule(
  rawText: string,
  extractedTitle: string,
  rules: FinanceCategorizationRule[]
): FinanceCategorizationRule | undefined {
  const haystack = `${rawText} ${extractedTitle}`.toLowerCase();
  return rules.find((rule) => {
    if (!rule.isActive || rule.deletedAt) return false;
    const pattern = rule.matchPattern.trim().toLowerCase();
    if (!pattern) return false;
    return haystack.includes(pattern);
  });
}

export function parseSingleSmsOrNotification(
  rawText: string,
  categories: FinanceCategory[],
  accounts: FinanceAccount[],
  existingTransactions: FinanceTransaction[] = [],
  rules: FinanceCategorizationRule[] = []
): ParsedSmsExpense | null {
  const text = rawText.trim();
  if (!text || isLikelyOtpOrNonTransaction(text)) {
    return null;
  }

  const amount = extractTransactionAmount(text);
  if (amount <= 0) {
    return null;
  }

  const lower = text.toLowerCase();
  const isCredit =
    /\b(credited|received|deposited|cashback|refund|salary)\b/.test(lower) &&
    !/\b(debited|spent|paid|sent|withdrawn|deducted)\b/.test(lower);

  const type: FinanceTransactionType = isCredit ? 'income' : 'expense';
  const date = extractTransactionDate(text);
  const referenceId = extractReferenceId(text);
  const extractedTitle = extractMerchantOrTitle(text, type);

  // Check active user categorization rules first before heuristic category detection
  const matchedRule = matchCategorizationRule(text, extractedTitle, rules);
  const title = matchedRule?.cleanMerchantName?.trim() || extractedTitle;

  const matchedSlug = detectCategorySlug(text, type);
  const category =
    (matchedRule ? categories.find((c) => c.id === matchedRule.categoryId) : undefined) ||
    categories.find((c) => c.slug === matchedSlug) ||
    categories.find((c) => c.type === type || c.type === 'both') ||
    categories[0];

  const paymentMethodType = detectPaymentMethodType(text);
  const account =
    accounts.find((a) => a.type === paymentMethodType) ||
    accounts.find((a) => a.isDefault) ||
    accounts[0];

  const isDuplicate = existingTransactions.some((existing) => {
    if (referenceId && existing.notes?.includes(referenceId)) return true;
    if (referenceId && existing.tags.includes(`ref:${referenceId}`)) return true;
    return (
      existing.date === date &&
      Math.abs(existing.amount - amount) < 0.01 &&
      existing.type === type &&
      existing.title.toLowerCase() === title.toLowerCase()
    );
  });

  const confidence = matchedRule ? 98 : referenceId ? 95 : title !== 'SMS Expense' ? 88 : 74;

  return {
    id: crypto.randomUUID(),
    rawText: text,
    title,
    rawMerchant: extractedTitle,
    amount,
    type,
    categoryId: category?.id || '',
    categorySlug: category?.slug || matchedSlug,
    accountId: account?.id || '',
    paymentMethodType,
    date,
    referenceId,
    tags: matchedRule?.defaultTags ? [...matchedRule.defaultTags] : undefined,
    matchedRuleId: matchedRule?.id,
    matchedRulePattern: matchedRule?.matchPattern,
    isDuplicate,
    confidence,
    selected: !isDuplicate,
  };
}

/**
 * Splits pasted text or uploaded SMS/Notification export files (.txt / .csv / .json)
 * into individual messages and returns parsed expense/income candidates.
 */
export function parseSmsOrNotificationBatch(
  rawInput: string,
  categories: FinanceCategory[],
  accounts: FinanceAccount[],
  existingTransactions: FinanceTransaction[] = [],
  rules: FinanceCategorizationRule[] = []
): ParsedSmsExpense[] {
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  let messages: string[] = [];

  // 1. Handle JSON export arrays (e.g. Android Notification History / SMS backup JSON)
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsedJson = JSON.parse(trimmed);
      const items = Array.isArray(parsedJson)
        ? parsedJson
        : Array.isArray(parsedJson.messages)
        ? parsedJson.messages
        : Array.isArray(parsedJson.notifications)
        ? parsedJson.notifications
        : [parsedJson];

      messages = items
        .map((item: unknown) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const rec = item as Record<string, unknown>;
            const body = rec.body || rec.text || rec.message || rec.content || rec.notification || '';
            const title = rec.title || rec.sender || '';
            return [title, body].filter(Boolean).join(' - ');
          }
          return '';
        })
        .filter((s: string) => s.trim().length > 0);
    } catch {
      // Fallback to line splitting
    }
  }

  // 2. Otherwise split by blank lines or newline-separated messages
  if (messages.length === 0) {
    const blocks = trimmed
      .split(/\n\s*\n+/)
      .map((b) => b.trim())
      .filter(Boolean);

    if (blocks.length === 1 && blocks[0].includes('\n')) {
      // Check if multiple lines are separate short SMS/notifications
      const lines = blocks[0]
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const linesWithAmounts = lines.filter((l) => extractTransactionAmount(l) > 0);
      messages = linesWithAmounts.length >= 2 ? lines : blocks;
    } else {
      messages = blocks;
    }
  }

  const results: ParsedSmsExpense[] = [];
  for (const msg of messages) {
    const parsed = parseSingleSmsOrNotification(
      msg,
      categories,
      accounts,
      existingTransactions,
      rules
    );
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}
