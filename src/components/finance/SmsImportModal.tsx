'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import {
  classifyCategoryBridgeKind,
  estimateDietBridgePreview,
  executeFinanceFitnessBridge,
  findMatchingSupplementId,
} from '@/lib/fitness/finance-bridge';
import {
  parseSmsOrNotificationBatch,
  type ParsedSmsExpense,
} from '@/lib/finance/sms-parser';
import {
  MessageSquareText,
  ClipboardPaste,
  Upload,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Sparkles,
  AlertTriangle,
  Utensils,
  Pill,
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { toast } from 'sonner';

interface SmsImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText?: string | null;
}

interface BridgeSelection {
  alsoLogToDiet?: boolean;
  restockSupplement?: boolean;
  supplementId?: string;
  restockServings?: number;
}

function resolveAiCategoryAndAccount(
  aiData: any,
  categories: ReturnType<typeof useFinanceStore.getState>['categories'],
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts']
) {
  const cat = categories.find((c) => c.slug === aiData.categorySlug) || categories[0];
  const acc =
    accounts.find((a) => a.type === aiData.paymentMethodType) ||
    accounts.find((a) => a.isDefault) ||
    accounts[0];
  return {
    categoryId: cat?.id || '',
    categorySlug: cat?.slug || 'shopping-personal-care',
    accountId: acc?.id || '',
  };
}

function mapAiExpenseToParsedSms(
  trimmed: string,
  aiData: any,
  categories: ReturnType<typeof useFinanceStore.getState>['categories'],
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts']
): ParsedSmsExpense {
  const resolved = resolveAiCategoryAndAccount(aiData, categories, accounts);
  return {
    id: crypto.randomUUID(),
    rawText: trimmed,
    rawMerchant: aiData.merchantName || aiData.title,
    title: aiData.merchantName || aiData.title || 'Parsed Expense',
    amount: aiData.amount,
    type: aiData.type === 'income' ? 'income' : 'expense',
    ...resolved,
    paymentMethodType: aiData.paymentMethodType || 'upi',
    date: aiData.date || getLocalIsoDate(),
    isDuplicate: false,
    confidence: aiData.confidence || 80,
    selected: true,
    tags: Array.isArray(aiData.tags) ? aiData.tags : undefined,
  };
}

async function fetchAiParsedExpense(
  trimmed: string,
  categories: ReturnType<typeof useFinanceStore.getState>['categories'],
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts']
): Promise<ParsedSmsExpense[]> {
  try {
    const res = await fetch('/api/ai/parse-expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawText: trimmed,
        categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, subcategories: c.subcategories })),
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const aiData = json?.data;
    if (!aiData || aiData.amount <= 0) return [];
    return [mapAiExpenseToParsedSms(trimmed, aiData, categories, accounts)];
  } catch {
    return [];
  }
}

function formatImportToastMessage(selectedCount: number, reviewQueued: number, dietBridged: number, suppRestocked: number): string {
  const parts = [dietBridged > 0 ? `${dietBridged} meal logged` : '', suppRestocked > 0 ? `${suppRestocked} restocked` : ''].filter(Boolean);
  const bridgeSummary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  if (reviewQueued > 0) {
    return `Imported ${selectedCount} entries (${reviewQueued} queued for Needs Review)${bridgeSummary}`;
  }
  const noun = selectedCount === 1 ? 'transaction' : 'transactions';
  return `Imported ${selectedCount} verified ${noun}${bridgeSummary}`;
}

