'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronRight,
  SlidersHorizontal,
  Receipt,
  PieChart as PieChartIcon,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceTransaction } from '@/lib/types';
import { CategoryIcon } from './CategoryIcon';
import { formatHumanDate } from '@/lib/date-format';
import { toast } from 'sonner';

const SpendingTrendChart = dynamic(
  () => import('./SpendingTrendChart').then((m) => ({ default: m.SpendingTrendChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[310px] rounded-2xl border border-border bg-card animate-pulse" />
    ),
  }
);

const OverviewCategoryDonut = dynamic(
  () => import('./OverviewCategoryDonut').then((m) => ({ default: m.OverviewCategoryDonut })),
  {
    ssr: false,
    loading: () => <div className="h-48 w-full rounded-xl bg-muted/40 animate-pulse" />,
  }
);

interface OverviewTabProps {
  onEditTransaction: (tx: FinanceTransaction) => void;
  onOpenBudgetModal: (focusCategoryId?: string) => void;
  onOpenTrackersTab: () => void;
  onOpenActivityTab?: (categoryId?: string) => void;
  onOpenAddTransaction: () => void;
  onOpenAskAi?: () => void;
}

export function OverviewTab({
  onEditTransaction,
  onOpenBudgetModal,
  onOpenTrackersTab,
  onOpenActivityTab,
  onOpenAddTransaction,
  onOpenAskAi,
}: OverviewTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const transactions = useFinanceStore((s) => s.transactions);
  const setFilters = useFinanceStore((s) => s.setFilters);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getUpcomingFinancialObligations = useFinanceStore(
    (s) => s.getUpcomingFinancialObligations
  );
  const getFilteredTransactions = useFinanceStore((s) => s.getFilteredTransactions);
  const getSpendingAnomalies = useFinanceStore((s) => s.getSpendingAnomalies);
  const approveReviewedTransaction = useFinanceStore(
    (s) => s.approveReviewedTransaction
  );

  const [showFormulaBreakdown, setShowFormulaBreakdown] = useState(false);
  const [categoryViewMode, setCategoryViewMode] = useState<'bars' | 'donut'>('bars');

  const summary = getMonthlySummary(selectedMonth);
  const anomalies = useMemo(
    () => getSpendingAnomalies(selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getSpendingAnomalies, selectedMonth, transactions, accounts]
  );
  const dueSoonList = getUpcomingFinancialObligations(10);
  const dueSoonTotal = dueSoonList.reduce((acc, item) => acc + item.amount, 0);
  const allMonthTransactions = getFilteredTransactions(selectedMonth);
  const recentTransactions = allMonthTransactions.slice(0, 5);
  const reviewQueue = allMonthTransactions
    .filter((tx) => tx.needsReview)
    .slice(0, 4);

  const categoriesMap = new Map(categories.map((c) => [c.id, c]));
  const accountsMap = new Map(accounts.map((a) => [a.id, a]));
  const commitmentsMap = new Map(commitments.map((c) => [c.id, c]));

  const hasBudget = summary.monthlyBudget > 0;
  const budgetBase =
    summary.monthlyBudget > 0
      ? summary.monthlyBudget
      : summary.expectedIncome > 0
      ? summary.expectedIncome
      : summary.totalIncome;

  const budgetPct = hasBudget
    ? Math.min(100, Math.round((summary.totalSpent / summary.monthlyBudget) * 100))
    : 0;
  const isOverBudget = hasBudget && summary.totalSpent > summary.monthlyBudget;
  const isAheadOfPace =
    hasBudget &&
    !isOverBudget &&
    budgetPct > summary.dayOfMonthProgressPct + 8;

  const budgetedCategories = summary.categoryBreakdown.filter(
    (item) => item.budgetLimit > 0 || item.spent > 0
  );
  const donutCategories = summary.categoryBreakdown.filter((item) => item.spent > 0);

  const fixedUnpaidTotal =
    summary.remainingUnpaidEmis +
    summary.remainingUnpaidCommitments +
    summary.remainingUnpaidBills +
    summary.plannedDebtInstallmentsDue;

  const handleCategoryDrilldown = (categoryId: string) => {
    setFilters({ categoryId });
    if (onOpenActivityTab) {
      onOpenActivityTab(categoryId);
    }
  };

  return (
    <div className="space-y-5">
      {/* Proactive Spending Anomaly & Cash-Crunch Alerts Strip */}
      {anomalies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {anomalies.slice(0, 2).map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';
            return (
              <div
                key={alert.id}
                className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 ${
                  isCritical
                    ? 'border-rose-500/35 bg-rose-500/5'
                    : isWarning
                    ? 'border-amber-500/35 bg-amber-500/5'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertTriangle
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isCritical
                        ? 'text-rose-500'
                        : isWarning
                        ? 'text-amber-500'
                        : 'text-primary'
                    }`}
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold text-foreground truncate">
                      {alert.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {alert.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (alert.actionTarget === 'activity') {
                      if (alert.kind === 'review_backlog') {
                        setFilters({ needsReview: 'only_review' });
                      }
                      onOpenActivityTab?.();
                    } else if (alert.actionTarget === 'trackers') {
                      onOpenTrackersTab();
                    } else if (alert.actionTarget === 'budgets') {
                      onOpenBudgetModal();
                    }
                  }}
                  className="text-xs font-semibold text-primary hover:underline whitespace-nowrap shrink-0 mt-0.5"
                >
                  {alert.actionLabel} →
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column on Desktop (5 cols): Safe-to-Spend Glass Hero + Category Budgets/Donut */}
        <div className="lg:col-span-5 space-y-4">
          {/* Safe-to-Spend Flagship Hero Card */}
          <div className="surface-hero p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {budgetBase > 0 ? 'Safe to Spend Today' : 'Spent This Month'}
                  {budgetBase > 0 && (
                    <span
                      className={`normal-case tracking-normal ml-1 ${
                        isOverBudget
                          ? 'text-rose-600 dark:text-rose-400'
                          : isAheadOfPace
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      ·{' '}
                      {isOverBudget
                        ? 'Over Budget'
                        : isAheadOfPace
                        ? 'Ahead of Pace'
                        : 'On Pace'}
                    </span>
                  )}
                </p>
                <p className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-foreground mt-1">
                  {budgetBase > 0
                    ? formatINR(summary.safeToSpendDaily)
                    : formatINR(summary.totalSpent)}
                  {budgetBase > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      / day ({summary.remainingDaysInMonth}d left)
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground font-mono tabular-nums mt-1">
                  {budgetBase > 0 ? (
                    <>
                      Safe monthly buffer:{' '}
                      <span className="font-semibold text-foreground">
                        {formatINR(summary.safeToSpendMonthly)}
                      </span>{' '}
                      after bills &amp; SIPs
                    </>
                  ) : (
                    'Spent this month (Set a budget to unlock Safe-to-Spend)'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenAskAi && (
                  <button
                    type="button"
                    onClick={onOpenAskAi}
                    aria-label="Ask My Finances AI"
                    className="min-h-[40px] px-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-primary flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ask AI</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenBudgetModal()}
                  className="min-h-[40px] px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{hasBudget ? 'Budgets' : 'Set Budget'}</span>
                </button>
              </div>
            </div>

            {/* Overall Budget Bar with Day-of-Month Pace Tick Marker */}
            {hasBudget && (
              <div className="space-y-1.5">
                <div className="relative h-2.5 w-full rounded-full bg-muted overflow-visible">
                  <div
                    style={{ width: `${budgetPct}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOverBudget
                        ? 'bg-rose-500'
                        : isAheadOfPace
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <div
                    style={{
                      left: `${Math.min(
                        99,
                        Math.max(1, summary.dayOfMonthProgressPct)
                      )}%`,
                    }}
                    title={`Month elapsed: ${summary.dayOfMonthProgressPct}%`}
                    className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/80 rounded-full z-10"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono tabular-nums">
                  <span>
                    Spent {formatINR(summary.totalSpent)} of{' '}
                    {formatINR(summary.monthlyBudget)} ({budgetPct}%)
                  </span>
                  <span>Month pace: {summary.dayOfMonthProgressPct}%</span>
                </div>
              </div>
            )}

            {/* Expandable Safe-to-Spend Formula Breakdown */}
            {budgetBase > 0 && (
              <div className="rounded-xl border border-border/70 bg-muted/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFormulaBreakdown((v) => !v)}
                  className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>How Safe-to-Spend is calculated</span>
                  {showFormulaBreakdown ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {showFormulaBreakdown && (
                  <div className="px-3 pb-3 pt-1.5 border-t border-border/50 space-y-1.5 text-xs font-mono tabular-nums">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">
                        {summary.monthlyBudget > 0 ? 'Monthly Budget' : 'Income Base'}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatINR(budgetBase)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">
                        − Variable Spent
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">
                        -{formatINR(summary.totalSpent)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">
                        − Unpaid EMIs, Commitments &amp; Bills
                      </span>
                      <span className="text-amber-600 dark:text-amber-400">
                        -{formatINR(fixedUnpaidTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">
                        − Planned SIPs Remaining
                      </span>
                      <span className="text-violet-600 dark:text-violet-400">
                        -{formatINR(summary.remainingPlannedSips)}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-border/60 flex items-center justify-between font-bold">
                      <span className="text-foreground font-sans">
                        = Safe Buffer ÷ {summary.remainingDaysInMonth} days
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatINR(summary.safeToSpendDaily)}/day
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4-Metric Strip: Income · Spent · Invested/SIP · Due Soon */}
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/70">
              <div>
                <span className="text-[11px] text-muted-foreground block">Income</span>
                <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatINR(summary.totalIncome)}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Spent</span>
                <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-foreground">
                  {formatINR(summary.totalSpent)}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Invested</span>
                <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">
                  {formatINR(summary.totalInvested)}
                </span>
              </div>

              <button
                type="button"
                onClick={onOpenTrackersTab}
                className="text-left rounded-lg hover:bg-muted/50 px-1 -mx-1 transition-colors"
              >
                <span className="text-[11px] text-muted-foreground block">Due Soon</span>
                <span
                  className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
                    dueSoonList.length > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground'
                  }`}
                >
                  {dueSoonList.length > 0 ? formatINR(dueSoonTotal) : '₹0'}
                </span>
              </button>
            </div>
          </div>

          {/* Category Budgets with Pace Tick Markers + Bar/Donut Toggle */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Category Breakdown &amp; Pace
                </h2>
                <p className="text-xs text-muted-foreground">
                  {categoryViewMode === 'bars'
                    ? 'Tick line marks today’s ideal day-of-month pace'
                    : 'Tap any category to inspect transactions'}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <div className="inline-flex items-center p-1 rounded-xl bg-muted/80 border border-border/60">
                  <button
                    type="button"
                    onClick={() => setCategoryViewMode('bars')}
                    aria-label="Progress bars view"
                    className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      categoryViewMode === 'bars'
                        ? 'bg-card text-foreground shadow-xs border border-border/50'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Pace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryViewMode('donut')}
                    aria-label="Category donut view"
                    className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      categoryViewMode === 'donut'
                        ? 'bg-card text-foreground shadow-xs border border-border/50'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <PieChartIcon className="w-3.5 h-3.5" />
                    <span>Donut</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenBudgetModal()}
                  className="h-9 px-3 rounded-xl border border-border/70 bg-card/60 hover:bg-muted text-xs font-semibold text-primary flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  title="Manage Category Limits"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Limits</span>
                </button>
              </div>
            </div>

            {budgetedCategories.length === 0 ? (
              <button
                type="button"
                onClick={() => onOpenBudgetModal()}
                className="w-full min-h-[72px] rounded-xl border border-dashed border-border px-4 py-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <PieChartIcon className="w-5 h-5" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    Set category spending limits
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Track pace ticks and rollover envelopes for Food, Groceries, Shopping &amp; more.
                  </p>
                </div>
              </button>
            ) : categoryViewMode === 'donut' ? (
              <div className="space-y-4">
                {donutCategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Log your first expense this month to see the category donut chart.
                  </p>
                ) : (
                  <OverviewCategoryDonut
                    donutCategories={donutCategories}
                    totalSpent={summary.totalSpent}
                    onSelectCategory={handleCategoryDrilldown}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-3.5">
                {budgetedCategories.slice(0, 7).map((item) => {
                  const rawPct =
                    item.budgetLimit > 0
                      ? Math.round((item.spent / item.budgetLimit) * 100)
                      : 0;
                  const barWidth =
                    item.budgetLimit > 0
                      ? Math.min(100, rawPct)
                      : Math.min(100, item.percentageOfTotalSpend);
                  const overAmount =
                    item.budgetLimit > 0
                      ? Math.max(0, item.spent - item.budgetLimit)
                      : 0;
                  const isCatAheadOfPace =
                    item.budgetLimit > 0 &&
                    item.status !== 'exceeded' &&
                    (item.paceDiffPercentage || 0) > 10;

                  return (
                    <div
                      key={item.category.id}
                      className="w-full text-left space-y-1.5 rounded-xl p-2 -mx-2 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleCategoryDrilldown(item.category.id)}
                          className="flex items-center gap-2.5 min-w-0 text-left"
                        >
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
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                                {item.category.name}
                              </span>
                              {(item.rolloverAmount || 0) > 0 && (
                                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                                  · +{formatINR(item.rolloverAmount || 0)} rollover
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[11px] font-medium block ${
                                item.status === 'exceeded'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isCatAheadOfPace || item.status === 'warning'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {item.budgetLimit <= 0
                                ? `${item.percentageOfTotalSpend}% of total spend`
                                : item.status === 'exceeded'
                                ? `Over by ${formatINR(overAmount)}`
                                : isCatAheadOfPace
                                ? `Ahead of pace (+${item.paceDiffPercentage}%)`
                                : `${formatINR(
                                    Math.max(0, item.budgetLimit - item.spent)
                                  )} left`}
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenBudgetModal(item.category.id)}
                          className="text-right shrink-0 font-mono tabular-nums hover:underline"
                        >
                          <span className="text-xs sm:text-sm font-semibold text-foreground">
                            {formatINR(item.spent)}
                          </span>
                          {item.budgetLimit > 0 ? (
                            <>
                              <span className="text-xs text-muted-foreground">
                                {' '}
                                / {formatINR(item.budgetLimit)}
                              </span>
                              <span className="text-[11px] text-muted-foreground block">
                                {rawPct}%
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-primary block">
                              Set limit
                            </span>
                          )}
                        </button>
                      </div>

                      <div className="relative h-2 w-full rounded-full bg-muted overflow-visible">
                        <div
                          style={{ width: `${barWidth}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.status === 'exceeded'
                              ? 'bg-rose-500'
                              : isCatAheadOfPace || item.status === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        {item.budgetLimit > 0 && (
                          <div
                            style={{
                              left: `${Math.min(
                                99,
                                Math.max(1, summary.dayOfMonthProgressPct)
                              )}%`,
                            }}
                            title={`Today's ideal pace: ${summary.dayOfMonthProgressPct}%`}
                            className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/75 rounded-full"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column on Desktop (7 cols): Visual Analytics Suite + Review Queue + Top 5 Recent Preview */}
        <div className="lg:col-span-7 space-y-4">
          <SpendingTrendChart onOpenBudgetModal={onOpenBudgetModal} />

          {/* Needs Review Queue for Imported SMS/CSV/Receipt Transactions */}
          {reviewQueue.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">
                    Needs Review ({summary.needsReviewCount})
                  </h3>
                </div>
                {onOpenActivityTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({ needsReview: 'only_review' });
                      onOpenActivityTab();
                    }}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Review all in Activity →
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {reviewQueue.map((tx) => {
                  const cat = categoriesMap.get(tx.categoryId);
                  return (
                    <div
                      key={tx.id}
                      className="rounded-xl border border-border bg-card px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="flex items-center gap-2.5 min-w-0 text-left flex-1"
                      >
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: cat ? `${cat.color}18` : 'var(--muted)',
                            color: cat?.color || 'currentColor',
                          }}
                        >
                          <CategoryIcon name={cat?.icon} className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                            {tx.merchantName || tx.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {cat?.name || 'Uncategorized'} · {formatHumanDate(tx.date)}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-foreground">
                          {formatINR(tx.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await approveReviewedTransaction(tx.id);
                            toast.success('Transaction verified');
                          }}
                          className="h-8 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top 5 Recent Activity Preview */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border/60 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Recent Transactions
                </h3>
                <p className="text-xs text-muted-foreground font-mono tabular-nums">
                  Showing latest {recentTransactions.length} of{' '}
                  {allMonthTransactions.length} this month
                </p>
              </div>

              {onOpenActivityTab && (
                <button
                  type="button"
                  onClick={() => onOpenActivityTab()}
                  className="min-h-[36px] px-3 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Open Full Ledger</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {recentTransactions.length === 0 ? (
              <div className="px-6 py-10 text-center space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    No entries recorded for this month
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Log your first expense, income, or SIP investment using the Add button.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAddTransaction}
                  className="inline-flex items-center justify-center min-h-[40px] px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Add First Entry
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentTransactions.map((tx) => {
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
                      className="w-full min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: cat ? `${cat.color}18` : 'var(--muted)',
                            color: cat?.color || 'currentColor',
                          }}
                        >
                          <CategoryIcon name={cat?.icon} className="w-4 h-4" />
                        </span>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {tx.merchantName || tx.title}
                            </p>
                            {tx.type === 'investment' && (
                              <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                                · SIP/Invest
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                            <span>{cat?.name || 'General'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{acc?.name || 'Account'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatHumanDate(tx.date)}</span>
                            {comm && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-rose-600 dark:text-rose-400 font-medium">
                                  Offset: {comm.recipientName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-sm font-bold font-mono tabular-nums ${
                            tx.type === 'income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : tx.type === 'investment'
                              ? 'text-violet-600 dark:text-violet-400'
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
      </div>
    </div>
  );
}
