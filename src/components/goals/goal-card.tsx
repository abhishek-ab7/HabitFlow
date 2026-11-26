'use client';

import { memo, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDeadlineStatus } from '@/lib/calculations';
import { useFeedback } from '@/hooks/use-feedback';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import type { Goal, GoalStats, Milestone } from '@/lib/types';
import {
  AREA_STYLES,
  PRIORITY_STYLES,
  computeFinancialProgressView,
  computeFitnessProgressView,
  getDeadlineColorClass,
  getUnifiedGoalStatus,
} from './card/goal-card-helpers';
import { GoalCardActionsMenu } from './card/GoalCardActionsMenu';
import { GoalCardListRow } from './card/GoalCardListRow';
import { GoalCardGridItem } from './card/GoalCardGridItem';
import { GoalRoadmapModal } from './card/GoalRoadmapModal';

interface GoalCardProps {
  goal: Goal;
  milestones: Milestone[];
  stats: GoalStats;
  viewMode?: 'grid' | 'list';
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onArchive: (goalId: string) => void;
  onSetFocus: (goalId: string) => void;
  onToggleMilestone: (milestoneId: string) => void;
  onAddMilestone: (goalId: string) => void;
}

const EMPTY_ACCOUNTS: never[] = [];
const EMPTY_DEBTS: never[] = [];
const EMPTY_EMIS: never[] = [];
const EMPTY_SIPS: never[] = [];
const EMPTY_DAILY_LOGS: never[] = [];
const EMPTY_WORKOUTS: never[] = [];

function useGoalFinanceProgress(financialLink: Goal['financialLink']) {
  const hasFinanceLink = Boolean(financialLink?.targetAmount);
  const { accounts, debtRecords, emiTrackers, sipPlans, getNetWorthSummary, getMonthlySummary } = useFinanceStore(
    useShallow((s) => ({
      accounts: hasFinanceLink ? s.accounts : EMPTY_ACCOUNTS,
      debtRecords: hasFinanceLink ? s.debtRecords : EMPTY_DEBTS,
      emiTrackers: hasFinanceLink ? s.emiTrackers : EMPTY_EMIS,
      sipPlans: hasFinanceLink ? s.sipPlans : EMPTY_SIPS,
      getNetWorthSummary: s.getNetWorthSummary,
      getMonthlySummary: s.getMonthlySummary,
    }))
  );

  return useMemo(
    () => computeFinancialProgressView({ financialLink, accounts, debtRecords, emiTrackers, sipPlans, getNetWorthSummary, getMonthlySummary }),
    [financialLink, accounts, debtRecords, emiTrackers, sipPlans, getNetWorthSummary, getMonthlySummary]
  );
}

function useGoalFitnessProgress(fitnessLink: Goal['fitnessLink']) {
  const hasFitnessLink = Boolean(fitnessLink?.targetValue);
  const fitnessProfile = useFitnessStore((s) => (hasFitnessLink ? s.profile : null));
  const fitnessDailyLogs = useFitnessStore((s) => (hasFitnessLink ? s.dailyLogs : EMPTY_DAILY_LOGS));
  const fitnessWorkoutSessions = useFitnessStore((s) => (hasFitnessLink ? s.workoutSessions : EMPTY_WORKOUTS));

  return useMemo(
    () => computeFitnessProgressView({ fitnessLink, profile: fitnessProfile, dailyLogs: fitnessDailyLogs, workoutSessions: fitnessWorkoutSessions }),
    [fitnessLink, fitnessProfile, fitnessDailyLogs, fitnessWorkoutSessions]
  );
}

export const GoalCard = memo(function GoalCard({
  goal, milestones, stats, viewMode = 'grid', onEdit, onDelete, onArchive, onSetFocus, onToggleMilestone, onAddMilestone,
}: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [rippleMilestone, setRippleMilestone] = useState<string | null>(null);
  const feedback = useFeedback();

  const fitnessProgress = useGoalFitnessProgress(goal.fitnessLink);
  const financialProgress = useGoalFinanceProgress(goal.financialLink);
  const deadlineInfo = useMemo(() => getDeadlineStatus(goal.deadline), [goal.deadline]);
  const unifiedStatus = useMemo(() => getUnifiedGoalStatus(goal.status, stats.isOnTrack), [goal.status, stats.isOnTrack]);
  const nextMilestone = useMemo(() => milestones.find((m) => !m.completed), [milestones]);

  const totalDays = stats.totalDays || 1;
  const elapsedPercentage = Math.min(100, Math.max(0, (stats.daysElapsed / totalDays) * 100));
  const deadlineColorClass = getDeadlineColorClass(deadlineInfo.color);

  const handleMilestoneToggle = (milestoneId: string) => {
    const wasCompleted = Boolean(milestones.find((m) => m.id === milestoneId)?.completed);
    if (wasCompleted) feedback.uncheck();
    else if (stats.milestonesCompleted + 1 >= stats.milestonesTotal && stats.milestonesTotal > 0) feedback.milestone();
    else feedback.complete();

    setRippleMilestone(milestoneId);
    onToggleMilestone(milestoneId);
    setTimeout(() => setRippleMilestone(null), 500);
  };

  const actionsMenu = (
    <GoalCardActionsMenu
      goal={goal}
      onSetFocus={() => onSetFocus(goal.id)}
      onEdit={() => onEdit(goal)}
      onAddMilestone={() => onAddMilestone(goal.id)}
      onArchive={() => onArchive(goal.id)}
      onDelete={() => { feedback.warning(); onDelete(goal.id); }}
    />
  );

  const commonProps = {
    goal, milestones, stats,
    areaStyle: AREA_STYLES[goal.areaOfLife],
    priorityStyle: PRIORITY_STYLES[goal.priority],
    unifiedStatus,
    deadlineLabel: deadlineInfo.label,
    deadlineColorClass,
    financialProgress,
    fitnessProgress,
    expanded,
    setExpanded,
    onOpenDetails: () => setDetailsModalOpen(true),
    actionsMenu,
    rippleMilestone,
    onToggleMilestone: handleMilestoneToggle,
    onAddMilestone: () => onAddMilestone(goal.id),
  };

  return (
    <>
      {viewMode === 'list' ? (
        <GoalCardListRow {...commonProps} />
      ) : (
        <GoalCardGridItem {...commonProps} nextMilestone={nextMilestone} />
      )}
      <GoalRoadmapModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        goal={goal}
        milestones={milestones}
        stats={stats}
        deadlineLabel={deadlineInfo.label}
        unifiedStatus={unifiedStatus}
        elapsedPercentage={elapsedPercentage}
        onToggleMilestone={onToggleMilestone}
      />
    </>
  );
});
