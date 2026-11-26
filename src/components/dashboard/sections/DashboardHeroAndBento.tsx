'use client';

import React from 'react';
import { isAIEnabled } from '@/lib/ai-features-flag';
import { HabitOverview } from '../habit-overview';
import { FocusGoal } from '../focus-goal';
import { TodayTasksWidget } from '../TodayTasksWidget';
import { AICoachWidget } from '../AICoachWidget';
import { WeeklyReviewWidget } from '../WeeklyReviewWidget';
import { FinanceOverviewWidget } from '../FinanceOverviewWidget';
import { useFeedback } from '@/hooks/use-feedback';
import { toast } from 'sonner';
import { DashboardMomentumHero } from './DashboardMomentumHero';
import { DashboardFinanceHero } from './DashboardFinanceHero';
import type { useDashboardViewModel } from './useDashboardViewModel';

function addCoreWidgets(
  widgets: Record<string, React.ReactNode>,
  vm: ReturnType<typeof useDashboardViewModel>
) {
  const { workspaceLens, isFinanceEnabled, isTasksEnabled, habitSlice } = vm;
  const showHabits = workspaceLens === 'all' || workspaceLens === 'habits';
  const showFinance = workspaceLens === 'all' || workspaceLens === 'finance';
  if (showHabits) {
    widgets['habit-overview'] = <HabitOverview habits={habitSlice.habits} completions={habitSlice.completions} onToggle={habitSlice.toggle} />;
  }
  if (isFinanceEnabled && showFinance) {
    widgets['finance-overview'] = <FinanceOverviewWidget />;
  }
  if (workspaceLens !== 'finance' && isTasksEnabled) {
    widgets['today-tasks'] = <TodayTasksWidget isHydrated={true} />;
  }
}

export function buildBentoWidgets(
  vm: ReturnType<typeof useDashboardViewModel>,
  onOpenAskAi: () => void
): Record<string, React.ReactNode> {
  const widgets: Record<string, React.ReactNode> = {};
  addCoreWidgets(widgets, vm);

  if (vm.isGoalsEnabled) {
    widgets['focus-goal'] = (
      <FocusGoal goals={vm.focusGoals} getMilestones={vm.goalSlice.getGoalMilestones} getStats={vm.goalSlice.getGoalStats} onToggleMilestone={(id) => vm.goalSlice.toggleMilestoneComplete(id)} />
    );
  }
  if (isAIEnabled()) {
    widgets['ai-coach'] = <AICoachWidget onOpenAskFinances={vm.isFinanceEnabled ? onOpenAskAi : undefined} />;
  }
  if (vm.workspaceLens !== 'finance') {
    widgets['weekly-review'] = <WeeklyReviewWidget />;
  }
  return widgets;
}

function computeBudgetPaceFlags(totalSpent: number, monthlyBudget: number, dayProgressPct: number) {
  const hasBudget = monthlyBudget > 0;
  const budgetPct = hasBudget ? Math.min(100, Math.round((totalSpent / monthlyBudget) * 100)) : 0;
  const isOverBudget = hasBudget && totalSpent > monthlyBudget;
  const isAheadOfPace = hasBudget && !isOverBudget && budgetPct > dayProgressPct + 8;
  return { hasBudget, budgetPct, isOverBudget, isAheadOfPace };
}

export function DashboardHeroRow(params: {
  vm: ReturnType<typeof useDashboardViewModel>;
  todayStr: string;
  onOpenQuickExpense: () => void;
  onOpenSms: () => void;
  onOpenAskAi: () => void;
}) {
  const { vm, todayStr, onOpenQuickExpense, onOpenSms, onOpenAskAi } = params;
  const feedback = useFeedback();
  const { hasBudget, budgetPct, isOverBudget, isAheadOfPace } = computeBudgetPaceFlags(
    vm.financeSummary.totalSpent,
    vm.financeSummary.monthlyBudget,
    vm.financeSummary.dayOfMonthProgressPct
  );
  const dueSoonTotal = vm.dueSoonObligations.reduce((s, o) => s + o.amount, 0);

  const showHabitHero = vm.workspaceLens === 'all' || vm.workspaceLens === 'habits';
  const showFinanceHero = vm.isFinanceEnabled && (vm.workspaceLens === 'all' || vm.workspaceLens === 'finance');
  const bothHeroesVisible = showHabitHero && showFinanceHero;
  const rowCls = bothHeroesVisible
    ? 'flex overflow-x-auto snap-x snap-mandatory gap-4 pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 lg:pb-0 lg:grid lg:grid-cols-12 lg:gap-5 items-stretch'
    : 'grid grid-cols-1 gap-5';

  return (
    <div className={rowCls}>
      {showHabitHero && (
        <DashboardMomentumHero
          bothHeroesVisible={bothHeroesVisible} todayScore={vm.todayScore}
          restingOrQuotaMetCount={vm.restingOrQuotaMetCount} isTasksEnabled={vm.isTasksEnabled}
          monthlyPct={vm.monthlyProgress.percentage} monthlyTrend={vm.monthlyTrend}
          isGoalsEnabled={vm.isGoalsEnabled} activeGoalsCount={vm.activeGoalsCount}
          upcomingDeadlinesCount={vm.upcomingDeadlines.length} bestStreak={vm.currentMaxStreak}
          nextUpHabits={vm.nextUpHabits}
          onCompleteHabit={async (item) => { feedback.complete(); await vm.habitSlice.toggle(item.id, todayStr); toast.success(`Completed ${item.name}`); }}
          onRestHabit={async (item) => { feedback.tap(); await vm.habitSlice.markRestDay(item.id, todayStr); toast.info(`Marked ${item.name} as Rest Day`); }}
        />
      )}
      {showFinanceHero && (
        <DashboardFinanceHero
          bothHeroesVisible={bothHeroesVisible} financeSummary={vm.financeSummary}
          netWorth={vm.netWorthSummary.netWorth} dailyPacePoints={vm.dailyPacePoints}
          dueSoonCount={vm.dueSoonObligations.length} dueSoonTotal={dueSoonTotal}
          hasBudget={hasBudget} budgetPct={budgetPct} isOverBudget={isOverBudget} isAheadOfPace={isAheadOfPace}
          onOpenQuickExpense={onOpenQuickExpense} onOpenSms={onOpenSms} onOpenAskAi={onOpenAskAi}
        />
      )}
    </div>
  );
}
