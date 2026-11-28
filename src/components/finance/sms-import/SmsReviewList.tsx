'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Check, ChevronDown, Pill, Utensils } from 'lucide-react';
import {
  classifyCategoryBridgeKind,
  estimateDietBridgePreview,
  findMatchingSupplementId,
} from '@/lib/fitness/finance-bridge';
import type { ParsedSmsExpense } from '@/lib/finance/sms-parser';
import type { BridgeSelection } from '@/lib/finance/sms-import-helpers';
import type { FinanceAccount, FinanceCategory, SupplementInventory } from '@/lib/types';
import { CategoryIcon } from '../CategoryIcon';
import type { useSmsImportController } from './useSmsImportController';

function RestockInputsRow(props: {
  itemTitle: string;
  matchedSuppId: string;
  restockServings: number;
  activeSupps: SupplementInventory[];
  onPatchBridge: (patch: Partial<BridgeSelection>) => void;
}) {
  const { itemTitle, matchedSuppId, restockServings, activeSupps, onPatchBridge } = props;
  return (
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
        value={restockServings}
        onChange={(e) => onPatchBridge({ restockServings: Math.max(1, Number(e.target.value) || 30) })}
        aria-label="Restock servings"
        className="h-7 w-16 text-[11px]"
      />
    </div>
  );
}

function HealthSupplementBridge(props: {
  itemTitle: string;
  itemBridge: BridgeSelection;
  supplementInventory: SupplementInventory[];
  onPatchBridge: (patch: Partial<BridgeSelection>) => void;
}) {
  const { itemTitle, itemBridge, supplementInventory, onPatchBridge } = props;
  const activeSupps = supplementInventory.filter((s) => !s.deletedAt && s.isActive);
  const matchedSuppId = itemBridge.supplementId ?? findMatchingSupplementId(itemTitle, supplementInventory);
  const restockServings = itemBridge.restockServings ?? 30;
  const isEnabled = Boolean(itemBridge.restockSupplement);
  const activeCls = isEnabled
    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
    : 'bg-background border-border text-muted-foreground hover:text-foreground';

  return (
    <>
      <button
        type="button"
        onClick={() => onPatchBridge({ restockSupplement: !isEnabled, supplementId: matchedSuppId, restockServings })}
        aria-pressed={isEnabled}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${activeCls}`}
      >
        <Pill className="w-3 h-3" />
        Restock Supplement
      </button>
      {isEnabled && (
        <RestockInputsRow
          itemTitle={itemTitle}
          matchedSuppId={matchedSuppId}
          restockServings={restockServings}
          activeSupps={activeSupps}
          onPatchBridge={onPatchBridge}
        />
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
  supplementInventory: SupplementInventory[];
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
  cat: FinanceCategory | undefined;
  accounts: FinanceAccount[];
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

function resolveParsedItemCategory(categories: FinanceCategory[], item: ParsedSmsExpense) {
  const cat = categories.find((c) => c.id === item.categoryId);
  const catOrSlug = cat ?? (item.categorySlug ? { slug: item.categorySlug, name: item.categorySlug } : null);
  return { cat, catOrSlug };
}

function SmsDuplicateBadge() {
  return (
    <div className="pl-7 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Possible duplicate of an existing entry
      </span>
    </div>
  );
}

function ParsedSmsItemCard(props: {
  item: ParsedSmsExpense;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  isFitnessEnabled: boolean;
  itemBridge: BridgeSelection;
  supplementInventory: SupplementInventory[];
  onUpdateItem: (patch: Partial<ParsedSmsExpense>) => void;
  onEditCategory: () => void;
  onPatchBridge: (patch: Partial<BridgeSelection>) => void;
}) {
  const { item, categories, accounts, isFitnessEnabled, itemBridge, supplementInventory, onUpdateItem, onEditCategory, onPatchBridge } = props;
  const { cat, catOrSlug } = resolveParsedItemCategory(categories, item);
  const bridgeKind = isFitnessEnabled && item.type === 'expense' ? classifyCategoryBridgeKind(catOrSlug) : 'none';

  return (
    <div className={`rounded-2xl border p-3.5 space-y-2.5 transition-colors ${item.selected ? 'border-primary/40 bg-card' : 'border-border bg-muted/30 opacity-70'}`}>
      <SmsItemTopRow item={item} onUpdateItem={onUpdateItem} />
      <SmsItemMetaRow item={item} cat={cat} accounts={accounts} onEditCategory={onEditCategory} onUpdateItem={onUpdateItem} />
      <SmsBridgeControls item={item} bridgeKind={bridgeKind} itemBridge={itemBridge} supplementInventory={supplementInventory} onPatchBridge={onPatchBridge} />
      {item.isDuplicate && <SmsDuplicateBadge />}
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

export function SmsDetectedResultsSection({ c }: { c: ReturnType<typeof useSmsImportController> }) {
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
