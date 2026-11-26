import { createMilestone } from '../db';
import { calculateGoalStats } from '../calculations';
import { getLocalIsoDate } from '../finance/credit-card-cycles';
import { calculateFitnessGoalProgress } from '../fitness/shared-analytics';
import { getSyncEngine } from '../sync';
import type { Goal, Milestone } from '../types';
import { useFitnessStore } from './fitness';

export interface LoadCheckInput {
  force: boolean;
  hasLoaded: boolean;
  loadedUserId: string | null;
  uid: string;
}

export function shouldSkipGoalStoreLoad(input: LoadCheckInput): boolean {
  return !input.force && input.hasLoaded && input.loadedUserId === input.uid;
}

export async function createGoalMilestones(
  goalId: string,
  titles: string[],
  userId: string
): Promise<Milestone[]> {
  const created: Milestone[] = [];
  for (const title of titles) {
    const trimmed = title.trim();
    if (!trimmed) continue;
    const milestone = await createMilestone({ goalId, title: trimmed, userId });
    created.push(milestone);
  }
  return created;
}

export async function syncNewGoalAndMilestones(
  goal: Goal,
  milestones: Milestone[]
): Promise<void> {
  try {
    const syncEngine = getSyncEngine();
    await syncEngine.pushGoal(goal);
    for (const milestone of milestones) {
      await syncEngine.pushMilestone(milestone);
    }
  } catch (error) {
    console.error('Failed to sync goal:', error);
  }
}

export function emptyGoalStats(goalId: string): ReturnType<typeof calculateGoalStats> {
  return {
    goalId,
    progress: 0,
    milestonesCompleted: 0,
    milestonesTotal: 0,
    daysRemaining: 0,
    daysElapsed: 0,
    totalDays: 0,
    isOnTrack: false,
  };
}

function computeProjectedCompletion(
  baseStats: ReturnType<typeof calculateGoalStats>,
  effectiveProgress: number
): number | undefined {
  const canProject =
    baseStats.milestonesTotal === 0 &&
    baseStats.daysElapsed > 0 &&
    effectiveProgress > 0;
  if (!canProject) return baseStats.projectedCompletion;

  const progressRate = effectiveProgress / baseStats.daysElapsed;
  return Math.min(
    100,
    Math.round(progressRate * (baseStats.daysElapsed + baseStats.daysRemaining))
  );
}

export function computeGoalStatsWithFitness(
  goal: Goal,
  milestones: Milestone[]
): ReturnType<typeof calculateGoalStats> {
  const baseStats = calculateGoalStats(goal, milestones);
  if (!goal.fitnessLink || goal.fitnessLink.targetValue <= 0) {
    return baseStats;
  }

  const fitState = useFitnessStore.getState();
  const fitProgress = calculateFitnessGoalProgress(goal.fitnessLink, {
    profile: fitState.profile,
    dailyLogs: fitState.dailyLogs,
    workoutSessions: fitState.workoutSessions,
    referenceDate: getLocalIsoDate(),
  });

  const noMilestones = baseStats.milestonesTotal === 0;
  const effectiveProgress = noMilestones ? fitProgress.progressPct : baseStats.progress;
  const expectedProgress =
    baseStats.totalDays > 0
      ? Math.min(100, (baseStats.daysElapsed / baseStats.totalDays) * 100)
      : 0;
  const isOnTrack = noMilestones
    ? effectiveProgress >= expectedProgress - 10
    : baseStats.isOnTrack;

  return {
    ...baseStats,
    progress: effectiveProgress,
    isOnTrack,
    projectedCompletion: computeProjectedCompletion(baseStats, effectiveProgress),
    currentFitnessValue: fitProgress.currentValue,
    targetFitnessValue: fitProgress.targetValue,
    fitnessUnit: fitProgress.unit,
  };
}