function HealthSupplementBridge(props: {
  itemTitle: string;
  itemBridge: BridgeSelection;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
  onPatchBridge: (patch: Partial<BridgeSelection>) => void;
}) {
  const { itemTitle, itemBridge, supplementInventory, onPatchBridge } = props;
  const activeSupps = supplementInventory.filter((s) => !s.deletedAt && s.isActive);
  const matchedSuppId = itemBridge.supplementId || findMatchingSupplementId(itemTitle, supplementInventory);

  return (
    <>
      <button
        type="button"
        onClick={() =>
          onPatchBridge({
            restockSupplement: !itemBridge.restockSupplement,
            supplementId: matchedSuppId,
            restockServings: itemBridge.restockServings || 30,
          })
        }
        aria-pressed={Boolean(itemBridge.restockSupplement)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
          itemBridge.restockSupplement ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300' : 'bg-background border-border text-muted-foreground hover:text-foreground'
        }`}
      >
        <Pill className="w-3 h-3" />
        Restock Supplement
      </button>
      {itemBridge.restockSupplement && (
        <div className="flex items-center gap-1.5">
          <select
            value={matchedSuppId}
            onChange={(e) => onPatchBridge({ supplementId: e.target.value })}
            aria-label="Restock target supplement"
            className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px]"
          >
            {activeSupps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="__new__">+ New ({itemTitle.trim() || 'Supplement'})</option>
          </select>
          <Input
            type="number"
            min="1"
            value={itemBridge.restockServings || 30}
            onChange={(e) => onPatchBridge({ restockServings: Math.max(1, Number(e.target.value) || 30) })}
            aria-label="Restock servings"
            className="h-7 w-16 text-[11px]"
          />
        </div>
      )}
    </>
  );
}

function FoodDietOptInButton({
  calories,
  alsoLogToDiet,
  onToggle,
}: {
  calories: number;
  alsoLogToDiet?: boolean;
  onToggle: () => void;
}) {
  const activeCls = alsoLogToDiet
    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
    : 'bg-background border-border text-muted-foreground hover:text-foreground';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={Boolean(alsoLogToDiet)}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${activeCls}`}
    >
      <Utensils className="w-3 h-3" />
      Also log ~{calories} kcal to Diet
    </button>
  );
}

function SmsBridgeControls(props: {
  item: ParsedSmsExpense;
  bridgeKind: ReturnType<typeof classifyCategoryBridgeKind>;
  itemBridge: BridgeSelection;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
  onPatchBridge: (patch: Partial<BridgeSelection>) => void;
}) {
  const { item, bridgeKind, itemBridge, supplementInventory, onPatchBridge } = props;
  if (bridgeKind === 'none') return null;

  const dietPreview = estimateDietBridgePreview(item.title, item.amount, bridgeKind === 'junk');

  return (
    <div className="pl-7 flex flex-wrap items-center gap-2">
      {bridgeKind === 'junk' && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-medium text-amber-600 dark:text-amber-300">
          <Utensils className="w-3 h-3" />
          Auto-logs ~{dietPreview.calories} kcal to Diet
        </span>
      )}
      {bridgeKind === 'food_dining' && (
        <FoodDietOptInButton
          calories={dietPreview.calories}
          alsoLogToDiet={itemBridge.alsoLogToDiet}
          onToggle={() => onPatchBridge({ alsoLogToDiet: !itemBridge.alsoLogToDiet })}
        />
      )}
      {bridgeKind === 'health_supplements' && (
        <HealthSupplementBridge
          itemTitle={item.title}
          itemBridge={itemBridge}
          supplementInventory={supplementInventory}
          onPatchBridge={onPatchBridge}
        />
      )}
    </div>
  );
}

