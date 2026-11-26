import type {
  FinanceAccountType,
  FinanceCategorizationRule,
  FinanceTransactionType,
} from '@/lib/types';

type SmsText = string;
type LowerSmsText = string;

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
};

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseMatchedAmount(rawNum: SmsText | undefined): number {
  if (!rawNum) return 0;
  const parsed = Math.round(parseFloat(rawNum.replace(/,/g, '')) * 100) / 100;
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : 0;
}

export function extractTransactionAmount(text: SmsText): number {
  const withoutBalances = text
    .replace(
      /(?:avl\.?\s*bal(?:ance)?|available\s*bal(?:ance)?|bal(?:ance)?\s*(?:is|:)?|closing\s*bal(?:ance)?|limit\s*(?:left|avl)?)\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?/gi,
      ' '
    )
    .replace(/(?:ref\s*(?:no|id|#)?|utr|txn\s*(?:id|no)?|rrn)\s*[:#-]?\s*[a-z0-9]{6,}/gi, ' ')
    .replace(/(?:a\/c|acct?|card|xx+)\s*(?:no\.?)?\s*[x*\d]{2,}/gi, ' ');

  const currencyRegex = /(?:₹|rs\.?|inr)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
  const currencyMatches = Array.from(withoutBalances.matchAll(currencyRegex));
  if (currencyMatches.length > 0) {
    const amt = parseMatchedAmount(currencyMatches[0][1]);
    if (amt > 0) return amt;
  }

  const verbAmountRegex =
    /(?:debited\s*(?:by|for|with)?|credited\s*(?:by|with)?|spent|paid|sent|received)\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i;
  const verbMatch = withoutBalances.match(verbAmountRegex);
  return parseMatchedAmount(verbMatch?.[1]);
}

function isValidMonthDay(monthNum: number, dayNum: number): boolean {
  return monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31;
}

function normalizeYear(rawYear: SmsText): string {
  return rawYear.length === 2 ? `20${rawYear}` : rawYear;
}

export function extractTransactionDate(text: SmsText): string {
  const dmyNumeric = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (dmyNumeric) {
    const day = dmyNumeric[1].padStart(2, '0');
    const month = dmyNumeric[2].padStart(2, '0');
    if (isValidMonthDay(parseInt(month, 10), parseInt(day, 10))) {
      return `${normalizeYear(dmyNumeric[3])}-${month}-${day}`;
    }
  }

  const dmyText = text.match(/\b(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s,-]*(\d{2,4})\b/i);
  if (dmyText) {
    const day = dmyText[1].padStart(2, '0');
    const month = MONTH_MAP[dmyText[2].toLowerCase()] ?? '01';
    return `${normalizeYear(dmyText[3])}-${month}-${day}`;
  }

  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  return getTodayDateString();
}

export function extractReferenceId(text: SmsText): string | undefined {
  const refMatch = text.match(/(?:ref\s*(?:no|id|#)?|utr|upi\s*ref|txn\s*(?:id|no)?|rrn)\s*[:#-]?\s*([a-z0-9]{6,22})/i);
  return refMatch?.[1];
}

const MERCHANT_PATTERNS: RegExp[] = [
  /(?:trf\s+to|transferred\s+to|paid\s+to|sent\s+to)\s+([a-z0-9 &._'-]{2,40}?)(?=\s+(?:on|via|ref|utr|upi|from|a\/c|if\s+not|\d{2}[-/])|[.,;]|$)/i,
  /(?:paid|spent|sent|debited)\s+(?:by\s+|of\s+)?(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?\s+to\s+([a-z0-9 &._'-]{2,40}?)(?=\s+(?:on|via|ref|utr|upi|from|a\/c|if\s+not|\d{2}[-/])|[.,;]|$)/i,
  /\bat\s+([a-z0-9 &._'-]{2,40}?)(?=\s+(?:on|via|ref|utr|for|avl|bal|\d{2}[-/])|[.,;]|$)/i,
  /\b(?:info|vpa|merchant)\s*[:/-]\s*([a-z0-9@ &._'-]{2,40}?)(?=[.,;\n]|$)/i,
  /\bfrom\s+([a-z0-9 &._'-]{2,40}?)(?=\s+(?:on|via|ref|utr|to\s+a\/c|\d{2}[-/])|[.,;]|$)/i,
  /\bfor\s+([a-z0-9 &._'-]{2,40}?)(?=\s+(?:on|via|ref|bbps|avl|\d{2}[-/])|[.,;]|$)/i,
];

function formatTitleCasing(candidate: SmsText): string {
  return candidate
    .split(' ')
    .map((w) => (w === w.toUpperCase() && w.length > 3 ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(' ');
}

export function extractMerchantOrTitle(text: SmsText, fallbackType: FinanceTransactionType): string {
  for (const regex of MERCHANT_PATTERNS) {
    const match = text.match(regex);
    if (!match?.[1]) continue;
    const candidate = match[1].replace(/\b(upi|bbps|neft|imps|rtgs)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (candidate.length >= 2 && !/^(your|the|a\/c|account|card)$/i.test(candidate)) {
      return formatTitleCasing(candidate);
    }
  }
  return fallbackType === 'income' ? 'Bank / UPI Credit' : 'SMS Expense';
}

const CATEGORY_SLUG_RULES: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /\b(momos?|samosa|pakora|chaat|pani\s*puri|golgappa|jalebi|fries|chips|kurkure|lays|ice\s*cream|baskin|pastry|brownie|waffle|donut|burger|pizza|dominos|kfc|mcdonald|cold\s*drink|coke|pepsi|junk\s*food)\b/, slug: 'junk-food' },
  { pattern: /\b(zomato|swiggy|restaurant|cafe|coffee|starbucks|biryani|food|dining|chai)\b/, slug: 'food-dining' },
  { pattern: /\b(blinkit|zepto|instamart|bigbasket|dmart|grocery|groceries|supermarket|vegetables|milk|dairy|mother dairy)\b/, slug: 'groceries-household' },
  { pattern: /\b(apollo|pharmeasy|1mg|netmeds|pharmacy|medicine|doctor|hospital|clinic|medical|health|whey|protein|vitamin)\b/, slug: 'medical-supplements' },
  { pattern: /\b(bescom|electricity|power|water|wifi|broadband|airtel|jio|vi|bsnl|recharge|bbps|gas|mahavitaran|tata power|bill)\b/, slug: 'utilities-bills' },
  { pattern: /\b(uber|ola|rapido|metro|irctc|makemytrip|indigo|fuel|petrol|diesel|hpcl|bpcl|iocl|indianoil|fastag|cab|auto)\b/, slug: 'transport-fuel' },
  { pattern: /\b(amazon|flipkart|myntra|ajio|nykaa|meesho|shopping|zara|h&m|decathlon|croma|reliance digital)\b/, slug: 'shopping-personal-care' },
  { pattern: /\b(netflix|spotify|hotstar|prime|sony|youtube|bookmyshow|pvr|inox|cinema|movie|gym|cult)\b/, slug: 'entertainment-subscriptions' },
  { pattern: /\b(emi|loan|bajaj|cred|credit card bill|repay|installment)\b/, slug: 'emis-debt-repayment' },
  { pattern: /\b(mother|mom|father|dad|parents|family|gift|ferns)\b/, slug: 'family-commitments' },
];

export function detectCategorySlug(text: SmsText, type: FinanceTransactionType): string {
  if (type === 'income') return 'investments-savings';
  const lower = text.toLowerCase();
  const matched = CATEGORY_SLUG_RULES.find((r) => r.pattern.test(lower));
  return matched ? matched.slug : 'shopping-personal-care';
}

const PAYMENT_METHOD_RULES: Array<{ pattern: RegExp; method: FinanceAccountType }> = [
  { pattern: /\bdebit\s*card\b/, method: 'bank' },
  { pattern: /\b(credit\s*card|card\s*(?:xx|\*\*|ending|no\.?|#)?\s*[x*\d]*\d{2,4}|(?:hdfc|icici|sbi|axis|kotak|yes|indusind)\s*(?:bank\s*)?card|amex)\b/, method: 'credit_card' },
  { pattern: /\b(upi|gpay|google\s*pay|phonepe|paytm|bhim|vpa)\b/, method: 'upi' },
  { pattern: /\b(wallet|paytm\s*wallet|amazon\s*pay\s*balance)\b/, method: 'wallet' },
  { pattern: /\b(neft|imps|rtgs|a\/c|acct|bank)\b/, method: 'bank' },
  { pattern: /\bcash\b/, method: 'cash' },
];

export function detectPaymentMethodType(text: SmsText): FinanceAccountType {
  const lower: LowerSmsText = text.toLowerCase();
  const matched = PAYMENT_METHOD_RULES.find((r) => r.pattern.test(lower));
  return matched ? matched.method : 'upi';
}

export function isLikelyOtpOrNonTransaction(text: SmsText): boolean {
  const lower = text.toLowerCase();
  const isOtpNotice = /\b(otp|one\s*time\s*password|verification\s*code|do\s*not\s*share)\b/.test(lower);
  if (isOtpNotice && !/\b(debited|credited|spent|paid)\b/.test(lower)) return true;
  if (/\b(failed|declined|unsuccessful|rejected|cancelled|reversed)\b/.test(lower)) return true;
  const hasCue =
    /\b(debited|credited|spent|paid|sent|received|withdrawn|deducted|trf|purchase|upi|rs\.?|inr)\b/i.test(text) ||
    text.includes('₹');
  return !hasCue;
}

export function matchCategorizationRule(
  rawText: SmsText,
  extractedTitle: SmsText,
  rules: FinanceCategorizationRule[]
): FinanceCategorizationRule | undefined {
  const haystack = `${rawText} ${extractedTitle}`.toLowerCase();
  return rules.find((rule) => {
    if (!rule.isActive || rule.deletedAt) return false;
    const pattern = rule.matchPattern.trim().toLowerCase();
    return Boolean(pattern) && haystack.includes(pattern);
  });
}
