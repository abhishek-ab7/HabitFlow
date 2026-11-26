import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceCategorizationRule,
  FinanceCategory,
  FinanceTransaction,
  FinanceTransactionType,
} from '@/lib/types';
import {
  detectCategorySlug,
  detectPaymentMethodType,
  extractMerchantOrTitle,
  extractReferenceId,
  extractTransactionAmount,
  extractTransactionDate,
  isLikelyOtpOrNonTransaction,
  matchCategorizationRule,
} from './sms-extractors';

type SmsInput = string;
type IsoDateStr = string;
type TxTitle = string;

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
  date: string;
  referenceId?: string;
  tags?: string[];
  matchedRuleId?: string;
  matchedRulePattern?: string;
  isDuplicate: boolean;
  confidence: number;
  selected: boolean;
}

function resolveCategoryForSms(
  categories: FinanceCategory[],
  matchedRule: FinanceCategorizationRule | undefined,
  matchedSlug: string,
  type: FinanceTransactionType
): FinanceCategory | undefined {
  if (matchedRule) {
    const byRule = categories.find((c) => c.id === matchedRule.categoryId);
    if (byRule) return byRule;
  }
  return (
    categories.find((c) => c.slug === matchedSlug) ??
    categories.find((c) => c.type === type || c.type === 'both') ??
    categories[0]
  );
}

function matchesExistingTxFields(params: {
  existing: FinanceTransaction;
  date: IsoDateStr;
  amount: number;
  type: FinanceTransactionType;
  lowerTitle: string;
}): boolean {
  const { existing, date, amount, type, lowerTitle } = params;
  if (existing.date !== date || existing.type !== type) return false;
  if (Math.abs(existing.amount - amount) >= 0.01) return false;
  return (existing.title ?? '').toLowerCase() === lowerTitle;
}

function isDuplicateSmsTransaction(params: {
  existingTransactions: FinanceTransaction[];
  referenceId?: string;
  date: IsoDateStr;
  amount: number;
  type: FinanceTransactionType;
  title: TxTitle;
}): boolean {
  const { existingTransactions, referenceId, date, amount, type, title } = params;
  const lowerTitle = title.toLowerCase();
  return existingTransactions.some((existing) => {
    const existingTags = Array.isArray(existing.tags) ? existing.tags : [];
    const refMatched = Boolean(
      referenceId && (existing.notes?.includes(referenceId) || existingTags.includes(`ref:${referenceId}`))
    );
    return refMatched || matchesExistingTxFields({ existing, date, amount, type, lowerTitle });
  });
}

function computeSmsConfidence(
  matchedRule: FinanceCategorizationRule | undefined,
  referenceId: string | undefined,
  title: TxTitle
): number {
  if (matchedRule) return 98;
  if (referenceId) return 95;
  return title !== 'SMS Expense' ? 88 : 74;
}

function detectSmsTxType(text: SmsInput): FinanceTransactionType {
  const lower = text.toLowerCase();
  const isCredit =
    /\b(credited|received|deposited|cashback|refund|salary)\b/.test(lower) &&
    !/\b(debited|spent|paid|sent|withdrawn|deducted)\b/.test(lower);
  return isCredit ? 'income' : 'expense';
}

function resolveAccountForSms(accounts: FinanceAccount[], paymentMethodType: FinanceAccountType): FinanceAccount | undefined {
  return accounts.find((a) => a.type === paymentMethodType) ?? accounts.find((a) => a.isDefault) ?? accounts[0];
}

function assembleSmsExpense(params: {
  text: SmsInput;
  title: TxTitle;
  extractedTitle: TxTitle;
  amount: number;
  type: FinanceTransactionType;
  category?: FinanceCategory;
  matchedSlug: string;
  account?: FinanceAccount;
  paymentMethodType: FinanceAccountType;
  date: IsoDateStr;
  referenceId?: string;
  matchedRule?: FinanceCategorizationRule;
  isDuplicate: boolean;
}): ParsedSmsExpense {
  const { text, title, extractedTitle, amount, type, category, matchedSlug, account, paymentMethodType, date, referenceId, matchedRule, isDuplicate } = params;
  return {
    id: crypto.randomUUID(),
    rawText: text,
    title,
    rawMerchant: extractedTitle,
    amount,
    type,
    categoryId: category?.id ?? '',
    categorySlug: category?.slug ?? matchedSlug,
    accountId: account?.id ?? '',
    paymentMethodType,
    date,
    referenceId,
    tags: matchedRule?.defaultTags ? [...matchedRule.defaultTags] : undefined,
    matchedRuleId: matchedRule?.id,
    matchedRulePattern: matchedRule?.matchPattern,
    isDuplicate,
    confidence: computeSmsConfidence(matchedRule, referenceId, title),
    selected: !isDuplicate,
  };
}