function SmsItemTopRow({ item, onUpdateItem }: { item: ParsedSmsExpense; onUpdateItem: (patch: Partial<ParsedSmsExpense>) => void }) {
  return (
    <div className="flex items-start gap-2.5">
      <button
        type="button"
        onClick={() => onUpdateItem({ selected: !item.selected })}
        aria-label={item.selected ? 'Deselect transaction' : 'Select transaction'}
        className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
          item.selected ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'
        }`}
      >
        {item.selected && <Check className="w-3.5 h-3.5" />}
      </button>
      <div className="flex-1 min-w-0 grid grid-cols-12 gap-2">
        <div className="col-span-7">
          <Input value={item.title} onChange={(e) => onUpdateItem({ title: e.target.value })} aria-label="Merchant or title" className="h-9 text-xs sm:text-sm font-medium rounded-lg" />
        </div>
        <div className="col-span-5">
          <Input
            type="number"
            min="1"
            step="any"
            value={item.amount || ''}
            onChange={(e) => onUpdateItem({ amount: Math.max(0, parseFloat(e.target.value) || 0) })}
            aria-label="Amount"
            className="h-9 text-xs sm:text-sm font-mono tabular-nums font-bold text-right rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

function SmsItemMetaRow(props: {
  item: ParsedSmsExpense;
  cat: ReturnType<typeof useFinanceStore.getState>['categories'][number] | undefined;
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  onEditCategory: () => void;
  onUpdateItem: (patch: Partial<ParsedSmsExpense>) => void;
}) {
  const { item, cat, accounts, onEditCategory, onUpdateItem } = props;
  return (
    <div className="flex flex-wrap items-center gap-2 pl-7">
      <button type="button" onClick={onEditCategory} className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium flex items-center gap-1.5 transition-colors">
        <CategoryIcon name={cat?.icon} className="w-3.5 h-3.5" style={{ color: cat?.color }} />
        <span>{cat?.name || 'Category'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>
      <select value={item.accountId} onChange={(e) => onUpdateItem({ accountId: e.target.value })} aria-label="Account" className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground">
        {accounts.filter((a) => !a.deletedAt).map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
      </select>
      <button
        type="button"
        onClick={() => onUpdateItem({ type: item.type === 'expense' ? 'income' : 'expense' })}
        className={`h-8 px-2.5 rounded-lg text-xs font-semibold capitalize ${item.type === 'income' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-foreground'}`}
      >
        {item.type}
      </button>
      <span className="text-[11px] font-mono tabular-nums text-muted-foreground ml-auto">{item.date}</span>
    </div>
  );
}

function ParsedSmsItemCard(props: {
  item: ParsedSmsExpense;
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  isFitnessEnabled: boolean;
  itemBridge: BridgeSelection;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
  onUpdateItem: (patch: Partial<ParsedSmsExpense>) => void;
  onEditCategory: () => void;
  onPatchBridge: (patch: Partial<BridgeSelection>) => void;
}) {
  const { item, categories, accounts, isFitnessEnabled, itemBridge, supplementInventory, onUpdateItem, onEditCategory, onPatchBridge } = props;
  const cat = categories.find((c) => c.id === item.categoryId);
  const catOrSlug = cat || (item.categorySlug ? { slug: item.categorySlug, name: item.categorySlug } : null);
  const bridgeKind = isFitnessEnabled && item.type === 'expense' ? classifyCategoryBridgeKind(catOrSlug) : 'none';

  return (
    <div className={`rounded-2xl border p-3.5 space-y-2.5 transition-colors ${item.selected ? 'border-primary/40 bg-card' : 'border-border bg-muted/30 opacity-70'}`}>
      <SmsItemTopRow item={item} onUpdateItem={onUpdateItem} />
      <SmsItemMetaRow item={item} cat={cat} accounts={accounts} onEditCategory={onEditCategory} onUpdateItem={onUpdateItem} />
      <SmsBridgeControls item={item} bridgeKind={bridgeKind} itemBridge={itemBridge} supplementInventory={supplementInventory} onPatchBridge={onPatchBridge} />
      {item.isDuplicate && (
        <div className="pl-7 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Possible duplicate of an existing entry
          </span>
        </div>
      )}
    </div>
  );
}

function buildSmsImportTags(item: ParsedSmsExpense): string[] {
  const refTags = item.referenceId ? [`ref:${item.referenceId}`] : [];
  return Array.from(new Set(['sms-import', ...(item.tags || []), ...refTags]));
}

function resolveSmsBridgeCategory(
  categories: ReturnType<typeof useFinanceStore.getState>['categories'],
  item: ParsedSmsExpense,
  fallbackCat: string
) {
  const direct = categories.find((c) => c.id === (item.categoryId || fallbackCat));
  if (direct) return direct;
  return item.categorySlug ? { slug: item.categorySlug, name: item.categorySlug } : null;
}

