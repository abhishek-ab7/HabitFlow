import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  differenceInDays,
  isAfter,
  isBefore,
  isToday,
  parseISO,
  startOfWeek,
  endOfWeek,
  subDays,
  getDay,
} from 'date-fns';
import type { 
  HabitCompletion, 
  Habit, 
  HabitFrequencyType,
  Goal, 
  Milestone, 
  HabitStats, 
  GoalStats,
  Task,
  Trend,
  DailyStats,
  CategoryBreakdown,
  HeatmapData,
  Category,
} from '../types';

// ============================================
// DATE UTILITIES
// ============================================

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function getMonthDates(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(new Date(year, month));
  return eachDayOfInterval({ start, end });
}

export function getWeekDates(date: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const start = startOfWeek(date, { weekStartsOn });
  const end = endOfWeek(date, { weekStartsOn });
  return eachDayOfInterval({ start, end });
}

export function isDateInFuture(date: string): boolean {
  return isAfter(parseISO(date), new Date());
}

export function isDateToday(date: string): boolean {
  return isToday(parseISO(date));
}

// ============================================
// SCHEDULE & FLEXIBLE REST DAY ENGINE (V2)
// ============================================

export function getHabitFrequencyType(habit?: Habit): HabitFrequencyType {
  if (!habit) return 'daily';
  if (habit.frequencyType) return habit.frequencyType;
  return (habit.targetDaysPerWeek ?? 7) < 7 ? 'weekly_flexible' : 'daily';
}

export function getEffectiveTargetDaysPerWeek(habit?: Habit): number {
  if (!habit) return 7;
  const freq = getHabitFrequencyType(habit);
  if (freq === 'daily') return 7;
  if (freq === 'specific_days') {
    return habit.scheduledDays && habit.scheduledDays.length > 0
      ? habit.scheduledDays.length
      : habit.targetDaysPerWeek || 7;
  }
  if (freq === 'interval') {
    const interval = Math.max(1, habit.intervalDays || 2);
    return Math.max(1, Math.round(7 / interval));
  }
  return Math.min(7, Math.max(1, habit.targetDaysPerWeek || 7));
}

export function isHabitAutoRestOnDate(
  habit: Habit,
  completions: HabitCompletion[],
  dateStr: string
): boolean {
  const freq = getHabitFrequencyType(habit);
  const dateObj = parseISO(dateStr);

  if (freq === 'specific_days' && habit.scheduledDays && habit.scheduledDays.length > 0) {
    const dow = getDay(dateObj);
    return !habit.scheduledDays.includes(dow);
  }

  if (freq === 'interval' && (habit.intervalDays || 1) > 1) {
    const interval = habit.intervalDays || 2;
    const habitComps = completions.filter(
      (c) =>
        (c.habitId === habit.id || !c.habitId) &&
        c.completed &&
        c.status !== 'frozen' &&
        c.status !== 'rest' &&
        c.date < dateStr
    );
    if (habitComps.length > 0) {
      const latestBefore = habitComps.reduce((max, c) => (c.date > max ? c.date : max), '');
      if (latestBefore) {
        const diff = differenceInDays(dateObj, parseISO(latestBefore));
        if (diff > 0 && diff < interval) {
          return true;
        }
      }
    }
  }

  return false;
}

export interface HabitWeekProgress {
  weekStart: string;
  weekEnd: string;
  completedCount: number;
  targetCount: number;
  restUsedCount: number;
  restAllowedCount: number;
  restRemainingCount: number;
  quotaMet: boolean;
  isAutoRestDay: boolean;
  isRestedToday: boolean;
  isCompletedToday: boolean;
  isFrozenToday: boolean;
  isSettledToday: boolean;
}

