'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { FinanceTransaction } from '@/lib/types';
import { toast } from 'sonner';
import { OverviewAnomaliesStrip, SafeToSpendHeroCard, type AnomalyAlertItem } from './overview/OverviewAlertsAndHero';
import { OverviewCategorySection } from './overview/OverviewCategorySection';
import { OverviewRecentTransactions, OverviewReviewQueue } from './overview/OverviewRightColumn';

const SpendingTrendChart = dynamic(
  () => import('./SpendingTrendChart').then((m) => ({ default: m.SpendingTrendChart })),
  {
    ssr: false,
    loading: () => <div className="h-[310px] rounded-2xl border border-border bg-card animate-pulse" />,
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

function useOverviewViewModel() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const transactions = useFinanceStore((s) => s.transactions);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getUpcomingFinancialObligations = useFinanceStore((s) => s.getUpcomingFinancialObligations);
  const getFilteredTransactions = useFinanceStore((s) => s.getFilteredTransactions);
  const getSpendingAnomalies = useFinanceStore((s) => s.getSpendingAnomalies);

  const summary = getMonthlySummary(selectedMonth);
  const anomalies = useMemo(
    () => getSpendingAnomalies(selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getSpendingAnomalies, selectedMonth, transactions, accounts]
  );
  const dueSoonList = getUpcomingFinancialObligations(10);
  const allMonthTransactions = getFilteredTransactions(selectedMonth);

  const hasBudget = summary.monthlyBudget > 0;
  const budgetBase = hasBudget ? summary.monthlyBudget : summary.expectedIncome > 0 ? summary.expectedIncome : summary.totalIncome;
  const budgetPct = hasBudget ? Math.min(100, Math.round((summary.totalSpent / summary.monthlyBudget) * 100)) : 0;
  const isOverBudget = hasBudget && summary.totalSpent > summary.monthlyBudget;

  return {
    summary,
    anomalies,
    dueSoonCount: dueSoonList.length,
    dueSoonTotal: dueSoonList.reduce((acc, item) => acc + item.amount, 0),
    allMonthCount: allMonthTransactions.length,
    recentTransactions: allMonthTransactions.slice(0, 5),
    reviewQueue: allMonthTransactions.filter((tx) => tx.needsReview).slice(0, 4),
    categoriesMap: new Map(categories.map((c) => [c.id, c])),
    accountsMap: new Map(accounts.map((a) => [a.id, a])),
    commitmentsMap: new Map(commitments.map((c) => [c.id, c])),
    hasBudget,
    budgetBase,
    budgetPct,
    isOverBudget,
    isAheadOfPace: hasBudget && !isOverBudget && budgetPct > summary.dayOfMonthProgressPct + 8,
    budgetedCategories: summary.categoryBreakdown.filter((item) => item.budgetLimit > 0 || item.spent > 0),
    donutCategories: summary.categoryBreakdown.filter((item) => item.spent > 0),
    fixedUnpaidTotal:
      summary.remainingUnpaidEmis + summary.remainingUnpaidCommitments + summary.remainingUnpaidBills + summary.plannedDebtInstallmentsDue,
  };
}

export function OverviewTab({
  onEditTransaction,
  onOpenBudgetModal,
  onOpenTrackersTab,
  onOpenActivityTab,
  onOpenAddTransaction,
  onOpenAskAi,
}: OverviewTabProps) {
  const setFilters = useFinanceStore((s) => s.setFilters);
  const approveReviewedTransaction = useFinanceStore((s) => s.approveReviewedTransaction);
  const vm = useOverviewViewModel();

  const handleCategoryDrilldown = (categoryId: string) => {
    setFilters({ categoryId });
    onOpenActivityTab?.(categoryId);
  };

  const handleAlertAction = (alert: AnomalyAlertItem) => {
    if (alert.actionTarget === 'activity') {
      if (alert.kind === 'review_backlog') setFilters({ needsReview: 'only_review' });
      onOpenActivityTab?.();
    } else if (alert.actionTarget === 'trackers') {
      onOpenTrackersTab();
    } else if (alert.actionTarget === 'budgets') {
      onOpenBudgetModal();
    }
  };

  return (
    <div className="space-y-5">
      <OverviewAnomaliesStrip anomalies={vm.anomalies} onAlertAction={handleAlertAction} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          <SafeToSpendHeroCard
            summary={vm.summary}
            hasBudget={vm.hasBudget}
            budgetBase={vm.budgetBase}
            budgetPct={vm.budgetPct}
            isOverBudget={vm.isOverBudget}
            isAheadOfPace={vm.isAheadOfPace}
            fixedUnpaidTotal={vm.fixedUnpaidTotal}
            dueSoonCount={vm.dueSoonCount}
            dueSoonTotal={vm.dueSoonTotal}
            onOpenBudgetModal={() => onOpenBudgetModal()}
            onOpenTrackersTab={onOpenTrackersTab}
            onOpenAskAi={onOpenAskAi}
          />
          <OverviewCategorySection
            budgetedCategories={vm.budgetedCategories}
            donutCategories={vm.donutCategories}
            totalSpent={vm.summary.totalSpent}
            dayOfMonthProgressPct={vm.summary.dayOfMonthProgressPct}
            onSelectCategory={handleCategoryDrilldown}
            onOpenBudgetModal={onOpenBudgetModal}
          />
        </div>

        <div className="lg:col-span-7 space-y-4">
          <SpendingTrendChart onOpenBudgetModal={onOpenBudgetModal} />
          <OverviewReviewQueue
            reviewQueue={vm.reviewQueue}
            needsReviewCount={vm.summary.needsReviewCount}
            categoriesMap={vm.categoriesMap}
            onEditTransaction={onEditTransaction}
            onApproveTransaction={async (txId) => {
              await approveReviewedTransaction(txId);
              toast.success('Transaction verified');
            }}
            onReviewAll={
              onOpenActivityTab
                ? () => {
                    setFilters({ needsReview: 'only_review' });
                    onOpenActivityTab();
                  }
                : undefined
            }
          />
          <OverviewRecentTransactions
            recentTransactions={vm.recentTransactions}
            totalMonthCount={vm.allMonthCount}
            categoriesMap={vm.categoriesMap}
            accountsMap={vm.accountsMap}
            commitmentsMap={vm.commitmentsMap}
            onEditTransaction={onEditTransaction}
            onOpenAddTransaction={onOpenAddTransaction}
            onOpenActivityTab={onOpenActivityTab ? () => onOpenActivityTab() : undefined}
          />
        </div>
      </div>
    </div>
  );
}
