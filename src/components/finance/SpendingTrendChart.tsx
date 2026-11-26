'use client';

import React, { useState, useMemo } from 'react';
import { BarChart3, Compass, GitFork, TrendingUp } from 'lucide-react';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import { ForecastChartPanel, PaceChartPanel } from './charts/PaceAndForecastCharts';
import { buildSankeyModel, SankeyChartPanel, TrendBarChartPanel } from './charts/SankeyAndBarCharts';

interface SpendingTrendChartProps {
  onOpenBudgetModal: (focusCategoryId?: string) => void;
}

type AnalyticsChartMode = 'pace' | 'forecast' | 'sankey' | 'trend';

const CHART_TABS: Array<{ id: AnalyticsChartMode; label: string }> = [
  { id: 'pace', label: 'Pace' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'sankey', label: 'Cash Flow' },
  { id: 'trend', label: '6M Trend' },
];

const CHART_ICON_MAP: Record<AnalyticsChartMode, React.ReactNode> = {
  pace: <TrendingUp className="w-4 h-4" />,
  forecast: <Compass className="w-4 h-4" />,
  sankey: <GitFork className="w-4 h-4" />,
  trend: <BarChart3 className="w-4 h-4" />,
};

function resolveChartTitle(mode: AnalyticsChartMode, forecastHorizon: number, timeframe: 'monthly' | 'yearly'): string {
  if (mode === 'pace') return 'Cumulative Daily Spending Pace';
  if (mode === 'forecast') return `${forecastHorizon}-Day Cash-Flow Runway`;
  if (mode === 'sankey') return 'Sankey Cash Flow Allocation';
  return timeframe === 'monthly' ? '6-Month Spending vs. Budget' : 'Yearly Spending vs. Budget';
}

function useSpendingTrendSeries(params: {
  chartMode: AnalyticsChartMode;
  forecastHorizon: 30 | 60 | 90;
  includeBurn: boolean;
  timeframe: 'monthly' | 'yearly';
  selectedCategoryId: string;
}) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const accounts = useFinanceStore((s) => s.accounts);
  const getSixMonthSpendingTrends = useFinanceStore((s) => s.getSixMonthSpendingTrends);
  const getYearlySpendingTrends = useFinanceStore((s) => s.getYearlySpendingTrends);
  const getDailySpendingPace = useFinanceStore((s) => s.getDailySpendingPace);
  const getCashFlowForecast = useFinanceStore((s) => s.getCashFlowForecast);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);

  const summary = useMemo(
    () => getMonthlySummary(selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getMonthlySummary, selectedMonth, transactions, categories, budgets]
  );
  const paceData = useMemo(
    () => (params.chartMode === 'pace' ? getDailySpendingPace(selectedMonth) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.chartMode, getDailySpendingPace, selectedMonth, transactions, budgets, categories]
  );
  const forecastData = useMemo(
    () => (params.chartMode === 'forecast' ? getCashFlowForecast(params.forecastHorizon, params.includeBurn).points : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.chartMode, getCashFlowForecast, params.forecastHorizon, params.includeBurn, accounts, transactions, budgets]
  );
  const trendData = useMemo(
    () =>
      params.chartMode === 'trend'
        ? params.timeframe === 'monthly'
          ? getSixMonthSpendingTrends(selectedMonth, params.selectedCategoryId)
          : getYearlySpendingTrends(selectedMonth, params.selectedCategoryId, 5)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.chartMode, params.timeframe, getSixMonthSpendingTrends, getYearlySpendingTrends, selectedMonth, params.selectedCategoryId, transactions, categories, budgets]
  );
  return { categories, summary, paceData, forecastData, trendData };
}

function findLatestPacePoint(paceData: ReturnType<ReturnType<typeof useFinanceStore.getState>['getDailySpendingPace']>) {
  for (let i = paceData.length - 1; i >= 0; i--) {
    if (paceData[i].cumulativeSpent !== null) return paceData[i];
  }
  return paceData[0];
}

