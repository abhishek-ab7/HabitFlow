export {
  formatDate,
  getMonthDates,
  getWeekDates,
  isDateInFuture,
  isDateToday,
  getHabitFrequencyType,
  getEffectiveTargetDaysPerWeek,
  isHabitAutoRestOnDate,
  getHabitWeekProgress,
  type HabitWeekProgress,
} from './date-and-schedule';

export {
  calculateWeeklyStreak,
  calculateCurrentStreak,
  calculateBestStreak,
} from './streaks';

export {
  calculateCompletionRate,
  calculateMonthlyCompletionRate,
  calculateMomentum,
  calculateHabitStats,
  calculateGoalStats,
  getDeadlineStatus,
} from './rates-and-stats';

export {
  calculateDailyStats,
  calculateCategoryBreakdown,
  generateHeatmapData,
  calculateTodayMomentumScore,
  type TodayMomentumScoreResult,
} from './analytics-and-score';