export function getHabitWeekProgress(
  habit: Habit,
  completions: HabitCompletion[],
  referenceDate: Date = new Date()
): HabitWeekProgress {
  const weekStartsOn = habit.weekStartsOn ?? 1;
  const start = startOfWeek(referenceDate, { weekStartsOn });
  const end = endOfWeek(referenceDate, { weekStartsOn });
  const weekStart = formatDate(start);
  const weekEnd = formatDate(end);
  const refStr = formatDate(referenceDate);

  const habitComps = completions.filter((c) => c.habitId === habit.id);
  const weekComps = habitComps.filter((c) => c.date >= weekStart && c.date <= weekEnd);

  const targetCount = getEffectiveTargetDaysPerWeek(habit);
  const restAllowedCount = Math.max(0, 7 - targetCount);

  const completedCount = weekComps.filter(
    (c) => c.completed && c.status !== 'frozen' && c.status !== 'rest' && !c.skipped
  ).length;

  const restUsedCount = weekComps.filter(
    (c) => c.status === 'rest' || c.skipped === true
  ).length;

  const restRemainingCount = Math.max(0, restAllowedCount - restUsedCount);
  const quotaMet = completedCount >= targetCount;

  const todayComp = habitComps.find((c) => c.date === refStr);
  const isCompletedToday = !!(
    todayComp &&
    todayComp.completed &&
    todayComp.status !== 'frozen' &&
    todayComp.status !== 'rest' &&
    !todayComp.skipped
  );
  const isFrozenToday = todayComp?.status === 'frozen';
  const isRestedToday = !!(todayComp && (todayComp.status === 'rest' || todayComp.skipped));
  const isAutoRestDay = isHabitAutoRestOnDate(habit, habitComps, refStr);

  const isSettledToday =
    isCompletedToday ||
    isFrozenToday ||
    isRestedToday ||
    isAutoRestDay ||
    (getHabitFrequencyType(habit) === 'weekly_flexible' && quotaMet);

  return {
    weekStart,
    weekEnd,
    completedCount,
    targetCount,
    restUsedCount,
    restAllowedCount,
    restRemainingCount,
    quotaMet,
    isAutoRestDay,
    isRestedToday,
    isCompletedToday,
    isFrozenToday,
    isSettledToday,
  };
}

// ============================================
// STREAK CALCULATIONS
// ============================================

