import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { FinanceTransaction } from '@/lib/types';
import { resolveCurrentUserId, type FinanceStore } from '../helpers';
import {
  parseCsvLine,
  resolveColumnIndices,
  type CsvColumnIndices,
} from './csv-line-parser';
import { extractCsvRowPayload, type ParsedCsvRow } from './csv-row-mapper';

interface CsvImportDefaults {
  todayStr: string;
  fallbackAccountId: string;
  fallbackCategoryId: string;
}

function resolveCategoryId(
  state: FinanceStore,
  parsed: ParsedCsvRow,
  fallbackCategoryId: string
) {
  const ruleMatch = state.applyCategorizationRules(parsed.rawTitle);
  let categoryId = ruleMatch.categoryId;

  if (!categoryId && parsed.csvCat) {
    const target = parsed.csvCat.toLowerCase();
    const matchedCat = state.categories.find((c) => c.name.toLowerCase() === target);
    if (matchedCat) categoryId = matchedCat.id;
  }

  return { ruleMatch, categoryId: categoryId || fallbackCategoryId };
}

function isDuplicateTransaction(
  transactions: FinanceTransaction[],
  parsed: ParsedCsvRow
): boolean {
  const lowerTitle = parsed.rawTitle.toLowerCase();
  return transactions.some(
    (t) =>
      t.date === parsed.dateStr &&
      Math.abs(t.amount - parsed.parsedAmount) < 0.01 &&
      t.title.toLowerCase() === lowerTitle
  );
}

async function importSingleCsvRow(
  state: FinanceStore,
  cols: string[],
  indices: CsvColumnIndices,
  defaults: CsvImportDefaults
): Promise<boolean> {
  const parsed = extractCsvRowPayload(cols, indices, defaults.todayStr);
  if (!parsed) return false;
  if (isDuplicateTransaction(state.transactions, parsed)) return false;

  const { ruleMatch, categoryId } = resolveCategoryId(
    state,
    parsed,
    defaults.fallbackCategoryId
  );

  await state.addTransaction({
    title: ruleMatch.cleanMerchantName || parsed.rawTitle,
    rawMerchant: parsed.rawTitle,
    merchantName: ruleMatch.cleanMerchantName,
    amount: parsed.parsedAmount,
    type: parsed.txType,
    categoryId,
    accountId: defaults.fallbackAccountId,
    date: parsed.dateStr,
    needsReview: !ruleMatch.rule,
    tags: ruleMatch.tags || ['csv-import'],
  });
  return true;
}

function resolveImportDefaults(state: FinanceStore, defaultAccountId?: string): CsvImportDefaults | null {
  const fallbackAccount =
    (defaultAccountId && state.accounts.find((a) => a.id === defaultAccountId)) ||
    state.accounts.find((a) => a.isDefault) ||
    state.accounts[0];
  const fallbackCategory = state.categories[0];
  if (!fallbackAccount || !fallbackCategory) return null;

  return {
    todayStr: getLocalIsoDate(),
    fallbackAccountId: fallbackAccount.id,
    fallbackCategoryId: fallbackCategory.id,
  };
}

export async function importTransactionsCsvImpl(
  state: FinanceStore,
  csvText: string,
  defaultAccountId?: string
): Promise<{ importedCount: number; skippedCount: number }> {
  const userId = await resolveCurrentUserId(undefined, state.currentUserId);
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { importedCount: 0, skippedCount: 0 };

  const defaults = resolveImportDefaults(state, defaultAccountId);
  if (!defaults) return { importedCount: 0, skippedCount: lines.length - 1 };

  const indices = resolveColumnIndices(lines[0]);
  let importedCount = 0;
  let skippedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const imported = await importSingleCsvRow(state, parseCsvLine(lines[i]), indices, defaults);
    if (imported) importedCount++;
    else skippedCount++;
  }

  await state.loadFinanceData(userId);
  return { importedCount, skippedCount };
}