function formatChartSubtitle(params: {
  chartMode: AnalyticsChartMode;
  latestPacePoint: ReturnType<typeof findLatestPacePoint>;
  forecastHorizon: number;
  forecastEndBalance: number;
  forecastMinPoint: { projectedBalance: number } | null;
  sankeyModel: ReturnType<typeof buildSankeyModel>;
  periodAvg: number;
  totalPeriodSpent: number;
  timeframe: 'monthly' | 'yearly';
}): string {
  const { chartMode, latestPacePoint, forecastHorizon, forecastEndBalance, forecastMinPoint, sankeyModel, periodAvg, totalPeriodSpent, timeframe } = params;
  if (chartMode === 'pace') {
    if (!latestPacePoint || latestPacePoint.cumulativeSpent === null) return 'Cumulative burn vs linear monthly trajectory';
    const targetSuffix = latestPacePoint.idealCumulativeBudget > 0 ? ` vs ${formatINR(latestPacePoint.idealCumulativeBudget)} target` : '';
    return `Day ${latestPacePoint.day} · Burn ${formatINR(latestPacePoint.cumulativeSpent)}${targetSuffix}`;
  }
  if (chartMode === 'forecast') {
    const lowSuffix = forecastMinPoint ? ` · Low ${formatINR(forecastMinPoint.projectedBalance)}` : '';
    return `Projected Day ${forecastHorizon}: ${formatINR(forecastEndBalance)}${lowSuffix}`;
  }
  if (chartMode === 'sankey') return `${sankeyModel.inflowLabel}: ${formatINR(sankeyModel.inflowBase)} → ${sankeyModel.targets.length} buckets`;
  return `Avg ${formatINR(periodAvg)}/${timeframe === 'monthly' ? 'mo' : 'yr'} · Total ${formatINR(totalPeriodSpent)}`;
}

