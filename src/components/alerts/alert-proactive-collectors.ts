import { addDays, normalizeIsoDate, parseIsoDate } from '@/lib/finance/credit-card-cycles';
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  Habit,
  HabitCompletion,
} from '@/lib/types';
import type { UnifiedAdvanceAlert } from './alert-computation';

const ENVELOPE_ALERT_THRESHOLD = 0.8;
const STREAK_MIN_PRIOR_DAYS = 15; // > 14-day streak
const STREAK_MISSED_WINDOW_DAYS = 3;

function getRemainingDaysInMonth(todayIso: string): number {
  const { year, month, day } = parseIsoDate(todayIso);
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.max(1, daysInMonth - day + 1);
}

/**
 * Computes >=80% spend nudges for monthly category envelopes and credit card accounts,
 * including exact remaining daily safe-spend. Pure TS — shared across Dexie & Server Cron.
 */
export function collectEnvelope80PctAlerts(params: {
  todayIso: string;
  categories?: FinanceCategory[];
  accounts?: FinanceAccount[];
  transactions?: FinanceTransaction[];
}): UnifiedAdvanceAlert[] {
  const { todayIso, categories = [], accounts = [], transactions = [] } = params;
  const monthPrefix = todayIso.slice(0, 7);
  const remainingDays = getRemainingDaysInMonth(todayIso);
  const alerts: UnifiedAdvanceAlert[] = [];

  const monthlyExpenses = transactions.filter(
    (t) => !t.deletedAt && t.type === 'expense' && normalizeIsoDate(t.date).startsWith(monthPrefix)
  );

  // 1. Category monthly envelopes >= 80%
  const spentByCategory = new Map<string, number>();
  for (const tx of monthlyExpenses) {
    if (!tx.categoryId) continue;
    spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) + Number(tx.amount || 0));
  }

  for (const cat of categories) {
    if (cat.archived || cat.deletedAt) continue;
    const limit = Number(cat.monthlyBudgetLimit || 0);
    if (limit <= 0) continue;
    const spent = spentByCategory.get(cat.id) ?? 0;
    const ratio = spent / limit;
    if (ratio < ENVELOPE_ALERT_THRESHOLD) continue;

    const pct = Math.round(ratio * 100);
    const remaining = Math.max(0, limit - spent);
    const dailySafeSpend = Math.floor(remaining / remainingDays);

    alerts.push({
      id: `envelope-80-${cat.id}-${monthPrefix}`,
      kind: 'envelope_80_pct',
      title: `${cat.name} Envelope at ${pct}%`,
      subtitle: `₹${Math.round(spent).toLocaleString('en-IN')} / ₹${Math.round(limit).toLocaleString('en-IN')} spent · Safe daily left: ₹${dailySafeSpend.toLocaleString('en-IN')}/day (${remainingDays}d left)`,
      dueDate: todayIso,
      daysUntil: 0,
      amount: Math.round(remaining),
      severity: ratio >= 1 ? 'critical' : 'warning',
      href: '/finance',
    });
  }

  // 2. Credit card monthly spend >= 80% of creditLimit
  const spentByAccount = new Map<string, number>();
  for (const tx of monthlyExpenses) {
    if (!tx.accountId) continue;
    spentByAccount.set(tx.accountId, (spentByAccount.get(tx.accountId) ?? 0) + Number(tx.amount || 0));
  }

  for (const acc of accounts) {
    if (acc.archived || acc.deletedAt || acc.type !== 'credit_card') continue;
    const limit = Number(acc.creditLimit || 0);
    if (limit <= 0) continue;
    const spent = spentByAccount.get(acc.id) ?? 0;
    const ratio = spent / limit;
    if (ratio < ENVELOPE_ALERT_THRESHOLD) continue;

    const pct = Math.round(ratio * 100);
    const remaining = Math.max(0, limit - spent);
    const dailySafeSpend = Math.floor(remaining / remainingDays);

    alerts.push({
      id: `cc-envelope-80-${acc.id}-${monthPrefix}`,
      kind: 'envelope_80_pct',
      title: `${acc.name} Spend at ${pct}% of Limit`,
      subtitle: `₹${Math.round(spent).toLocaleString('en-IN')} / ₹${Math.round(limit).toLocaleString('en-IN')} · Safe daily left: ₹${dailySafeSpend.toLocaleString('en-IN')}/day`,
      dueDate: todayIso,
      daysUntil: 0,
      amount: Math.round(remaining),
      severity: ratio >= 1 ? 'critical' : 'warning',
      href: '/finance?tab=accounts',
    });
  }

  return alerts;
}

/**
 * Detects habits with 3 consecutive missed days ending yesterday (today-1..today-3)
 * immediately preceded by a >14-day streak (15+ consecutive completed days).
 */
export function collectStreakRecoveryAlerts(params: {
  todayIso: string;
  habits?: Habit[];
  completions?: HabitCompletion[];
}): UnifiedAdvanceAlert[] {
  const { todayIso, habits = [], completions = [] } = params;
  const alerts: UnifiedAdvanceAlert[] = [];

  const completedDatesByHabit = new Map<string, Set<string>>();
  for (const comp of completions) {
    if (!comp.completed && comp.status !== 'frozen') continue;
    const dateIso = normalizeIsoDate(comp.date);
    if (!completedDatesByHabit.has(comp.habitId)) {
      completedDatesByHabit.set(comp.habitId, new Set());
    }
    completedDatesByHabit.get(comp.habitId)!.add(dateIso);
  }

  for (const habit of habits) {
    if (habit.archived || habit.polarity === 'quit') continue;
    const dates = completedDatesByHabit.get(habit.id);
    if (!dates || dates.size < STREAK_MIN_PRIOR_DAYS) continue;

    // Must not already be completed today, and must have missed today-1, today-2, today-3
    if (dates.has(todayIso)) continue;
    let missedThree = true;
    for (let d = 1; d <= STREAK_MISSED_WINDOW_DAYS; d++) {
      if (dates.has(addDays(todayIso, -d))) {
        missedThree = false;
        break;
      }
    }
    if (!missedThree) continue;

    // Count consecutive completed days ending at today - 4
    let priorStreak = 0;
    let cursorOffset = STREAK_MISSED_WINDOW_DAYS + 1;
    while (dates.has(addDays(todayIso, -cursorOffset))) {
      priorStreak += 1;
      cursorOffset += 1;
    }

    if (priorStreak < STREAK_MIN_PRIOR_DAYS) continue;

    const twoMinHint =
      typeof habit.metadata?.twoMinuteVersion === 'string' && habit.metadata.twoMinuteVersion.trim()
        ? `Try: "${habit.metadata.twoMinuteVersion.trim()}"`
        : 'Do a 2-minute version today to restart momentum';

    alerts.push({
      id: `streak-recovery-${habit.id}-${todayIso}`,
      kind: 'streak_recovery',
      title: `Streak Recovery: ${habit.name} (2-min rescue)`,
      subtitle: `3 days missed after a ${priorStreak}-day streak · ${twoMinHint}`,
      dueDate: todayIso,
      daysUntil: 0,
      severity: 'warning',
      href: '/habits',
    });
  }

  return alerts;
}
