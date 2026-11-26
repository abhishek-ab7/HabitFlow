import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinanceCategory, FinanceTransaction, FinanceTransactionType } from '@/lib/types';
import { useFitnessStore } from '@/lib/stores/fitness';
import { matchExpenseToSupplement } from '@/lib/fitness/supplement-meal-bridge';
import { findBestTransactionMealMatch } from '@/lib/fitness/meal-finance-matcher';
import { toast } from 'sonner';
import { readFileAsBase64, type ScannedDraftItem } from './tx-modal-types';

interface RawScannedItem {
  title?: string;
  merchantName?: string;
  amount: number;
  type?: 'expense' | 'income';
  categorySlug?: string;
  paymentMethodType?: string;
  date?: string;
  notes?: string;
  tags?: string[];
}

export interface NlpParsedExpense {
  amount?: number;
  type?: string;
  merchantName?: string;
  title?: string;
  date?: string;
  notes?: string;
  categorySlug?: string;
  paymentMethodType?: string;
  tags?: string[];
}

export async function requestNlpExpenseParse(params: {
  rawText: string;
  categories: FinanceCategory[];
}): Promise<{ parsed: NlpParsedExpense | null; source?: string; error?: string }> {
  const res = await fetch('/api/ai/parse-expense', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawText: params.rawText,
      categories: params.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, subcategories: c.subcategories })),
    }),
  });
  if (!res.ok) return { parsed: null, error: 'Could not parse that text. Try entering amount & item.' };
  const json = await res.json();
  return { parsed: json?.data ?? null, source: json?.source };
}

function mapScannedReceiptItem(params: {
  it: RawScannedItem;
  fileName?: string;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  todayStr: string;
  applyCategorizationRules: (title: string) => { categoryId?: string };
}): ScannedDraftItem {
  const { it, fileName, categories, accounts, todayStr, applyCategorizationRules } = params;
  const name = it.merchantName || it.title || 'Scanned Receipt';
  const ruleMatch = applyCategorizationRules(name);
  const catBySlug = categories.find((c) => c.slug === it.categorySlug);
  const accByMethod = accounts.find((a) => a.type === it.paymentMethodType);
  const defaultCatId = categories[0]?.id || '';
  const defaultAccId = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '';

  return {
    id: crypto.randomUUID(),
    selected: true,
    title: it.title || name,
    merchantName: name,
    amount: Number(it.amount),
    type: it.type === 'income' ? 'income' : 'expense',
    categoryId: ruleMatch.categoryId || catBySlug?.id || defaultCatId,
    accountId: accByMethod?.id || defaultAccId,
    date: it.date || todayStr,
    notes: it.notes,
    tags: Array.from(new Set(['receipt-scan', ...(it.tags || [])])),
    fileName,
  };
}

export async function scanReceiptImagesRequest(params: {
  fileList: File[];
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  todayStr: string;
  applyCategorizationRules: (title: string) => { categoryId?: string };
}): Promise<{ items: ScannedDraftItem[]; error?: string; info?: string }> {
  const { fileList, categories, accounts, todayStr, applyCategorizationRules } = params;
  const images = await Promise.all(fileList.map(readFileAsBase64));
  const res = await fetch('/api/ai/scan-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images,
      categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { items: [], error: err?.error || 'Could not scan receipt images' };
  }
  const json = await res.json();
  const rawItems: RawScannedItem[] = Array.isArray(json?.items) ? json.items : [];
  if (rawItems.length === 0) return { items: [], info: 'No readable expense totals found in the uploaded images' };

  const mapped = rawItems
    .filter((it) => Number(it.amount) > 0)
    .map((it, idx) =>
      mapScannedReceiptItem({ it, fileName: fileList[idx]?.name, categories, accounts, todayStr, applyCategorizationRules })
    );
  if (mapped.length === 0) return { items: [], info: 'No valid amounts extracted from images' };
  return { items: mapped };
}