function buildSmsBridgeArgs(params: {
  bridgeKind: Exclude<ReturnType<typeof classifyCategoryBridgeKind>, 'none'>;
  item: ParsedSmsExpense;
  createdTx: Awaited<ReturnType<ReturnType<typeof useFinanceStore.getState>['addTransaction']>>;
  itemBridge?: BridgeSelection;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
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

async function runSmsFitnessBridge(params: {
  item: ParsedSmsExpense;
  fallbackCat: string;
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  createdTx: Awaited<ReturnType<ReturnType<typeof useFinanceStore.getState>['addTransaction']>>;
  itemBridge?: BridgeSelection;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
}): Promise<{ dietLogged: boolean; suppRestocked: boolean }> {
  const { item, fallbackCat, categories, createdTx, itemBridge, supplementInventory } = params;
  const bridgeKind = classifyCategoryBridgeKind(resolveSmsBridgeCategory(categories, item, fallbackCat));
  if (bridgeKind === 'none' || createdTx.type !== 'expense') {
    return { dietLogged: false, suppRestocked: false };
  }
  const res = await executeFinanceFitnessBridge(
    buildSmsBridgeArgs({ bridgeKind, item, createdTx, itemBridge, supplementInventory })
  );
  return {
    dietLogged: bridgeKind === 'junk' || Boolean(res.dietLogged),
    suppRestocked: Boolean(res.supplementRestocked),
  };
}

async function importSingleSmsItem(params: {
  item: ParsedSmsExpense;
  fallbackCat: string;
  fallbackAcc: string;
  sendToReviewInbox: boolean;
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  addTransaction: ReturnType<typeof useFinanceStore.getState>['addTransaction'];
  itemBridge?: BridgeSelection;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
}): Promise<{ reviewed: boolean; dietLogged: boolean; suppRestocked: boolean }> {
  const { item, fallbackCat, fallbackAcc, sendToReviewInbox, categories, addTransaction, itemBridge, supplementInventory } = params;
  const reviewed = sendToReviewInbox && !item.matchedRuleId;
  const trimmedTitle = item.title.trim();
  const createdTx = await addTransaction({
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
  });

  const bridged = await runSmsFitnessBridge({
    item,
    fallbackCat,
    categories,
    createdTx,
    itemBridge,
    supplementInventory,
  });
  return { reviewed, ...bridged };
}

function SmsAutomationGuide({
  show,
  onToggle,
  onCopyDeepLink,
}: {
  show: boolean;
  onToggle: () => void;
  onCopyDeepLink: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>How to auto-capture mobile SMS &amp; notifications</span>
        {show ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {show && (
        <div className="px-3.5 pb-3.5 space-y-2.5 text-xs text-muted-foreground border-t border-border/50 pt-2.5">
          <p>
            <strong className="text-foreground">1. Android Share Menu:</strong> Install Habit Flow to your home screen, then share any bank SMS or notification directly to <em>Habit Flow</em> to pre-fill this importer.
          </p>
          <p>
            <strong className="text-foreground">2. Android MacroDroid / Tasker or iOS Shortcuts:</strong> Open this deep-link when a bank notification arrives:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-mono truncate">
              /finance?sms=&#123;notification_text&#125;
            </code>
            <Button type="button" size="sm" variant="outline" onClick={onCopyDeepLink} className="h-8 px-2.5 rounded-lg gap-1 text-xs shrink-0">
              <Copy className="w-3.5 h-3.5" />
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

async function readSmsClipboard(onParsed: (text: string) => Promise<void>) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    toast.error('Clipboard access is unavailable in this browser. Paste manually below.');
    return;
  }
  try {
    const clipText = await navigator.clipboard.readText();
    if (!clipText?.trim()) {
      toast.info('Clipboard is empty. Copy a bank SMS or notification first.');
      return;
    }
    await onParsed(clipText);
  } catch {
    toast.error('Clipboard permission denied. Paste the SMS text manually below.');
  }
}

function readSmsUploadedFile(
  file: File,
  onParsed: (text: string) => Promise<void>
) {
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const content = String(ev.target?.result || '');
    if (!content.trim()) {
      toast.error('Selected file is empty');
      return;
    }
    await onParsed(content);
  };
  reader.readAsText(file);
}

async function executeSmsImportBatch(params: {
  selectedItems: ParsedSmsExpense[];
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  sendToReviewInbox: boolean;
  addTransaction: ReturnType<typeof useFinanceStore.getState>['addTransaction'];
  bridgeByItemId: Record<string, BridgeSelection>;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
}) {
  const { selectedItems, categories, accounts, sendToReviewInbox, addTransaction, bridgeByItemId, supplementInventory } = params;
  const fallbackCat = categories[0]?.id || 'uncategorized';
  const fallbackAcc = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || 'default';
  const outcomes = await Promise.all(
    selectedItems.map((item) =>
      importSingleSmsItem({
        item, fallbackCat, fallbackAcc, sendToReviewInbox, categories, addTransaction,
        itemBridge: bridgeByItemId[item.id], supplementInventory,
      })
    )
  );
  return formatImportToastMessage(
    selectedItems.length,
    outcomes.filter((o) => o.reviewed).length,
    outcomes.filter((o) => o.dietLogged).length,
    outcomes.filter((o) => o.suppRestocked).length
  );
}

async function copySmsDeepLink() {
  if (typeof window === 'undefined' || !navigator.clipboard?.writeText) return;
  const urlTemplate = `${window.location.origin}/finance?sms={notification_text}`;
  try {
    await navigator.clipboard.writeText(urlTemplate);
    toast.success('Copied deep-link URL template');
  } catch {
    toast.info(urlTemplate);
  }
}

async function runSmsParseBatch(params: {
  input: string;
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  transactions: ReturnType<typeof useFinanceStore.getState>['transactions'];
  categorizationRules: ReturnType<typeof useFinanceStore.getState>['categorizationRules'];
}): Promise<ParsedSmsExpense[]> {
  const trimmed = params.input.trim();
  const detected = parseSmsOrNotificationBatch(
    trimmed, params.categories, params.accounts, params.transactions, params.categorizationRules
  );
  if (detected.length === 0 && !trimmed.includes('\n')) {
    return fetchAiParsedExpense(trimmed, params.categories, params.accounts);
  }
  return detected;
}

function buildCategorySelectionPatch(
  categoryId: string,
  editingCategoryItemId: string,
  parsedItems: ParsedSmsExpense[],
  categories: ReturnType<typeof useFinanceStore.getState>['categories']
) {
  const targetItem = parsedItems.find((i) => i.id === editingCategoryItemId);
  const cat = categories.find((c) => c.id === categoryId);
  return { categoryId, categorySlug: cat?.slug || targetItem?.categorySlug || '' };
}

function useSmsModalSyncEffects(params: {
  open: boolean;
  initialText?: string | null;
  categoriesLength: number;
  fitnessHasLoaded: boolean;
  loadFinanceData: () => Promise<void>;
  loadFitnessData: () => Promise<void>;
  setEditingCategoryItemId: (id: string | null) => void;
  setRawText: (v: string) => void;
  setParsedItems: (v: ParsedSmsExpense[]) => void;
  setHasParsed: (v: boolean) => void;
  runParse: (input: string) => Promise<void>;
}) {
  const {
    open, initialText, categoriesLength, fitnessHasLoaded, loadFinanceData, loadFitnessData,
    setEditingCategoryItemId, setRawText, setParsedItems, setHasParsed, runParse,
  } = params;

  useEffect(() => {
    if (open && categoriesLength === 0) void loadFinanceData();
    if (open && !fitnessHasLoaded) loadFitnessData().catch(() => undefined);
  }, [open, categoriesLength, loadFinanceData, fitnessHasLoaded, loadFitnessData]);

  useEffect(() => {
    if (!open) {
      setEditingCategoryItemId(null);
      return;
    }
    if (initialText?.trim()) {
      setRawText(initialText);
      void runParse(initialText);
      return;
    }
    setRawText('');
    setParsedItems([]);
    setHasParsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialText]);
}

function useSmsImportController(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText?: string | null;
}) {
  const { open, onOpenChange, initialText } = params;
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const categorizationRules = useFinanceStore((s) => s.categorizationRules);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const supplementInventory = useFitnessStore((s) => s.supplementInventory);
  const isFitnessEnabled = isFitnessModuleEnabled(useGamificationStore((s) => s.settings));
  const fitnessHasLoaded = useFitnessStore((s) => s.hasLoaded);
  const loadFitnessData = useFitnessStore((s) => s.loadFitnessData);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedSmsExpense[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showAutomationGuide, setShowAutomationGuide] = useState(false);
  const [editingCategoryItemId, setEditingCategoryItemId] = useState<string | null>(null);
  const [sendToReviewInbox, setSendToReviewInbox] = useState(true);
  const [bridgeByItemId, setBridgeByItemId] = useState<Record<string, BridgeSelection>>({});

  const runParse = async (input: string) => {
    if (!input.trim()) {
      setParsedItems([]);
      setHasParsed(false);
      return;
    }
    setIsParsing(true);
    try {
      const detected = await runSmsParseBatch({ input, categories, accounts, transactions, categorizationRules });
      setParsedItems(detected);
      setBridgeByItemId({});
      setHasParsed(true);
      if (detected.length === 0) toast.info('No bank or UPI expense amounts detected in that text');
    } finally {
      setIsParsing(false);
    }
  };

  useSmsModalSyncEffects({
    open, initialText, categoriesLength: categories.length, fitnessHasLoaded, loadFinanceData, loadFitnessData,
    setEditingCategoryItemId, setRawText, setParsedItems, setHasParsed, runParse,
  });

  const handleReadClipboard = () =>
    readSmsClipboard(async (text) => {
      setRawText(text);
      await runParse(text);
    });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readSmsUploadedFile(file, async (text) => {
      setRawText(text);
      await runParse(text);
    });
    e.target.value = '';
  };

  const updateItem = (id: string, patch: Partial<ParsedSmsExpense>) => {
    setParsedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleCategorySelectedForItem = (categoryId: string) => {
    if (!editingCategoryItemId) return;
    updateItem(
      editingCategoryItemId,
      buildCategorySelectionPatch(categoryId, editingCategoryItemId, parsedItems, categories)
    );
  };

  const selectedItems = parsedItems.filter((item) => item.selected && item.amount > 0);

  const handleImportSelected = async () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one parsed expense to import');
      return;
    }
    setIsImporting(true);
    try {
      const msg = await executeSmsImportBatch({
        selectedItems, categories, accounts, sendToReviewInbox, addTransaction, bridgeByItemId, supplementInventory,
      });
      toast.success(msg);
      onOpenChange(false);
    } finally {
      setIsImporting(false);
    }
  };

  return {
    categories, accounts, supplementInventory, isFitnessEnabled,
    fileInputRef, rawText, setRawText, parsedItems, setParsedItems,
    hasParsed, isParsing, isImporting, showAutomationGuide, setShowAutomationGuide,
    editingCategoryItemId, setEditingCategoryItemId, sendToReviewInbox, setSendToReviewInbox,
    bridgeByItemId, setBridgeByItemId, selectedItems,
    editingCategoryItem: parsedItems.find((i) => i.id === editingCategoryItemId),
    runParse, handleReadClipboard, handleFileUpload, updateItem,
    handleCategorySelectedForItem, handleImportSelected, handleCopyDeepLink: copySmsDeepLink,
  };
}

function SmsImportHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-5 py-3.5 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <MessageSquareText className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-base font-bold text-foreground truncate">Fetch from SMS &amp; Notifications</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">UPI, bank &amp; card notification parser</p>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

function SmsDetectedHeader({
  count,
  sendToReviewInbox,
  allSelected,
  onToggleReview,
  onToggleSelectAll,
}: {
  count: number;
  sendToReviewInbox: boolean;
  allSelected: boolean;
  onToggleReview: (checked: boolean) => void;
  onToggleSelectAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detected ({count})</h3>
      {count > 0 && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={sendToReviewInbox} onChange={(e) => onToggleReview(e.target.checked)} className="rounded border-input" />
            <span>Flag unmatched for Review Inbox</span>
          </label>
          <button type="button" onClick={onToggleSelectAll} className="text-xs font-medium text-primary hover:underline">
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      )}
    </div>
  );
}

