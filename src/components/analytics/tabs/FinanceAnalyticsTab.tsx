'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { CreditCard, PiggyBank, TrendingDown, Wallet } from 'lucide-react';
import { AnalyticsKpiGrid, type AnalyticsKpiItem } from '@/components/analytics/shared/AnalyticsKpiGrid';
import { buildDonutCategories } from '@/lib/analytics/finance-analytics-helpers';
import { formatINR } from '@/lib/stores/finance-store';
import type { AnalyticsTabProps } from './types';
import {
  AnomaliesObligationsCard,
  CategoryBreakdownCard,
  CreditCardUtilizationCard,
  FriendLedgerCard,
  OutflowAllocationCard,
} from './finance/FinanceBreakdownCards';

const CashflowTrajectoryCard = dynamic(
  () => import('./finance/FinanceCashflowCards').then((m) => ({ default: m.CashflowTrajectoryCard })),
  { ssr: false }
);

function buildFinanceKpiItems(
  finance: AnalyticsTabProps['snapshot']['finance'],
  windowLabel: string
): AnalyticsKpiItem[] {
  return [
    {
      id: 'finance-spend',
      label: 'Total Spend',
      value: formatINR(finance.totalExpense),
      deltaText:
        finance.expenseDeltaPct !== null
          ? `${finance.expenseDeltaPct > 0 ? '+' : ''}${finance.expenseDeltaPct}% vs prev`
          : `${formatINR(finance.dailyAvgBurn)}/day burn`,
      deltaTone:
        finance.expenseDeltaPct === null ? 'neutral' : finance.expenseDeltaPct <= 0 ? 'positive' : 'negative',
      subtitle: windowLabel,
      icon: <TrendingDown className="w-4 h-4" />,
    },
    {
      id: 'finance-net',
      label: 'Net Cashflow',
      value: formatINR(finance.netSavings),
      deltaText: `${finance.savingsRatePct}% savings rate`,
      deltaTone: finance.netSavings >= 0 ? 'positive' : 'negative',
      subtitle:
        finance.monthlySummary.safeToSpendDaily > 0
          ? `${formatINR(finance.monthlySummary.safeToSpendDaily)}/d safe`
          : undefined,
      icon: <PiggyBank className="w-4 h-4" />,
    },
    {
      id: 'finance-networth',
      label: 'Net Worth',
      value: formatINR(finance.netWorth.netWorth),
      subtitle: `Liquid ${formatINR(finance.netWorth.liquidAssets)}`,
      deltaText: finance.netWorth.totalLiabilities > 0 ? `${formatINR(finance.netWorth.totalLiabilities)} debt` : 'Zero debt',
      deltaTone: finance.netWorth.totalLiabilities > 0 ? 'neutral' : 'positive',
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      id: 'finance-cards',
      label: 'Card Utilization',
      value: `${finance.totalCardUtilizationPct}%`,
      deltaText:
        finance.creditCardSummaries.length > 0
          ? `${finance.creditCardSummaries.length} active card${finance.creditCardSummaries.length === 1 ? '' : 's'}`
          : 'No credit cards',
      deltaTone: finance.totalCardUtilizationPct > 50 ? 'negative' : 'positive',
      icon: <CreditCard className="w-4 h-4" />,
    },
  ];
}

function FinanceAnalyticsTabInner({ snapshot }: AnalyticsTabProps) {
  const router = useRouter();
  const { finance } = snapshot;
  const [cashflowMode, setCashflowMode] = useState<'burn' | 'runway'>('burn');
  const [categoryMode, setCategoryMode] = useState<'pace' | 'donut'>('pace');

  const kpiItems = useMemo(() => buildFinanceKpiItems(finance, snapshot.window.label), [finance, snapshot.window.label]);
  const donutCategories = useMemo(() => buildDonutCategories(finance.categorySpend), [finance.categorySpend]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <AnalyticsKpiGrid items={kpiItems} />

      <CashflowTrajectoryCard
        finance={finance}
        dateSpanLabel={snapshot.window.dateSpanLabel}
        cashflowMode={cashflowMode}
        onModeChange={setCashflowMode}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdownCard
          finance={finance}
          windowLabel={snapshot.window.label}
          categoryMode={categoryMode}
          onModeChange={setCategoryMode}
          donutCategories={donutCategories}
          onSelectCategory={() => router.push('/finance?tab=activity')}
        />

        <div className="space-y-4">
          <OutflowAllocationCard finance={finance} />
          <CreditCardUtilizationCard finance={finance} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnomaliesObligationsCard finance={finance} />
        <FriendLedgerCard finance={finance} />
      </div>
    </div>
  );
}

export default React.memo(FinanceAnalyticsTabInner);
