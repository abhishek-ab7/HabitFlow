'use client';

import React from 'react';
import {
  Search,
  ChevronRight,
  SlidersHorizontal,
  Receipt,
  PieChart,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceTransaction } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { CategoryIcon } from './CategoryIcon';
import { SpendingTrendChart } from './SpendingTrendChart';

interface OverviewTabProps {
  onEditTransaction: (tx: FinanceTransaction) => void;
  onOpenBudgetModal: (focusCategoryId?: string) => void;
  onOpenTrackersTab: () => void;
  onOpenAddTransaction: () => void;
}

export function OverviewTab({
  onEditTransaction,
  onOpenBudgetModal,
  onOpenTrackersTab,
  onOpenAddTransaction,
}: OverviewTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const filters = useFinanceStore((s) => s.filters);
  const setFilters = useFinanceStore((s) => s.setFilters);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getUpcomingFinancialObligations = useFinanceStore(
    (s) => s.getUpcomingFinancialObligations
  );
  const getFilteredTransactions = useFinanceStore((s) => s.getFilteredTransactions);

  const summary = getMonthlySummary(selectedMonth);
  const dueSoonList = getUpcomingFinancialObligations(10);
  const dueSoonTotal = dueSoonList.reduce((acc, item) => acc + item.amount, 0);
  const transactions = getFilteredTransactions(selectedMonth);

  const categoriesMap = new Map(categories.map((c) => [c.id, c]));
  const accountsMap = new Map(accounts.map((a) => [a.id, a]));
  const commitmentsMap = new Map(commitments.map((c) => [c.id, c]));

  const hasBudget = summary.monthlyBudget > 0;
  const budgetPct = hasBudget
    ? Math.min(100, Math.round((summary.totalSpent / summary.monthlyBudget) * 100))
    : 0;
  const isOverBudget = hasBudget && summary.totalSpent > summary.monthlyBudget;
  const isNearBudget = hasBudget && !isOverBudget && budgetPct >= 80;

  const budgetedCategories = summary.categoryBreakdown.filter(
    (item) => item.budgetLimit > 0
  );
  const unbudgetedCount = summary.categoryBreakdown.length - budgetedCategories.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column on Desktop / Top on Mobile: Summary + Category Budgets */}
      <div className="lg:col-span-5 space-y-4">
        {/* Single Clean Summary Card */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Spent this month
              </p>
              <p className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-foreground mt-1">
                {formatINR(summary.totalSpent)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenBudgetModal()}
              className="min-h-[44px] px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{hasBudget ? 'Edit Budgets' : 'Set Budgets'}</span>
            </button>
          </div>

          {hasBudget ? (
            <div className="space-y-2">
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  style={{ width: `${budgetPct}%` }}
                  className={`h-full rounded-full transition-all duration-300 ${
                    isOverBudget
                      ? 'bg-rose-500'
                      : isNearBudget
                      ? 'bg-amber-500'
                      : 'bg-primary'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono tabular-nums">
                <span>
                  {isOverBudget
                    ? `Over by ${formatINR(summary.totalSpent - summary.monthlyBudget)}`
                    : `${formatINR(
                        Math.max(0, summary.monthlyBudget - summary.totalSpent)
                      )} left of ${formatINR(summary.monthlyBudget)}`}
                </span>
                <span>{budgetPct}%</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No monthly budget set yet. Tap Set Budgets to set an overall or category limit.
            </p>
          )}

          {/* Clean 3-Metric Row: Spent · Budget · Due Soon */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/70">
            <div>
              <span className="text-xs text-muted-foreground block">Spent</span>
              <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground">
                {formatINR(summary.totalSpent)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onOpenBudgetModal()}
              className="text-left min-h-[44px] rounded-lg hover:bg-muted/50 px-1.5 -mx-1.5 transition-colors"
            >
              <span className="text-xs text-muted-foreground block">Budget</span>
              <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-foreground">
                {hasBudget ? formatINR(summary.monthlyBudget) : 'Not set'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenTrackersTab}
              className="text-left min-h-[44px] rounded-lg hover:bg-muted/50 px-1.5 -mx-1.5 transition-colors"
            >
              <span className="text-xs text-muted-foreground block">Due Soon</span>
              <span
                className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                  dueSoonList.length > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-foreground'
                }`}
              >
                {dueSoonList.length > 0 ? formatINR(dueSoonTotal) : 'None'}
              </span>
            </button>
          </div>
        </div>

        {/* Category Budgets vs Actual Visual Progress Bars */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Category Budgets
              </h2>
              <p className="text-xs text-muted-foreground">
                Actual vs budgeted spending
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenBudgetModal()}
              className="min-h-[44px] px-3 rounded-xl text-xs font-medium text-primary hover:bg-primary/10 transition-colors whitespace-nowrap shrink-0"
            >
              {budgetedCategories.length > 0 ? 'Manage' : 'Set Limits'}
            </button>
          </div>

          {budgetedCategories.length === 0 ? (
            <button
              type="button"
              onClick={() => onOpenBudgetModal()}
              className="w-full min-h-[72px] rounded-xl border border-dashed border-border px-4 py-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <PieChart className="w-5 h-5" />
              </span>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">
                  Track category spending limits
                </p>
                <p className="text-xs text-muted-foreground">
                  Set limits for Food, Groceries, Shopping, and more to compare progress here.
                </p>
              </div>
            </button>
          ) : (
            <div className="space-y-3.5">
              {budgetedCategories.map((item) => {
                const rawPct =
                  item.budgetLimit > 0
                    ? Math.round((item.spent / item.budgetLimit) * 100)
                    : 0;
                const barWidth = Math.min(100, rawPct);
                const overAmount = Math.max(0, item.spent - item.budgetLimit);

                return (
                  <button
                    key={item.category.id}
                    type="button"
                    onClick={() => onOpenBudgetModal(item.category.id)}
                    className="w-full text-left space-y-1.5 rounded-xl p-2 -mx-2 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${item.category.color}18`,
                            color: item.category.color,
                          }}
                        >
                          <CategoryIcon
                            name={item.category.icon}
                            className="w-4 h-4"
                          />
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm font-medium text-foreground truncate block">
                            {item.category.name}
                          </span>
                          <span
                            className={`text-[11px] font-medium block ${
                              item.status === 'exceeded'
                                ? 'text-rose-600 dark:text-rose-400'
                                : item.status === 'warning'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {item.status === 'exceeded'
                              ? `Over by ${formatINR(overAmount)}`
                              : item.status === 'warning'
                              ? 'Near limit'
                              : `${formatINR(
                                  Math.max(0, item.budgetLimit - item.spent)
                                )} left`}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <span className="text-xs sm:text-sm font-semibold text-foreground">
                          {formatINR(item.spent)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {' '}
                          / {formatINR(item.budgetLimit)}
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          {rawPct}%
                        </span>
                      </div>
                    </div>

                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        style={{ width: `${barWidth}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.status === 'exceeded'
                            ? 'bg-rose-500'
                            : item.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-primary'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}

              {unbudgetedCount > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenBudgetModal()}
                  className="w-full min-h-[40px] pt-2 border-t border-border/60 text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                >
                  {unbudgetedCount} other {unbudgetedCount === 1 ? 'category' : 'categories'} without limits · Add limits
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Column on Desktop / Below on Mobile: 6-Month Trend Chart + Recent Transactions Feed */}
      <div className="lg:col-span-7 space-y-4">
        <SpendingTrendChart onOpenBudgetModal={onOpenBudgetModal} />

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={filters.searchQuery}
              onChange={(e) => setFilters({ searchQuery: e.target.value })}
              placeholder="Search expenses or notes..."
              className="pl-10 h-11 rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted shrink-0">
            {(['all', 'expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilters({ type: t })}
                className={`min-h-[38px] px-3 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                  filters.type === t
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                No entries recorded for this month
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Start fresh by logging your first expense or income using the Add button.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAddTransaction}
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Add First Entry
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
            {transactions.map((tx) => {
              const cat = categoriesMap.get(tx.categoryId);
              const acc = accountsMap.get(tx.accountId);
              const comm = tx.linkedCommitmentId
                ? commitmentsMap.get(tx.linkedCommitmentId)
                : undefined;

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onEditTransaction(tx)}
                  className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: cat ? `${cat.color}18` : 'var(--muted)',
                        color: cat?.color || 'currentColor',
                      }}
                    >
                      <CategoryIcon name={cat?.icon} className="w-4 h-4" />
                    </span>

                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {tx.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                        <span>{cat?.name || 'General'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{acc?.name || 'Account'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{tx.date}</span>
                        {comm && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-pink-600 dark:text-pink-400 font-medium">
                              Offset: {comm.recipientName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-foreground'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
