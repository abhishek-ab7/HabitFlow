import type { FinanceCategory } from '@/lib/types';
import { addDays, normalizeIsoDate } from '@/lib/finance/credit-card-cycles';
import { getIstIsoDate } from '@/lib/mcp/config';
import {
  isDateInRange,
  type CrossDomainInsightsInput,
  type CrossDomainInsightsReport,
} from './insight-types';
import {
  computeGymSupplementRoiInsight,
  computeWalletWaistlineInsight,
} from './insight-modules/wallet-and-gym';
import { computeTriggerPatternInsight } from './insight-modules/trigger-patterns';
import { computeSocialSpendDietInsight } from './insight-modules/social-spend-diet';
import { generateCrossDomainAlerts } from './insight-modules/insight-alerts';

export * from './insight-types';

function prepareCrossDomainContext(input: CrossDomainInsightsInput) {
  const todayDate = normalizeIsoDate(input.todayDate || getIstIsoDate()) || getIstIsoDate();
  const window14Start = addDays(todayDate, -13);
  const window30Start = addDays(todayDate, -29);
  const in30d = (dateStr?: string | null) => isDateInRange(dateStr, window30Start, todayDate);

  const transactions = (input.transactions ?? []).filter((t) => !t.deletedAt);
  const categories = (input.categories ?? []).filter((c) => !c.deletedAt);
  return {
    todayDate,
    window14Start,
    window30Start,
    catMap: new Map<string, FinanceCategory>(categories.map((c) => [c.id, c])),
    expenses30d: transactions.filter((t) => t.type === 'expense' && in30d(t.date)),
    debtRecords: (input.debtRecords ?? []).filter((d) => !d.deletedAt),
    meals30d: (input.mealLogs ?? []).filter((m) => !m.deletedAt && in30d(m.date)),
    workouts30d: (input.workoutSessions ?? []).filter((w) => !w.deletedAt && in30d(w.date)),
    fitnessLogs30d: (input.fitnessDailyLogs ?? []).filter((l) => !l.deletedAt && in30d(l.date)),
    moodLogs30d: (input.moodLogs ?? []).filter((m) => in30d(m.date)),
    supplementInventory: (input.supplementInventory ?? []).filter((s) => !s.deletedAt),
    supplementLogs: (input.supplementLogs ?? []).filter((l) => !l.deletedAt),
    habits: (input.habits ?? []).filter((h) => !h.archived),
  };
}

export function computeCrossDomainInsights(
  input: CrossDomainInsightsInput
): CrossDomainInsightsReport {
  const ctx = prepareCrossDomainContext(input);
  const { todayDate, window14Start, window30Start, catMap } = ctx;

  const walletWaistline = computeWalletWaistlineInsight({
    expenses30d: ctx.expenses30d,
    meals30d: ctx.meals30d,
    catMap,
    window14Start,
    todayDate,
  });
  const gymSupplementRoi = computeGymSupplementRoiInsight({
    expenses30d: ctx.expenses30d,
    workouts30d: ctx.workouts30d,
    supplementInventory: ctx.supplementInventory,
    supplementLogs: ctx.supplementLogs,
    catMap,
    todayDate,
  });
  const triggers = computeTriggerPatternInsight({
    expenses30d: ctx.expenses30d,
    meals30d: ctx.meals30d,
    workouts30d: ctx.workouts30d,
    fitnessLogs30d: ctx.fitnessLogs30d,
    moodLogs30d: ctx.moodLogs30d,
    habits: ctx.habits,
    habitCompletions: input.habitCompletions ?? [],
    catMap,
    window30Start,
    todayDate,
  });
  const socialSpendDiet = computeSocialSpendDietInsight({
    expenses30d: ctx.expenses30d,
    debtRecords: ctx.debtRecords,
    meals30d: ctx.meals30d,
    catMap,
    window30Start,
    todayDate,
  });
  const alerts = generateCrossDomainAlerts({ walletWaistline, gymSupplementRoi, triggers, socialSpendDiet });

  return { todayDate, window14Start, window30Start, walletWaistline, gymSupplementRoi, triggers, socialSpendDiet, alerts };
}