function SpendingTrendHeader(params: {
  chartMode: AnalyticsChartMode;
  setChartMode: (m: AnalyticsChartMode) => void;
  forecastHorizon: number;
  timeframe: 'monthly' | 'yearly';
  subtitle: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {CHART_ICON_MAP[params.chartMode]}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground truncate">
            {resolveChartTitle(params.chartMode, params.forecastHorizon, params.timeframe)}
          </h2>
          <p className="text-xs text-muted-foreground font-mono tabular-nums truncate">{params.subtitle}</p>
        </div>
      </div>

      <div role="group" aria-label="Visual analytics chart mode" className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted shrink-0">
        {CHART_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={params.chartMode === tab.id}
            onClick={() => params.setChartMode(tab.id)}
            className={`min-h-[34px] px-2 sm:px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${params.chartMode === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SpendingTrendBody(params: {
  chartMode: AnalyticsChartMode;
  paceData: ReturnType<typeof useSpendingTrendSeries>['paceData'];
  isAheadOfPace: boolean;
  monthlyBudget: number;
  onOpenBudgetModal: () => void;
  forecastHorizon: 30 | 60 | 90;
  setForecastHorizon: (h: 30 | 60 | 90) => void;
  includeBurn: boolean;
  setIncludeBurn: (v: boolean) => void;
  forecastData: ReturnType<typeof useSpendingTrendSeries>['forecastData'];
  forecastMinPoint: ReturnType<typeof useSpendingTrendSeries>['forecastData'][number] | null;
  sankeyModel: ReturnType<typeof buildSankeyModel>;
  hoveredSankeyNode: string | null;
  setHoveredSankeyNode: (n: string | null) => void;
  timeframe: 'monthly' | 'yearly';
  setTimeframe: (t: 'monthly' | 'yearly') => void;
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  expenseCategories: ReturnType<typeof useSpendingTrendSeries>['categories'];
  activeCategory: ReturnType<typeof useSpendingTrendSeries>['categories'][number] | undefined;
  trendData: ReturnType<typeof useSpendingTrendSeries>['trendData'];
}) {
  const { chartMode } = params;
  return (
    <>
      {chartMode === 'pace' && <PaceChartPanel paceData={params.paceData} isAheadOfPace={params.isAheadOfPace} monthlyBudget={params.monthlyBudget} onOpenBudgetModal={params.onOpenBudgetModal} />}
      {chartMode === 'forecast' && <ForecastChartPanel forecastHorizon={params.forecastHorizon} setForecastHorizon={params.setForecastHorizon} includeBurn={params.includeBurn} setIncludeBurn={params.setIncludeBurn} forecastData={params.forecastData} forecastMinPoint={params.forecastMinPoint} />}
      {chartMode === 'sankey' && <SankeyChartPanel sankeyModel={params.sankeyModel} hoveredSankeyNode={params.hoveredSankeyNode} setHoveredSankeyNode={params.setHoveredSankeyNode} />}
      {chartMode === 'trend' && (
        <TrendBarChartPanel
          timeframe={params.timeframe}
          setTimeframe={params.setTimeframe}
          selectedCategoryId={params.selectedCategoryId}
          setSelectedCategoryId={params.setSelectedCategoryId}
          expenseCategories={params.expenseCategories}
          activeCategory={params.activeCategory}
          trendData={params.trendData}
          hasAnyBudget={params.trendData.some((d) => d.budget > 0)}
        />
      )}
    </>
  );
}

function computeIsAheadOfPace(paceData: ReturnType<typeof useSpendingTrendSeries>['paceData']) {
  const latestPacePoint = findLatestPacePoint(paceData);
  const isAheadOfPace = Boolean(
    latestPacePoint &&
      latestPacePoint.cumulativeSpent !== null &&
      latestPacePoint.idealCumulativeBudget > 0 &&
      latestPacePoint.cumulativeSpent > latestPacePoint.idealCumulativeBudget * 1.05
  );
  return { latestPacePoint, isAheadOfPace };
}

function computeForecastStats(forecastData: ReturnType<typeof useSpendingTrendSeries>['forecastData']) {
  const forecastMinPoint =
    forecastData.length > 0 ? forecastData.reduce((min, p) => (p.projectedBalance < min.projectedBalance ? p : min)) : null;
  const forecastEndBalance = forecastData.length > 0 ? forecastData[forecastData.length - 1].projectedBalance : 0;
  return { forecastMinPoint, forecastEndBalance };
}

function useSpendingTrendViewModel(params: {
  chartMode: AnalyticsChartMode;
  forecastHorizon: 30 | 60 | 90;
  includeBurn: boolean;
  timeframe: 'monthly' | 'yearly';
  selectedCategoryId: string;
}) {
  const { categories, summary, paceData, forecastData, trendData } = useSpendingTrendSeries(params);
  const expenseCategories = useMemo(
    () => categories.filter((c) => (c.type === 'expense' || c.type === 'both') && !c.deletedAt),
    [categories]
  );
  const activeCategory = params.selectedCategoryId !== 'all' ? expenseCategories.find((c) => c.id === params.selectedCategoryId) : undefined;
  const { latestPacePoint, isAheadOfPace } = useMemo(() => computeIsAheadOfPace(paceData), [paceData]);
  const { forecastMinPoint, forecastEndBalance } = useMemo(() => computeForecastStats(forecastData), [forecastData]);
  const sankeyModel = useMemo(() => buildSankeyModel(summary), [summary]);
  const totalPeriodSpent = trendData.reduce((sum, d) => sum + d.spent, 0);
  const periodAvg = trendData.length > 0 ? Math.round(totalPeriodSpent / trendData.length) : 0;
  const subtitle = formatChartSubtitle({
    chartMode: params.chartMode,
    latestPacePoint,
    forecastHorizon: params.forecastHorizon,
    forecastEndBalance,
    forecastMinPoint,
    sankeyModel,
    periodAvg,
    totalPeriodSpent,
    timeframe: params.timeframe,
  });

  return {
    summary, paceData, forecastData, trendData,
    expenseCategories, activeCategory, isAheadOfPace, forecastMinPoint, sankeyModel, subtitle,
  };
}

export function SpendingTrendChart({ onOpenBudgetModal }: SpendingTrendChartProps) {
  const [chartMode, setChartMode] = useState<AnalyticsChartMode>('pace');
  const [forecastHorizon, setForecastHorizon] = useState<30 | 60 | 90>(30);
  const [includeBurn, setIncludeBurn] = useState(true);
  const [timeframe, setTimeframe] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [hoveredSankeyNode, setHoveredSankeyNode] = useState<string | null>(null);

  const vm = useSpendingTrendViewModel({ chartMode, forecastHorizon, includeBurn, timeframe, selectedCategoryId });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <SpendingTrendHeader chartMode={chartMode} setChartMode={setChartMode} forecastHorizon={forecastHorizon} timeframe={timeframe} subtitle={vm.subtitle} />
      <SpendingTrendBody
        chartMode={chartMode}
        paceData={vm.paceData}
        isAheadOfPace={vm.isAheadOfPace}
        monthlyBudget={vm.summary.monthlyBudget}
        onOpenBudgetModal={() => onOpenBudgetModal()}
        forecastHorizon={forecastHorizon}
        setForecastHorizon={setForecastHorizon}
        includeBurn={includeBurn}
        setIncludeBurn={setIncludeBurn}
        forecastData={vm.forecastData}
        forecastMinPoint={vm.forecastMinPoint}
        sankeyModel={vm.sankeyModel}
        hoveredSankeyNode={hoveredSankeyNode}
        setHoveredSankeyNode={setHoveredSankeyNode}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        selectedCategoryId={selectedCategoryId}
        setSelectedCategoryId={setSelectedCategoryId}
        expenseCategories={vm.expenseCategories}
        activeCategory={vm.activeCategory}
        trendData={vm.trendData}
      />
    </div>
  );
}