export function calculateWeeklyStreak(
  habit: Habit,
  completions: HabitCompletion[],
  today: Date = new Date()
): number {
  const habitComps = completions.filter((c) => c.habitId === habit.id || !c.habitId);
  if (habitComps.length === 0) return 0;

  const weekStartsOn = habit.weekStartsOn ?? 1;
  const target = getEffectiveTargetDaysPerWeek(habit);
  let currentWeekStart = startOfWeek(today, { weekStartsOn });
  let weeklyStreak = 0;

  for (let w = 0; w < 52; w++) {
    const wStartStr = formatDate(currentWeekStart);
    const wEndObj = endOfWeek(currentWeekStart, { weekStartsOn });
    const wEndStr = formatDate(wEndObj);

    const weekComps = habitComps.filter((c) => c.date >= wStartStr && c.date <= wEndStr);
    const completedCount = weekComps.filter(
      (c) => c.completed && c.status !== 'frozen' && c.status !== 'rest' && !c.skipped
    ).length;
    const frozenCount = weekComps.filter((c) => c.status === 'frozen').length;

    if (completedCount + frozenCount >= target) {
      weeklyStreak++;
      currentWeekStart = subDays(currentWeekStart, 7);
    } else if (w === 0) {
      // Current week is still in progress: check if quota is still achievable
      const daysRemainingInWeek = Math.max(0, differenceInDays(wEndObj, today) + (completedCount > 0 ? 0 : 1));
      if (completedCount + frozenCount + daysRemainingInWeek >= target) {
        // Still achievable, check previous weeks
        currentWeekStart = subDays(currentWeekStart, 7);
        continue;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return weeklyStreak;
}

export function calculateCurrentStreak(
  completions: HabitCompletion[],
  today: Date = new Date(),
  habit?: Habit
): number {
  if (completions.length === 0) return 0;

  const freq = getHabitFrequencyType(habit);

  // Fast path for daily or legacy calls without habit
  if (!habit || freq === 'daily') {
    const completionsMap = new Map<string, HabitCompletion>();
    for (const c of completions) {
      if (c.completed || c.status === 'frozen' || c.status === 'rest' || c.skipped) {
        completionsMap.set(c.date, c);
      }
    }

    if (completionsMap.size === 0) return 0;

    const todayStr = formatDate(today);
    const yesterdayStr = formatDate(subDays(today, 1));
    const hasRecent = completionsMap.has(todayStr) || completionsMap.has(yesterdayStr);
    if (!hasRecent) return 0;

    let streak = 0;
    let currentDate = completionsMap.has(todayStr) ? today : subDays(today, 1);

    for (let i = 0; i < 365; i++) {
      const dateStr = formatDate(currentDate);
      const comp = completionsMap.get(dateStr);

      if (comp) {
        if (comp.status !== 'frozen' && comp.status !== 'rest' && !comp.skipped && comp.completed) {
          streak++;
        }
        currentDate = subDays(currentDate, 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // Schedule-aware streak for weekly_flexible, specific_days, interval
  const completionsMap = new Map<string, HabitCompletion>();
  for (const c of completions) {
    completionsMap.set(c.date, c);
  }

  const hasAnyCompleted = completions.some(
    (c) => c.completed && c.status !== 'frozen' && c.status !== 'rest' && !c.skipped
  );
  if (!hasAnyCompleted) return 0;

  const earliestDateStr = completions.reduce(
    (min, c) => (c.date < min ? c.date : min),
    formatDate(today)
  );
  const createdStr = habit.createdAt ? formatDate(habit.createdAt) : earliestDateStr;
  const floorDateStr = earliestDateStr < createdStr ? earliestDateStr : createdStr;

  const weekStartsOn = habit.weekStartsOn ?? 1;
  const targetPerWeek = getEffectiveTargetDaysPerWeek(habit);
  const allowedOffDaysPerWeek = Math.max(0, 7 - targetPerWeek);

  // Track off-days used per week key (weekStartStr) while walking backward
  const weekOffDaysUsed = new Map<string, number>();

  let streak = 0;
  let currentDate = today;
  const todayStr = formatDate(today);
  const todayComp = completionsMap.get(todayStr);

  // If today is still pending (neither completed, frozen, nor rest), start evaluation from yesterday
  // unless today is already logged
  if (!todayComp || (!todayComp.completed && todayComp.status !== 'frozen' && todayComp.status !== 'rest' && !todayComp.skipped)) {
    currentDate = subDays(today, 1);
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = formatDate(currentDate);
    if (dateStr < floorDateStr && streak > 0) {
      break;
    }

    const comp = completionsMap.get(dateStr);
    const isDone = !!(comp && comp.completed && comp.status !== 'frozen' && comp.status !== 'rest' && !comp.skipped);
    const isFrozen = comp?.status === 'frozen';
    const isExplicitRest = !!(comp && (comp.status === 'rest' || comp.skipped));

    if (isDone) {
      streak++;
      currentDate = subDays(currentDate, 1);
      continue;
    }

    if (isFrozen) {
      currentDate = subDays(currentDate, 1);
      continue;
    }

    if (freq === 'specific_days') {
      const dow = getDay(currentDate);
      const isScheduled = !habit.scheduledDays || habit.scheduledDays.length === 0 || habit.scheduledDays.includes(dow);
      if (!isScheduled || isExplicitRest) {
        currentDate = subDays(currentDate, 1);
        continue;
      }
      break;
    }

    if (freq === 'interval') {
      if (isExplicitRest || isHabitAutoRestOnDate(habit, completions, dateStr)) {
        currentDate = subDays(currentDate, 1);
        continue;
      }
      break;
    }

    if (freq === 'weekly_flexible') {
      const wkStart = formatDate(startOfWeek(currentDate, { weekStartsOn }));
      const used = weekOffDaysUsed.get(wkStart) || 0;
      if (used < allowedOffDaysPerWeek) {
        weekOffDaysUsed.set(wkStart, used + 1);
        currentDate = subDays(currentDate, 1);
        continue;
      }
      break;
    }

    break;
  }

  return streak;
}

export function calculateBestStreak(
  completions: HabitCompletion[],
  habit?: Habit
): number {
  if (completions.length === 0) return 0;

  const freq = getHabitFrequencyType(habit);

  if (!habit || freq === 'daily') {
    const sorted = [...completions]
      .filter((c) => c.completed || c.status === 'frozen' || c.status === 'rest' || c.skipped)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length === 0) return 0;

    let bestStreak = 0;
    const isFirstCountable =
      sorted[0].completed && sorted[0].status !== 'frozen' && sorted[0].status !== 'rest' && !sorted[0].skipped;
    let currentStreak = isFirstCountable ? 1 : 0;
    bestStreak = Math.max(bestStreak, currentStreak);

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = parseISO(sorted[i - 1].date);
      const currDate = parseISO(sorted[i].date);
      const diff = differenceInDays(currDate, prevDate);
      const countable =
        sorted[i].completed && sorted[i].status !== 'frozen' && sorted[i].status !== 'rest' && !sorted[i].skipped;

      if (diff === 1) {
        if (countable) {
          currentStreak++;
        }
        bestStreak = Math.max(bestStreak, currentStreak);
      } else if (diff > 1) {
        currentStreak = countable ? 1 : 0;
        bestStreak = Math.max(bestStreak, currentStreak);
      }
    }

    return bestStreak;
  }

  // For flexible / specific_days / interval habits, compute best streak in a single chronological O(span + C log C) pass
  const completedDatesSet = new Set<string>();
  const frozenDatesSet = new Set<string>();
  const restDatesSet = new Set<string>();
  for (const c of completions) {
    if (c.status === 'frozen') {
      frozenDatesSet.add(c.date);
    } else if (c.status === 'rest' || c.skipped) {
      restDatesSet.add(c.date);
    } else if (c.completed) {
      completedDatesSet.add(c.date);
    }
  }

  if (completedDatesSet.size === 0) return 0;

  const sortedCompleted = Array.from(completedDatesSet).sort();

  if (freq === 'interval') {
    const interval = Math.max(1, habit.intervalDays || 2);
    let best = 1;
    let run = 1;
    for (let i = 1; i < sortedCompleted.length; i++) {
      const diff = differenceInDays(parseISO(sortedCompleted[i]), parseISO(sortedCompleted[i - 1]));
      if (diff <= interval) {
        run++;
      } else {
        // Check if missing interval slots were bridged by frozen/rest days
        let bridged = true;
        let cursor = parseISO(sortedCompleted[i - 1]);
        const targetEnd = parseISO(sortedCompleted[i]);
        let daysSinceDone = 0;
        while (differenceInDays(targetEnd, cursor) > 1) {
          cursor = subDays(cursor, -1);
          const dStr = formatDate(cursor);
          daysSinceDone++;
          if (frozenDatesSet.has(dStr) || restDatesSet.has(dStr)) {
            daysSinceDone = 0;
          } else if (daysSinceDone >= interval) {
            bridged = false;
            break;
          }
        }
        run = bridged ? run + 1 : 1;
      }
      if (run > best) best = run;
    }
    return best;
  }

  const earliest = parseISO(sortedCompleted[0]);
  const latest = parseISO(sortedCompleted[sortedCompleted.length - 1]);
  const totalSpanDays = Math.min(1825, Math.max(0, differenceInDays(latest, earliest)));
  const weekStartsOn = habit.weekStartsOn ?? 1;
  const targetPerWeek = getEffectiveTargetDaysPerWeek(habit);
  const allowedOffDaysPerWeek = Math.max(0, 7 - targetPerWeek);
  const weekOffDaysUsed = new Map<string, number>();

  let best = 0;
  let run = 0;
  for (let offset = 0; offset <= totalSpanDays; offset++) {
    const currentDate = subDays(latest, totalSpanDays - offset);
    const dateStr = formatDate(currentDate);

    if (completedDatesSet.has(dateStr)) {
      run++;
      if (run > best) best = run;
      continue;
    }

    if (frozenDatesSet.has(dateStr)) {
      continue;
    }

    if (freq === 'specific_days') {
      const dow = getDay(currentDate);
      const isScheduled =
        !habit.scheduledDays || habit.scheduledDays.length === 0 || habit.scheduledDays.includes(dow);
      if (!isScheduled || restDatesSet.has(dateStr)) {
        continue;
      }
      run = 0;
      continue;
    }

    if (freq === 'weekly_flexible') {
      const wkStart = formatDate(startOfWeek(currentDate, { weekStartsOn }));
      const used = weekOffDaysUsed.get(wkStart) || 0;
      if (used < allowedOffDaysPerWeek) {
        weekOffDaysUsed.set(wkStart, used + 1);
        continue;
      }
      run = 0;
      continue;
    }

    run = 0;
  }

  return best;
}

// ============================================
// COMPLETION RATE CALCULATIONS
// ============================================

export function calculateCompletionRate(
  completions: HabitCompletion[],
  totalDays: number,
  habit?: Habit
): number {
  if (totalDays <= 0) return 0;
  const completed = completions.filter(
    (c) => c.completed && c.status !== 'frozen' && c.status !== 'rest' && !c.skipped
  ).length;

  if (!habit) {
    return Math.round((completed / totalDays) * 100);
  }

  const freq = getHabitFrequencyType(habit);
  if (freq === 'daily' && (habit.targetDaysPerWeek ?? 7) === 7) {
    return Math.min(100, Math.round((completed / totalDays) * 100));
  }

  const targetPerWeek = getEffectiveTargetDaysPerWeek(habit);
  let expectedSessions = totalDays;

  if (freq === 'interval') {
    const interval = Math.max(1, habit.intervalDays || 2);
    expectedSessions = Math.max(1, Math.ceil(totalDays / interval));
  } else if (totalDays <= 7) {
    expectedSessions = Math.max(1, Math.min(totalDays, targetPerWeek));
  } else {
    expectedSessions = Math.max(1, Math.round((totalDays / 7) * targetPerWeek));
  }

  return Math.min(100, Math.round((completed / expectedSessions) * 100));
}

export function calculateMonthlyCompletionRate(
  completions: HabitCompletion[],
  year: number,
  month: number,
  today: Date = new Date(),
  habit?: Habit
): number {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));
  
  // Only count days up to today if current month
  const endDate = isBefore(monthEnd, today) ? monthEnd : today;
  const totalDays = differenceInDays(endDate, monthStart) + 1;
  
  const monthCompletions = completions.filter(c => {
    const date = parseISO(c.date);
    return !isBefore(date, monthStart) && !isAfter(date, endDate) && c.completed;
  });

  return calculateCompletionRate(monthCompletions, totalDays, habit);
}

// ============================================
// MOMENTUM / TREND CALCULATIONS
// ============================================

export function calculateMomentum(
  completions: HabitCompletion[],
  today: Date = new Date()
): Trend {
  // Compare last 7 days vs previous 7 days
  const last7DaysStart = subDays(today, 6);
  const prev7DaysStart = subDays(today, 13);
  const prev7DaysEnd = subDays(today, 7);

  const last7 = completions.filter(c => {
    const date = parseISO(c.date);
    return !isBefore(date, last7DaysStart) && !isAfter(date, today) && c.completed;
  }).length;

  const prev7 = completions.filter(c => {
    const date = parseISO(c.date);
    return !isBefore(date, prev7DaysStart) && !isAfter(date, prev7DaysEnd) && c.completed;
  }).length;

  if (last7 > prev7) return 'up';
  if (last7 < prev7) return 'down';
  return 'stable';
}

// ============================================
// HABIT STATISTICS
// ============================================

export function calculateHabitStats(
  habit: Habit,
  completions: HabitCompletion[],
  today: Date = new Date()
): HabitStats {
  const habitCompletions = completions.filter(c => c.habitId === habit.id);
  const createdDate = habit.createdAt ? parseISO(habit.createdAt) : today;
  const totalDays = Math.max(1, differenceInDays(today, createdDate) + 1);
  const weekProgress = getHabitWeekProgress(habit, habitCompletions, today);

  return {
    habitId: habit.id,
    currentStreak: calculateCurrentStreak(habitCompletions, today, habit),
    bestStreak: calculateBestStreak(habitCompletions, habit),
    weeklyStreak: calculateWeeklyStreak(habit, habitCompletions, today),
    completionRate: calculateCompletionRate(habitCompletions, totalDays, habit),
    totalCompletions: habitCompletions.filter(
      c => c.completed && c.status !== 'frozen' && c.status !== 'rest' && !c.skipped
    ).length,
    totalDays,
    momentum: calculateMomentum(habitCompletions, today),
    completedThisWeek: weekProgress.completedCount,
    targetThisWeek: weekProgress.targetCount,
    restDaysUsedThisWeek: weekProgress.restUsedCount,
    restDaysAllowedThisWeek: weekProgress.restAllowedCount,
  };
}

// ============================================
// GOAL STATISTICS
// ============================================

export function calculateGoalStats(
  goal: Goal,
  milestones: Milestone[],
  today: Date = new Date()
): GoalStats {
  const goalMilestones = milestones.filter(m => m.goalId === goal.id);
  const completedMilestones = goalMilestones.filter(m => m.completed);
  
  const startDate = parseISO(goal.startDate);
  const deadline = parseISO(goal.deadline);
  
  const totalDays = differenceInDays(deadline, startDate);
  const daysElapsed = Math.max(0, differenceInDays(today, startDate));
  const daysRemaining = Math.max(0, differenceInDays(deadline, today));
  
  const progress = goalMilestones.length > 0
    ? Math.round((completedMilestones.length / goalMilestones.length) * 100)
    : 0;

  // Calculate if on track
  const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  const isOnTrack = progress >= expectedProgress - 10; // 10% tolerance

  // Project completion
  let projectedCompletion: number | undefined;
  if (daysElapsed > 0 && progress > 0) {
    const progressRate = progress / daysElapsed;
    projectedCompletion = Math.min(100, Math.round(progressRate * (daysElapsed + daysRemaining)));
  }

  return {
    goalId: goal.id,
    progress,
    milestonesCompleted: completedMilestones.length,
    milestonesTotal: goalMilestones.length,
    daysRemaining,
    daysElapsed,
    totalDays,
    isOnTrack,
    projectedCompletion,
  };
}

export function getDeadlineStatus(deadline: string, today: Date = new Date()): {
  label: string;
  color: 'success' | 'warning' | 'destructive' | 'muted';
  daysLeft: number;
} {
  const deadlineDate = parseISO(deadline);
  const daysLeft = differenceInDays(deadlineDate, today);

  if (daysLeft < 0) {
    return {
      label: `Overdue by ${Math.abs(daysLeft)} days`,
      color: 'destructive',
      daysLeft,
    };
  }

  if (daysLeft === 0) {
    return { label: 'Due today', color: 'warning', daysLeft };
  }

  if (daysLeft === 1) {
    return { label: 'Due tomorrow', color: 'warning', daysLeft };
  }

  if (daysLeft <= 7) {
    return { label: `${daysLeft} days left`, color: 'warning', daysLeft };
  }

  return { label: `${daysLeft} days left`, color: 'muted', daysLeft };
}

// ============================================
// ANALYTICS CALCULATIONS
// ============================================

export function calculateDailyStats(
  habits: Habit[],
  completions: HabitCompletion[],
  startDate: Date,
  endDate: Date
): DailyStats[] {
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Index completed completions by date for O(1) count
  const completionsByDate = new Map<string, number>();
  for (const c of completions) {
    if (c.completed && c.status !== 'rest' && !c.skipped) {
      completionsByDate.set(c.date, (completionsByDate.get(c.date) || 0) + 1);
    }
  }

  // Pre-parse habit creation dates once
  const habitsWithCreatedDate = habits
    .filter(h => !h.archived)
    .map(h => ({
      ...h,
      parsedCreatedAt: parseISO(h.createdAt)
    }));
  
  return days.map(day => {
    const dateStr = formatDate(day);
    const completedCount = completionsByDate.get(dateStr) || 0;
    
    // Filter active habits using the pre-parsed date
    const activeHabitsCount = habitsWithCreatedDate.filter(
      h => !isAfter(h.parsedCreatedAt, day)
    ).length;
    
    return {
      date: dateStr,
      completedHabits: completedCount,
      totalHabits: activeHabitsCount,
      completionRate: activeHabitsCount > 0
        ? Math.round((completedCount / activeHabitsCount) * 100)
        : 0,
    };
  });
}

export function calculateCategoryBreakdown(
  habits: Habit[],
  completions: HabitCompletion[]
): CategoryBreakdown[] {
  const categories = ['health', 'work', 'learning', 'personal', 'finance', 'relationships'] as Category[];
  
  // Pre-filter completed completions
  const completedCompletions = completions.filter(c => c.completed && c.status !== 'rest' && !c.skipped);
  
  const breakdown = categories.map(category => {
    const categoryHabits = habits.filter(h => h.category === category && !h.archived);
    const categoryHabitIds = new Set(categoryHabits.map(h => h.id));
    
    const completedCount = completedCompletions.filter(
      c => categoryHabitIds.has(c.habitId)
    ).length;
    
    // Schedule-adjusted monthly possible completions per habit
    const totalPossible = categoryHabits.reduce((sum, h) => {
      const targetPerWeek = getEffectiveTargetDaysPerWeek(h);
      return sum + Math.round((30 / 7) * targetPerWeek);
    }, 0);
    
    return {
      category,
      count: categoryHabits.length,
      percentage: habits.length > 0 ? Math.round((categoryHabits.length / habits.length) * 100) : 0,
      completionRate: totalPossible > 0
        ? Math.min(100, Math.round((completedCount / totalPossible) * 100))
        : 0,
    };
  });

  return breakdown.filter(b => b.count > 0);
}

export function generateHeatmapData(
  completions: HabitCompletion[],
  habits: Habit[],
  days: number = 365
): HeatmapData[] {
  const today = new Date();
  const startDate = subDays(today, days - 1);
  const dates = eachDayOfInterval({ start: startDate, end: today });
  
  const maxPossible = habits.filter(h => !h.archived).length;

  // Index completed completions count by date
  const completedCompletionsByDate = new Map<string, number>();
  for (const c of completions) {
    if (c.completed && c.status !== 'rest' && !c.skipped) {
      completedCompletionsByDate.set(c.date, (completedCompletionsByDate.get(c.date) || 0) + 1);
    }
  }
  
  return dates.map(date => {
    const dateStr = formatDate(date);
    const count = completedCompletionsByDate.get(dateStr) || 0;
    
    // Calculate intensity level (0-4)
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (maxPossible > 0) {
      const percentage = count / maxPossible;
      if (percentage > 0.8) level = 4;
      else if (percentage > 0.6) level = 3;
      else if (percentage > 0.4) level = 2;
      else if (percentage > 0) level = 1;
    }
    
    return { date: dateStr, count, level };
  });
}

export interface TodayMomentumScoreResult {
  score: number;
  todayCompleted: number;
  todayTotal: number;
  restingCount: number;
  quotaMetCount: number;
  completedTasks: number;
  totalTasks: number;
}

/**
 * Computes today's unified momentum score (60% habits, 40% due/overdue tasks).
 * Habits marked as `rest`, `skipped`, auto-rest, or weekly quota-met are excluded from
 * `todayTotal` so Low-Energy / guilt-free rest days never lower the score.
 */
export function calculateTodayMomentumScore(params: {
  habits: Habit[];
  completions: HabitCompletion[];
  tasks: Task[];
  todayStr: string;
  isTasksEnabled?: boolean;
  referenceDate?: Date;
}): TodayMomentumScoreResult {
  const {
    habits,
    completions,
    tasks,
    todayStr,
    isTasksEnabled = true,
    referenceDate = parseISO(todayStr),
  } = params;

  const activeHabits = habits.filter((h) => !h.archived);

  let todayCompleted = 0;
  let todayTotal = 0;
  let restingCount = 0;
  let quotaMetCount = 0;

  for (const habit of activeHabits) {
    const todayComp = completions.find((c) => c.habitId === habit.id && c.date === todayStr);
    const isDoneToday = !!(
      todayComp &&
      todayComp.completed &&
      todayComp.status !== 'rest' &&
      !todayComp.skipped
    );
    const isRestToday = !!(todayComp && (todayComp.status === 'rest' || todayComp.skipped));
    const weekProg = getHabitWeekProgress(habit, completions, referenceDate);

    if (isDoneToday) {
      todayCompleted++;
      todayTotal++;
    } else if (isRestToday || weekProg.isAutoRestDay) {
      restingCount++;
    } else if (weekProg.quotaMet && (habit.targetDaysPerWeek ?? 7) < 7) {
      quotaMetCount++;
    } else {
      todayTotal++;
    }
  }

  const habitRate = todayTotal > 0 ? todayCompleted / todayTotal : 1;

  const todayTasksList = tasks.filter((t) => {
    if (t.status === 'archived') return false;
    const isDueToday = t.due_date && t.due_date.startsWith(todayStr);
    const isOverdueTodo =
      t.status === 'todo' &&
      t.due_date &&
      t.due_date <= `${todayStr}T23:59:59`;
    return isDueToday || isOverdueTodo;
  });

  const totalTasks = todayTasksList.length;
  const completedTasks = todayTasksList.filter((t) => t.status === 'done').length;
  const taskRate = totalTasks > 0 ? completedTasks / totalTasks : 1;

  let score = 100;
  if (todayTotal > 0 && totalTasks > 0 && isTasksEnabled) {
    score = Math.round(habitRate * 60 + taskRate * 40);
  } else if (todayTotal > 0) {
    score = Math.round(habitRate * 100);
  } else if (totalTasks > 0 && isTasksEnabled) {
    score = Math.round(taskRate * 100);
  }

  return {
    score,
    todayCompleted,
    todayTotal,
    restingCount,
    quotaMetCount,
    completedTasks: isTasksEnabled ? completedTasks : 0,
    totalTasks: isTasksEnabled ? totalTasks : 0,
  };
}