function SmsDetectedResultsSection({ c }: { c: ReturnType<typeof useSmsImportController> }) {
  const allSelected = c.parsedItems.every((i) => i.selected);
  return (
    <div className="space-y-2.5 pt-1">
      <SmsDetectedHeader
        count={c.parsedItems.length}
        sendToReviewInbox={c.sendToReviewInbox}
        allSelected={allSelected}
        onToggleReview={c.setSendToReviewInbox}
        onToggleSelectAll={() => c.setParsedItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })))}
      />

      {c.parsedItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No valid debit or credit transactions found. Make sure the text includes an amount (e.g. ₹450 or Rs. 450).
        </div>
      ) : (
        <div className="space-y-2.5">
          {c.parsedItems.map((item) => (
            <ParsedSmsItemCard
              key={item.id}
              item={item}
              categories={c.categories}
              accounts={c.accounts}
              isFitnessEnabled={c.isFitnessEnabled}
              itemBridge={c.bridgeByItemId[item.id] || {}}
              supplementInventory={c.supplementInventory}
              onUpdateItem={(patch) => c.updateItem(item.id, patch)}
              onEditCategory={() => c.setEditingCategoryItemId(item.id)}
              onPatchBridge={(patch) => c.setBridgeByItemId((prev) => ({ ...prev, [item.id]: { ...prev[item.id], ...patch } }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SmsInputControls({ c }: { c: ReturnType<typeof useSmsImportController> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="outline" onClick={c.handleReadClipboard} className="h-11 rounded-xl gap-2 text-xs font-semibold">
          <ClipboardPaste className="w-4 h-4 text-primary" />
          Read Clipboard
        </Button>
        <Button type="button" variant="outline" onClick={() => c.fileInputRef.current?.click()} className="h-11 rounded-xl gap-2 text-xs font-semibold">
          <Upload className="w-4 h-4 text-primary" />
          Upload SMS Log
        </Button>
        <input ref={c.fileInputRef} type="file" accept=".txt,.csv,.json,text/plain,application/json" onChange={c.handleFileUpload} className="hidden" />
      </div>

      <div className="space-y-2">
        <label htmlFor="sms-raw-input" className="text-xs font-medium text-muted-foreground block">Paste one or multiple SMS / notifications</label>
        <textarea
          id="sms-raw-input"
          rows={4}
          value={c.rawText}
          onChange={(e) => c.setRawText(e.target.value)}
          placeholder="Paste bank debit/credit SMS or UPI notification text here..."
          className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">OTPs, failed alerts, and available balances are ignored automatically.</span>
          <Button type="button" size="sm" disabled={!c.rawText.trim() || c.isParsing} onClick={() => c.runParse(c.rawText)} className="h-9 px-3.5 rounded-xl gap-1.5 text-xs font-semibold shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            {c.isParsing ? 'Scanning...' : 'Detect Expenses'}
          </Button>
        </div>
      </div>
    </>
  );
}

function SmsImportFooter({ c }: { c: ReturnType<typeof useSmsImportController> }) {
  const count = c.selectedItems.length;
  const totalAmount = c.selectedItems.reduce((sum, i) => sum + i.amount, 0);
  const buttonLabel = c.isImporting ? 'Importing...' : `Import ${count || ''} ${count === 1 ? 'Entry' : 'Entries'}`.trim();

  return (
    <div className="px-5 py-3.5 border-t border-border bg-background flex items-center justify-between gap-3 shrink-0">
      <div className="text-xs text-muted-foreground font-mono tabular-nums">
        {count > 0 ? `Total: ${formatINR(totalAmount)}` : 'Ready to scan'}
      </div>
      <Button type="button" disabled={count === 0 || c.isImporting} onClick={c.handleImportSelected} className="h-11 px-5 rounded-xl text-sm font-semibold">
        {buttonLabel}
      </Button>
    </div>
  );
}

export function SmsImportModal({ open, onOpenChange, initialText }: SmsImportModalProps) {
  const c = useSmsImportController({ open, onOpenChange, initialText });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[560px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col border-border bg-background"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>
        <SmsImportHeader onClose={() => onOpenChange(false)} />

        <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
          <SmsInputControls c={c} />
          {c.hasParsed && <SmsDetectedResultsSection c={c} />}
          <SmsAutomationGuide
            show={c.showAutomationGuide}
            onToggle={() => c.setShowAutomationGuide((v) => !v)}
            onCopyDeepLink={c.handleCopyDeepLink}
          />
        </div>

        <SmsImportFooter c={c} />
      </DialogContent>

      <CategoryPickerSheet
        open={Boolean(c.editingCategoryItemId)}
        onOpenChange={(next) => {
          if (!next) c.setEditingCategoryItemId(null);
        }}
        selectedCategoryId={c.editingCategoryItem?.categoryId || ''}
        onSelectCategory={c.handleCategorySelectedForItem}
      />
    </Dialog>
  );
}