function buildParsedSmsCandidate(params: {
  text: SmsInput;
  amount: number;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  existingTransactions: FinanceTransaction[];
  rules: FinanceCategorizationRule[];
}): ParsedSmsExpense {
  const { text, amount, categories, accounts, existingTransactions, rules } = params;
  const type = detectSmsTxType(text);
  const date = extractTransactionDate(text);
  const referenceId = extractReferenceId(text);
  const extractedTitle = extractMerchantOrTitle(text, type);
  const matchedRule = matchCategorizationRule(text, extractedTitle, rules);
  const title = matchedRule?.cleanMerchantName?.trim() || extractedTitle;

  const matchedSlug = detectCategorySlug(text, type);
  const category = resolveCategoryForSms(categories, matchedRule, matchedSlug, type);
  const paymentMethodType = detectPaymentMethodType(text);
  const account = resolveAccountForSms(accounts, paymentMethodType);
  const isDuplicate = isDuplicateSmsTransaction({ existingTransactions, referenceId, date, amount, type, title });

  return assembleSmsExpense({
    text, title, extractedTitle, amount, type, category, matchedSlug, account,
    paymentMethodType, date, referenceId, matchedRule, isDuplicate,
  });
}

export function parseSingleSmsOrNotification(
  rawText: SmsInput,
  categories: FinanceCategory[],
  accounts: FinanceAccount[],
  ...[existingTransactions = [], rules = []]: [
    existingTransactions?: FinanceTransaction[],
    rules?: FinanceCategorizationRule[],
  ]
): ParsedSmsExpense | null {
  const text = rawText.trim();
  if (!text || isLikelyOtpOrNonTransaction(text)) return null;

  const amount = extractTransactionAmount(text);
  if (amount <= 0) return null;

  return buildParsedSmsCandidate({ text, amount, categories, accounts, existingTransactions, rules });
}

function extractJsonMessageText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  const rec = item as Record<string, unknown>;
  const body = rec.body ?? rec.text ?? rec.message ?? rec.content ?? rec.notification ?? '';
  const title = rec.title ?? rec.sender ?? '';
  return [title, body].filter(Boolean).join(' - ');
}

function hasJsonEnvelope(trimmed: SmsInput): boolean {
  return trimmed.startsWith('[') || trimmed.startsWith('{');
}

function tryExtractJsonMessages(trimmed: SmsInput): string[] {
  if (!hasJsonEnvelope(trimmed)) return [];
  try {
    const parsedJson = JSON.parse(trimmed);
    const items: unknown[] = Array.isArray(parsedJson)
      ? parsedJson
      : parsedJson.messages ?? parsedJson.notifications ?? [parsedJson];
    return items.map(extractJsonMessageText).filter((s) => s.trim().length > 0);
  } catch {
    return [];
  }
}

function splitPlainTextMessages(trimmed: SmsInput): string[] {
  const blocks = trimmed.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 1 && blocks[0].includes('\n')) {
    const lines = blocks[0].split('\n').map((l) => l.trim()).filter(Boolean);
    const linesWithAmounts = lines.filter((l) => extractTransactionAmount(l) > 0);
    return linesWithAmounts.length >= 2 ? lines : blocks;
  }
  return blocks;
}

export function parseSmsOrNotificationBatch(
  rawInput: SmsInput,
  categories: FinanceCategory[],
  accounts: FinanceAccount[],
  ...[existingTransactions = [], rules = []]: [
    existingTransactions?: FinanceTransaction[],
    rules?: FinanceCategorizationRule[],
  ]
): ParsedSmsExpense[] {
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  const jsonMessages = tryExtractJsonMessages(trimmed);
  const messages = jsonMessages.length > 0 ? jsonMessages : splitPlainTextMessages(trimmed);

  const results: ParsedSmsExpense[] = [];
  for (const msg of messages) {
    const parsed = parseSingleSmsOrNotification(msg, categories, accounts, existingTransactions, rules);
    if (parsed) results.push(parsed);
  }
  return results;
}
