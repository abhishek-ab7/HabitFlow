import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import {
  classifyCategoryBridgeKind,
  findMatchingSupplementId,
} from '@/lib/fitness/finance-bridge';
import type { ParsedSmsExpense } from '@/lib/finance/sms-parser';
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  SupplementInventory,
} from '@/lib/types';

export interface BridgeSelection {
  alsoLogToDiet?: boolean;
  restockSupplement?: boolean;
  supplementId?: string;
  restockServings?: number;
}

export function resolveAiCategoryAndAccount(
  aiData: any,
  categories: FinanceCategory[],
  accounts: FinanceAccount[]
) {
  const cat = categories.find((c) => c.slug === aiData.categorySlug) ?? categories[0];
  const acc =
    accounts.find((a) => a.type === aiData.paymentMethodType) ??
    accounts.find((a) => a.isDefault) ??
    accounts[0];
  return {
    categoryId: cat?.id ?? '',
    categorySlug: cat?.slug ?? 'shopping-personal-care',
    accountId: acc?.id ?? '',
  };
}

function resolveAiDisplayTitle(aiData: any): string {
  return aiData.merchantName ?? aiData.title ?? 'Parsed Expense';
}

export function mapAiExpenseToParsedSms(
  trimmed: string,
  aiData: any,
  categories: FinanceCategory[],
  accounts: FinanceAccount[]
): ParsedSmsExpense {
  const resolved = resolveAiCategoryAndAccount(aiData, categories, accounts);
  const title = resolveAiDisplayTitle(aiData);
  return {
    id: crypto.randomUUID(),
    rawText: trimmed,
    rawMerchant: title,
    title,
    amount: aiData.amount,
    type: aiData.type === 'income' ? 'income' : 'expense',
    ...resolved,
    paymentMethodType: aiData.paymentMethodType ?? 'upi',
    date: aiData.date ?? getLocalIsoDate(),
    isDuplicate: false,
    confidence: aiData.confidence ?? 80,
    selected: true,
    tags: Array.isArray(aiData.tags) ? aiData.tags : undefined,
  };
}

function buildBridgeToastSuffix(dietBridged: number, suppRestocked: number): string {
  const parts = [
    dietBridged > 0 ? `${dietBridged} meal logged` : '',
    suppRestocked > 0 ? `${suppRestocked} restocked` : '',
  ].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

export function formatImportToastMessage(params: {
  selectedCount: number;
  reviewQueued: number;
  dietBridged: number;
  suppRestocked: number;
}): string {
  const { selectedCount, reviewQueued, dietBridged, suppRestocked } = params;
  const bridgeSummary = buildBridgeToastSuffix(dietBridged, suppRestocked);
  if (reviewQueued > 0) {
    return `Imported ${selectedCount} entries (${reviewQueued} queued for Needs Review)${bridgeSummary}`;
  }
  const noun = selectedCount === 1 ? 'transaction' : 'transactions';
  return `Imported ${selectedCount} verified ${noun}${bridgeSummary}`;
}

export function buildSmsImportTags(item: ParsedSmsExpense): string[] {
  const refTags = item.referenceId ? [`ref:${item.referenceId}`] : [];
  return Array.from(new Set(['sms-import', ...(item.tags ?? []), ...refTags]));
}

export function resolveSmsBridgeCategory(
  categories: FinanceCategory[],
  item: ParsedSmsExpense,
  fallbackCat: string
) {
  const direct = categories.find((c) => c.id === (item.categoryId || fallbackCat));
  if (direct) return direct;
  return item.categorySlug ? { slug: item.categorySlug, name: item.categorySlug } : null;
}

export function buildSmsBridgeArgs(params: {
  bridgeKind: Exclude<ReturnType<typeof classifyCategoryBridgeKind>, 'none'>;
  item: ParsedSmsExpense;
  createdTx: FinanceTransaction;
  itemBridge?: BridgeSelection;
  supplementInventory: SupplementInventory[];
}) {
  const { bridgeKind, item, createdTx, itemBridge, supplementInventory } = params;
  return {
    bridgeKind,
    transaction: createdTx,
    alsoLogToDiet: itemBridge?.alsoLogToDiet,
    restockSupplement: itemBridge?.restockSupplement,
    supplementId: itemBridge?.supplementId || findMatchingSupplementId(item.title, supplementInventory),
    restockServings: itemBridge?.restockServings || 30,
    newSupplementName: item.title.trim() || undefined,
  };
}

export function buildSmsTransactionPayload(params: {
  item: ParsedSmsExpense;
  fallbackCat: string;
  fallbackAcc: string;
  reviewed: boolean;
}) {
  const { item, fallbackCat, fallbackAcc, reviewed } = params;
  const trimmedTitle = item.title.trim();
  return {
    title: trimmedTitle || 'SMS Expense',
    merchantName: trimmedTitle || undefined,
    rawMerchant: item.rawMerchant || undefined,
    amount: Number(item.amount),
    type: item.type,
    categoryId: item.categoryId || fallbackCat,
    accountId: item.accountId || fallbackAcc,
    date: item.date,
    needsReview: reviewed,
    notes: `Imported from SMS/Notification: ${item.rawText.slice(0, 160)}`,
    tags: buildSmsImportTags(item),
  };
}

export function buildCategorySelectionPatch(params: {
  categoryId: string;
  editingCategoryItemId: string;
  parsedItems: ParsedSmsExpense[];
  categories: FinanceCategory[];
}) {
  const { categoryId, editingCategoryItemId, parsedItems, categories } = params;
  const targetItem = parsedItems.find((i) => i.id === editingCategoryItemId);
  const cat = categories.find((c) => c.id === categoryId);
  return { categoryId, categorySlug: cat?.slug || targetItem?.categorySlug || '' };
}