async function syncSupplementCostOrPrompt(createdTx: FinanceTransaction) {
  const fitState = useFitnessStore.getState();
  const matchedSup = matchExpenseToSupplement(
    { title: createdTx.title, merchantName: createdTx.merchantName, notes: createdTx.notes },
    fitState.supplementInventory
  );
  if (!matchedSup) return { syncedName: null, promptSup: null };
  if (Number(matchedSup.costInr || 0) === 0) {
    await fitState.updateSupplement(matchedSup.id, { costInr: createdTx.amount, linkedTransactionId: createdTx.id });
    return { syncedName: matchedSup.name, promptSup: null };
  }
  return { syncedName: null, promptSup: matchedSup };
}

function showRestockSupplementToast(createdTx: FinanceTransaction, targetSup: NonNullable<ReturnType<typeof matchExpenseToSupplement>>) {
  toast.success(`Saved ${formatINR(createdTx.amount)} expense`, {
    description: `Update or restock ${targetSup.name}?`,
    action: {
      label: `Restock ${targetSup.name}`,
      onClick: () => {
        void useFitnessStore.getState().restockSupplement(targetSup.id, {
          servingsAdded: targetSup.totalServings,
          costInr: createdTx.amount,
          linkedTransactionId: createdTx.id,
          date: createdTx.date,
        });
        toast.success(`Restocked ${targetSup.name} with ${formatINR(createdTx.amount)} cost`);
      },
    },
  });
}

export async function runPostSaveFitnessSync(params: {
  createdTx: FinanceTransaction;
  type: FinanceTransactionType;
  bridgeKind: string;
  restockSupplementEnabled: boolean;
  alsoLogToDiet: boolean;
  categories: FinanceCategory[];
  isRecurringEnabled: boolean;
  linkedCommitmentId: string;
  bridgeResult: { dietLogged?: boolean; supplementRestocked?: string };
}) {
  const { createdTx, type, bridgeKind, restockSupplementEnabled, alsoLogToDiet, categories, isRecurringEnabled, linkedCommitmentId, bridgeResult } = params;

  const supSync =
    type === 'expense' && bridgeKind === 'health_supplements' && !restockSupplementEnabled
      ? await syncSupplementCostOrPrompt(createdTx)
      : { syncedName: null, promptSup: null };

  let linkedMealName: string | null = null;
  let linkedMealId: string | null = null;
  if (type === 'expense' && bridgeKind === 'food_dining' && !alsoLogToDiet) {
    const fitState = useFitnessStore.getState();
    const candidate = findBestTransactionMealMatch(createdTx, fitState.mealLogs, categories);
    if (candidate && candidate.confidence === 'high') {
      await fitState.linkMealToTransaction(candidate.meal.id, createdTx.id);
      linkedMealName = candidate.meal.name;
      linkedMealId = candidate.meal.id;
    }
  }

  if (isRecurringEnabled) return void toast.success('Saved entry & added recurring bill reminder');
  if (bridgeKind === 'junk') return void toast.success('Junk Food logged to Finance + Diet automatically');
  if (bridgeResult.dietLogged) return void toast.success('Saved expense & logged meal to Diet');
  if (bridgeResult.supplementRestocked) return void toast.success(`Saved expense & restocked ${bridgeResult.supplementRestocked}`);
  if (supSync.syncedName) return void toast.success(`Saved expense & updated ${supSync.syncedName} cost (${formatINR(createdTx.amount)}) for ROI`);
  if (supSync.promptSup) return void showRestockSupplementToast(createdTx, supSync.promptSup);
  if (linkedMealId && linkedMealName) {
    return void toast.success(`Saved expense & linked to "${linkedMealName}"`, {
      action: { label: 'Undo', onClick: () => void useFitnessStore.getState().linkMealToTransaction(linkedMealId!, null) },
    });
  }
  if (linkedCommitmentId !== 'none') return void toast.success('Saved and linked to commitment');

  const label = type === 'income' ? 'Income logged' : type === 'investment' ? 'Investment logged' : 'Expense saved';
  toast.success(label);
}
