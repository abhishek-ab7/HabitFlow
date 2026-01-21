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
  addDays,
} from 'date-fns';
import type { 
  HabitCompletion, 
  Habit, 
  Goal, 
  Milestone, 
  HabitStats, 
  GoalStats,
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
// STREAK CALCULATIONS
// ============================================

export function calculateCurrentStreak(
  completions: HabitCompletion[],
  today: Date = new Date()
): number {
  if (completions.length === 0) return 0;

  // Sort completions by date descending
  const sorted = [...completions]
    .filter(c => c.completed)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) return 0;

  // Check if today or yesterday is completed (streak is active)
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(subDays(today, 1));
  
  const hasRecent = sorted.some(
    c => c.date === todayStr || c.date === yesterdayStr
  );

  if (!hasRecent) return 0;

  // Count consecutive days
  let streak = 0;
  let currentDate = sorted[0].date === todayStr ? today : subDays(today, 1);

  for (let i = 0; i < 365; i++) {
    const dateStr = formatDate(currentDate);
    const hasCompletion = sorted.some(c => c.date === dateStr);
    
    if (hasCompletion) {
      streak++;
      currentDate = subDays(currentDate, 1);
    } else {
      break;
    }
  }

  return streak;
}

export function calculateBestStreak(completions: HabitCompletion[]): number {
  if (completions.length === 0) return 0;

  const sorted = [...completions]
    .filter(c => c.completed)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) return 0;

  let bestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = parseISO(sorted[i - 1].date);
    const currDate = parseISO(sorted[i].date);
    const diff = differenceInDays(currDate, prevDate);

    if (diff === 1) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else if (diff > 1) {
      currentStreak = 1;
    }
    // If diff === 0, same day, ignore
  }

  return bestStreak;
}

// ============================================
// COMPLETION RATE CALCULATIONS
// ============================================

export function calculateCompletionRate(
  completions: HabitCompletion[],
  totalDays: number
): number {
  if (totalDays === 0) return 0;
  const completed = completions.filter(c => c.completed).length;
  return Math.round((completed / totalDays) * 100);
}

export function calculateMonthlyCompletionRate(
  completions: HabitCompletion[],
  year: number,
  month: number,
  today: Date = new Date()
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

  return calculateCompletionRate(monthCompletions, totalDays);
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
  const createdDate = parseISO(habit.createdAt);
  const totalDays = Math.max(1, differenceInDays(today, createdDate) + 1);

  return {
    habitId: habit.id,
    currentStreak: calculateCurrentStreak(habitCompletions, today),
    bestStreak: calculateBestStreak(habitCompletions),
    completionRate: calculateCompletionRate(habitCompletions, totalDays),
    totalCompletions: habitCompletions.filter(c => c.completed).length,
    totalDays,
    momentum: calculateMomentum(habitCompletions, today),
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
  
  return days.map(day => {
    const dateStr = formatDate(day);
    const dayCompletions = completions.filter(c => c.date === dateStr && c.completed);
    const activeHabits = habits.filter(h => !h.archived && !isAfter(parseISO(h.createdAt), day));
    
    return {
      date: dateStr,
      completedHabits: dayCompletions.length,
      totalHabits: activeHabits.length,
      completionRate: activeHabits.length > 0
        ? Math.round((dayCompletions.length / activeHabits.length) * 100)
        : 0,
    };
  });
}

export function calculateCategoryBreakdown(
  habits: Habit[],
  completions: HabitCompletion[]
): CategoryBreakdown[] {
  const categories = ['health', 'work', 'learning', 'personal', 'finance', 'relationships'] as Category[];
  
  const breakdown = categories.map(category => {
    const categoryHabits = habits.filter(h => h.category === category && !h.archived);
    const categoryCompletions = completions.filter(
      c => categoryHabits.some(h => h.id === c.habitId) && c.completed
    );
    
    const totalPossible = categoryHabits.length * 30; // Approximate month
    
    return {
      category,
      count: categoryHabits.length,
      percentage: habits.length > 0 ? Math.round((categoryHabits.length / habits.length) * 100) : 0,
      completionRate: totalPossible > 0
        ? Math.round((categoryCompletions.length / totalPossible) * 100)
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
  
  return dates.map(date => {
    const dateStr = formatDate(date);
    const count = completions.filter(c => c.date === dateStr && c.completed).length;
    
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
