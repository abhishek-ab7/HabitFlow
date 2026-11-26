'use client';

import React from 'react';
import { Download, MoreHorizontal, Pencil, Plus, RotateCcw, Scale, SlidersHorizontal, Star, Tag } from 'lucide-react';
import { formatINR } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinanceCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CategoryIcon } from '../CategoryIcon';
import { CreditCardItem } from '../credit-cards/CreditCardItem';

function AssetAccountRow({
  acc,
  onEdit,
  onReconcile,
  onSetDefault,
}: {
  acc: FinanceAccount;
  onEdit: (acc: FinanceAccount) => void;
  onReconcile: (acc: FinanceAccount) => void;
  onSetDefault: (acc: FinanceAccount) => void;
}) {
  return (
    <div className="min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
      <button type="button" onClick={() => onEdit(acc)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${acc.color}18`, color: acc.color }}>
          <CategoryIcon name={acc.icon} className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
            <span className="truncate">{acc.name}</span>
            {acc.isDefault && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/12 text-primary text-[10px] font-semibold shrink-0">
                <Star className="w-2.5 h-2.5 fill-primary" />
                Default
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
        </div>
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground mr-1 whitespace-nowrap">
          {formatINR(acc.balance)}
        </span>
        <div className="hidden sm:flex items-center gap-1.5">
          {!acc.isDefault && (
            <button
              type="button"
              onClick={() => onSetDefault(acc)}
              title="Set as default Paid via account"
              aria-label={`Set ${acc.name} as default`}
              className="h-8 px-2 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <Star className="w-3 h-3" />
              <span>Default</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onReconcile(acc)}
            title="Reconcile actual bank balance"
            aria-label={`Reconcile ${acc.name} balance`}
            className="h-8 px-2 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <Scale className="w-3.5 h-3.5 text-primary" />
            <span>Reconcile</span>
          </button>
          <button
            type="button"
            onClick={() => onEdit(acc)}
            aria-label={`Edit ${acc.name}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Actions for ${acc.name}`} className="w-10 h-10 -mr-1.5 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              {!acc.isDefault && (
                <DropdownMenuItem onClick={() => onSetDefault(acc)} className="gap-2 py-2.5">
                  <Star className="w-4 h-4 text-primary" />
                  <span>Set as Default</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onReconcile(acc)} className="gap-2 py-2.5">
                <Scale className="w-4 h-4 text-primary" />
                <span>Reconcile Balance</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(acc)} className="gap-2 py-2.5">
                <Pencil className="w-4 h-4 text-muted-foreground" />
                <span>Edit Account</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export function AccountsLeftColumn(params: {
  assetAccounts: FinanceAccount[];
  creditCards: FinanceAccount[];
  onEdit: (acc: FinanceAccount) => void;
  onReconcile: (acc: FinanceAccount) => void;
  onSetDefault: (acc: FinanceAccount) => void;
  onAddCreditCard: () => void;
}) {
  const { assetAccounts, creditCards, onEdit, onReconcile, onSetDefault, onAddCreditCard } = params;
  return (
    <div className="lg:col-span-5 space-y-5">
      <section className="space-y-2.5">
        <h2 className="text-sm font-bold text-foreground">Liquid &amp; Investment Accounts ({assetAccounts.length})</h2>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
          {assetAccounts.map((acc) => (
            <AssetAccountRow key={acc.id} acc={acc} onEdit={onEdit} onReconcile={onReconcile} onSetDefault={onSetDefault} />
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Credit Cards ({creditCards.length})</h2>
          <button type="button" onClick={onAddCreditCard} className="text-xs font-semibold text-primary hover:underline">
            + Add Credit Card
          </button>
        </div>
        {creditCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            Add a Credit Card account to track credit utilization %, statement close day, and bill due countdown.
          </div>
        ) : (
          <div className="space-y-4">
            {creditCards.map((card) => (
              <CreditCardItem key={card.id} card={card} onEdit={onEdit} onSetDefault={() => onSetDefault(card)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function CategoriesDirectorySection(params: {
  activeCategories: FinanceCategory[];
  onOpenBudgetModal?: (focusCategoryId?: string) => void;
  onNewCategory: () => void;
}) {
  const { activeCategories, onOpenBudgetModal, onNewCategory } = params;
  return (
    <div className="lg:col-span-7 space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Categories Directory ({activeCategories.length})</h2>
              <p className="text-xs text-muted-foreground">Create custom categories or configure monthly limits in Budgets</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenBudgetModal && (
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenBudgetModal()} className="h-9 px-3 rounded-xl gap-1.5 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Edit Envelopes
              </Button>
            )}
            <Button type="button" size="sm" onClick={onNewCategory} className="h-9 px-3 rounded-xl gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              New Category
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {activeCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onOpenBudgetModal?.(cat.id)}
              className="px-3 py-2 rounded-xl border border-border/70 bg-background hover:bg-muted/40 flex items-center gap-2 text-left transition-colors"
            >
              <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>
                <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{cat.name}</p>
                <p className="text-[10px] font-mono tabular-nums text-muted-foreground">
                  {cat.monthlyBudgetLimit > 0 ? formatINR(cat.monthlyBudgetLimit) : 'No limit'}
                  {cat.rolloverEnabled ? ' · Rollover' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function DataManagementFooter({ onExportCsv, onOpenReset }: { onExportCsv: () => void; onOpenReset: () => void }) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Data Management &amp; Fresh Start</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Export all transactions to a CSV spreadsheet or reset all accounts to ₹0 for a fresh financial cycle.
        </p>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
        <Button type="button" variant="outline" onClick={onExportCsv} className="min-h-[40px] flex-1 sm:flex-initial gap-2 text-xs font-semibold rounded-xl">
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onOpenReset}
          className="min-h-[40px] flex-1 sm:flex-initial gap-2 text-xs font-semibold text-rose-500 hover:text-rose-600 border-rose-200/50 hover:border-rose-300 dark:border-rose-900/40 rounded-xl"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset to ₹0</span>
        </Button>
      </div>
    </section>
  );
}
