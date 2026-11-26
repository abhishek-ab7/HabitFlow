import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate, getIstMonthKey } from '../config';
import {
  mapCreditCardStatementFromRow,
  mapDebtInstallmentFromRow,
  mapDebtRecordFromRow,
  mapEmiTrackerFromRow,
  mapFinanceAccountFromRow,
  mapFinanceBudgetFromRow,
  mapFinanceCategoryFromRow,
  mapFinanceRecurringBillFromRow,
  mapFinanceSipPlanFromRow,
  mapFinanceTransactionFromRow,
  mapFitnessDailyLogFromRow,
  mapFitnessProfileFromRow,
  mapHabitCompletionFromRow,
  mapHabitFromRow,
  mapMealLogFromRow,
  mapMonthlyCommitmentFromRow,
  mapMoodLogFromRow,
  mapSupplementInventoryFromRow,
  mapSupplementLogFromRow,
  mapWorkoutSessionFromRow,
  resolveCompletionStatusFromRow,
} from '../mappers';
import { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import { detectSpendingAnomalies } from '@/lib/finance/anomalies';
import { buildCashFlowForecast } from '@/lib/finance/forecast';
import { addDays } from '@/lib/finance/credit-card-cycles';
import { calculateMonthlySummary, calculateUpcomingFinancialObligations } from '@/lib/finance/shared-analytics';

function mcpError(text: string) {
  return { isError: true, content: [{ type: 'text' as const, text }] };
}

function mcpJson(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

async function fetchFinanceSnapshotData(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const tables = [
    'finance_accounts',
    'finance_transactions',
    'finance_categories',
    'finance_budgets',
    'monthly_commitments',
    'emi_trackers',
    'debt_records',
    'debt_installments',
    'finance_recurring_bills',
    'finance_sip_plans',
  ];
  const results = await Promise.all(
    tables.map((t) => supabase.from(t).select('*').eq('user_id', userId).is('deleted_at', null))
  );
  const rows = results.map((r) => r.data || []);
  return {
    accounts: rows[0].map(mapFinanceAccountFromRow),
    transactions: rows[1].map(mapFinanceTransactionFromRow),
    categories: rows[2].map(mapFinanceCategoryFromRow),
    budgets: rows[3].map(mapFinanceBudgetFromRow),
    commitments: rows[4].map(mapMonthlyCommitmentFromRow),
    emiTrackers: rows[5].map(mapEmiTrackerFromRow),
    debtRecords: rows[6].map(mapDebtRecordFromRow),
    debtInstallments: rows[7].map(mapDebtInstallmentFromRow),
    recurringBills: rows[8].map(mapFinanceRecurringBillFromRow),
    sipPlans: rows[9].map(mapFinanceSipPlanFromRow),
  };
}

function mapBriefingHabits(habits: any[], completions: any[], dateIst: string) {
  const todayComps = completions.filter((c) => c.date === dateIst);
  const completionMap = new Map(todayComps.map((c) => [c.habit_id, c]));
  return habits.map((h) => {
    const comp = completionMap.get(h.id);
    const resolvedStatus = comp ? resolveCompletionStatusFromRow(comp) : undefined;
    const isCompleted = resolvedStatus === 'completed' || (Boolean(comp?.completed) && resolvedStatus !== 'rest');
    return {
      id: h.id,
      name: h.name,
      category: h.category,
      polarity: h.polarity || 'build',
      anchorBlock: h.anchor_block ?? null,
      frequencyType: h.frequency_type,
      isCompleted,
      status: resolvedStatus || 'pending',
      value: comp?.value ?? null,
      targetValue: h.target_value ?? null,
      unit: h.unit ?? null,
    };
  });
}

function mapBriefingTasks(tasks: any[], dateIst: string) {
  return tasks
    .filter((t) => t.status !== 'done')
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.due_date,
      tags: t.tags || [],
      metadata: t.metadata || {},
      isOverdue: t.due_date ? t.due_date < dateIst : false,
      isUrgent: t.is_urgent,
      isImportant: t.is_important,
    }))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
}

function mapBriefingGoals(goals: any[]) {
  return goals.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    progress: g.progress,
    targetDate: g.target_date,
    financialLink: g.financial_link ?? null,
    fitnessLink: g.fitness_link ?? null,
    milestones: (g.milestones || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      isCompleted: m.is_completed,
    })),
  }));
}

function mapBriefingFitnessBundle(rows: {
  fitProfileRows: any[];
  fitDailyRows: any[];
  mealRows: any[];
  workoutRows: any[];
  supRows: any[];
  supLogRows: any[];
}) {
  return {
    fitProfile: rows.fitProfileRows[0] ? mapFitnessProfileFromRow(rows.fitProfileRows[0]) : null,
    fitLogs: rows.fitDailyRows.map(mapFitnessDailyLogFromRow),
    meals: rows.mealRows.map(mapMealLogFromRow),
    workouts: rows.workoutRows.map(mapWorkoutSessionFromRow),
    supplements: rows.supRows.map(mapSupplementInventoryFromRow),
    supLogs: rows.supLogRows.map(mapSupplementLogFromRow),
  };
}

async function fetchCoreBriefingRows(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  windowStart: string;
  dateIst: string;
}) {
  const { supabase, userId, windowStart, dateIst } = params;
  const [
    habitsRes,
    completionsRes,
    tasksRes,
    goalsRes,
    moodRes,
    fitProfileRes,
    fitDailyRes,
    mealRes,
    workoutRes,
    supRes,
    supLogRes,
  ] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', userId).eq('is_archived', false),
    supabase.from('completions').select('*').eq('user_id', userId).gte('date', windowStart).lte('date', dateIst),
    supabase.from('tasks').select('*').eq('user_id', userId).neq('status', 'archived').or(`due_date.lte.${dateIst},status.eq.todo,status.eq.in_progress`),
    supabase.from('goals').select('*, milestones(*)').eq('user_id', userId).eq('is_archived', false).eq('is_focus', true),
    supabase.from('mood_logs').select('*').eq('user_id', userId).gte('date', windowStart).lte('date', dateIst),
    supabase.from('fitness_profiles').select('*').eq('user_id', userId).is('deleted_at', null).limit(1),
    supabase.from('fitness_daily_logs').select('*').eq('user_id', userId).is('deleted_at', null).gte('date', windowStart).lte('date', dateIst),
    supabase.from('meal_logs').select('*').eq('user_id', userId).is('deleted_at', null).gte('date', windowStart).lte('date', dateIst),
    supabase.from('workout_sessions').select('*').eq('user_id', userId).is('deleted_at', null).gte('date', windowStart).lte('date', dateIst),
    supabase.from('supplement_inventory').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('supplement_logs').select('*').eq('user_id', userId).is('deleted_at', null).gte('date', windowStart).lte('date', dateIst),
  ]);

  return {
    habits: habitsRes.data ?? [],
    completions: completionsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    goals: goalsRes.data ?? [],
    moodLog: moodRes.data ?? [],
    ...mapBriefingFitnessBundle({
      fitProfileRows: fitProfileRes.data ?? [],
      fitDailyRows: fitDailyRes.data ?? [],
      mealRows: mealRes.data ?? [],
      workoutRows: workoutRes.data ?? [],
      supRows: supRes.data ?? [],
      supLogRows: supLogRes.data ?? [],
    }),
  };
}

async function computeOptionalBriefingFinance(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  dateIst: string;
  include: boolean;
}) {
  if (!params.include) {
    return {
      financeSnapshot: null,
      upcomingObligations: null,
      financeForInsights: { transactions: [], categories: [], debtRecords: [] },
    };
  }
  const monthKey = params.dateIst.substring(0, 7);
  const fin = await fetchFinanceSnapshotData(params.supabase, params.userId);
  const monthlySummary = calculateMonthlySummary({ monthKey, ...fin, referenceDate: params.dateIst });
  return {
    financeSnapshot: {
      monthKey,
      totalSpent: monthlySummary.totalSpent,
      totalIncome: monthlySummary.totalIncome,
      safeToSpendDaily: monthlySummary.safeToSpendDaily,
      safeToSpendMonthly: monthlySummary.safeToSpendMonthly,
    },
    upcomingObligations: calculateUpcomingFinancialObligations({
      ...fin,
      currentDate: params.dateIst,
      withinDays: 7,
    }),
    financeForInsights: {
      transactions: fin.transactions,
      categories: fin.categories,
      debtRecords: fin.debtRecords,
    },
  };
}

export async function handleGetDailyBriefing(args: { date?: string; includeFinance?: boolean }) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:read')) return mcpError('Forbidden: Missing habitflow:read scope.');

  const dateIst = args.date || getIstIsoDate();
  const supabase = getSupabaseAdmin();
  const core = await fetchCoreBriefingRows({
    supabase,
    userId: auth.userId,
    windowStart: addDays(dateIst, -29),
    dateIst,
  });

  const mappedMoodLogs = core.moodLog.map((m) => mapMoodLogFromRow(m, auth.userId));
  const todayMoodRec = mappedMoodLogs.find((m) => m.date === dateIst);
  const dailyFuel = calculateDailyFuelSummary(
    core.meals,
    core.fitLogs.find((d) => d.date === dateIst),
    core.fitProfile,
    dateIst
  );
  const { financeSnapshot, upcomingObligations, financeForInsights } =
    await computeOptionalBriefingFinance({
      supabase,
      userId: auth.userId,
      dateIst,
      include: Boolean(args.includeFinance && hasScope(auth, 'habitflow:finance:read')),
    });

  const crossDomainInsights = computeCrossDomainInsights({
    todayDate: dateIst,
    ...financeForInsights,
    mealLogs: core.meals,
    workoutSessions: core.workouts,
    fitnessDailyLogs: core.fitLogs,
    supplementInventory: core.supplements,
    supplementLogs: core.supLogs,
    habits: core.habits.map((h) => mapHabitFromRow(h, dateIst)),
    habitCompletions: core.completions.map((c) => mapHabitCompletionFromRow(c, auth.userId)),
    moodLogs: mappedMoodLogs,
  });

  return mcpJson({
    dateIst,
    habitsDue: mapBriefingHabits(core.habits, core.completions, dateIst),
    tasksDueAndOverdue: mapBriefingTasks(core.tasks, dateIst),
    focusGoals: mapBriefingGoals(core.goals),
    todayMood: todayMoodRec ? { mood: todayMoodRec.mood, date: todayMoodRec.date } : null,
    fitnessSummary: {
      dailyFuel,
      workoutsTodayCount: core.workouts.filter((w) => w.date === dateIst).length,
    },
    crossDomainInsights: {
      alerts: crossDomainInsights.alerts,
      walletWaistline: crossDomainInsights.walletWaistline,
      gymSupplementRoi: crossDomainInsights.gymSupplementRoi,
      triggers: crossDomainInsights.triggers,
    },
    financeSnapshot,
    upcomingObligations,
  });
}

function computeElapsedDaysInMonth(referenceDate: string, monthKey: string): number {
  const days = referenceDate.startsWith(monthKey)
    ? parseInt(referenceDate.slice(8, 10), 10)
    : new Date(parseInt(monthKey.slice(0, 4), 10), parseInt(monthKey.slice(5, 7), 10), 0).getDate();
  return Math.max(1, days);
}

function computeHabitConsistency(params: {
  habits: any[];
  completions: any[];
  userId: string;
  referenceDate: string;
  monthKey: string;
}) {
  const mappedHabits = params.habits.map((h) => mapHabitFromRow(h, params.referenceDate));
  const elapsedDaysInMonth = computeElapsedDaysInMonth(params.referenceDate, params.monthKey);
  const mappedCompletions = params.completions.map((c) => mapHabitCompletionFromRow(c, params.userId));
  const completedCount = mappedCompletions.filter(
    (c) => c.date.startsWith(params.monthKey) && c.completed && c.status !== 'frozen' && c.status !== 'rest' && !c.skipped
  ).length;
  const expectedOpportunities = mappedHabits.reduce(
    (sum, h) => sum + Math.max(1, Math.round((h.targetDaysPerWeek / 7) * elapsedDaysInMonth)),
    0
  );
  const habitConsistencyPct =
    mappedHabits.length > 0 && expectedOpportunities > 0
      ? Math.min(100, Math.round((completedCount / expectedOpportunities) * 100))
      : 0;
  return {
    mappedHabits,
    mappedCompletions,
    summary: {
      totalHabitsTracked: mappedHabits.length,
      monthCompletionsLogged: completedCount,
      expectedOpportunitiesInPeriod: expectedOpportunities,
      habitConsistencyPct,
    },
  };
}

function mapInsightsDomainPayload(
  userId: string,
  rows: {
    fin: any;
    ccRows: any[];
    habits: any[];
    completions: any[];
    fitDailyRows: any[];
    mealRows: any[];
    workoutRows: any[];
    supRows: any[];
    supLogRows: any[];
    moodRows: any[];
  }
) {
  return {
    fin: rows.fin,
    ccStatements: rows.ccRows.map(mapCreditCardStatementFromRow),
    habits: rows.habits,
    completions: rows.completions,
    fitDailyLogs: rows.fitDailyRows.map(mapFitnessDailyLogFromRow),
    meals: rows.mealRows.map(mapMealLogFromRow),
    workouts: rows.workoutRows.map(mapWorkoutSessionFromRow),
    supplements: rows.supRows.map(mapSupplementInventoryFromRow),
    supLogs: rows.supLogRows.map(mapSupplementLogFromRow),
    moodLogs: rows.moodRows.map((m) => mapMoodLogFromRow(m, userId)),
  };
}

async function fetchInsightsDomainRows(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  completionsStart: string;
  window30Start: string;
  referenceDate: string;
}) {
  const { supabase, userId, completionsStart, window30Start, referenceDate } = params;
  const [fin, ccRes, habitsRes, compRes, fitDailyRes, mealRes, workoutRes, supRes, supLogRes, moodRes] =
    await Promise.all([
      fetchFinanceSnapshotData(supabase, userId),
      supabase.from('credit_card_statements').select('*').eq('user_id', userId).is('deleted_at', null),
      supabase.from('habits').select('*').eq('user_id', userId).eq('is_archived', false),
      supabase.from('completions').select('*').eq('user_id', userId).gte('date', completionsStart).lte('date', referenceDate),
      supabase.from('fitness_daily_logs').select('*').eq('user_id', userId).is('deleted_at', null).gte('date', window30Start).lte('date', referenceDate),
      supabase.from('meal_logs').select('*').eq('user_id', userId).is('deleted_at', null).gte('date', window30Start).lte('date', referenceDate),
      supabase.from('workout_sessions').select('*').eq('user_id', userId).is('deleted_at', null).gte('date', window30Start).lte('date', referenceDate),
      supabase.from('supplement_inventory').select('*').eq('user_id', userId).is('deleted_at', null),
      supabase.from('supplement_logs').select('*').eq('user_id', userId).is('deleted_at', null).gte('date', window30Start).lte('date', referenceDate),
      supabase.from('mood_logs').select('*').eq('user_id', userId).gte('date', window30Start).lte('date', referenceDate),
    ]);

  return mapInsightsDomainPayload(userId, {
    fin,
    ccRows: ccRes.data ?? [],
    habits: habitsRes.data ?? [],
    completions: compRes.data ?? [],
    fitDailyRows: fitDailyRes.data ?? [],
    mealRows: mealRes.data ?? [],
    workoutRows: workoutRes.data ?? [],
    supRows: supRes.data ?? [],
    supLogRows: supLogRes.data ?? [],
    moodRows: moodRes.data ?? [],
  });
}

export async function handleGetHabitFinanceInsights(args: { days?: number; monthKey?: string }) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:read') || !hasScope(auth, 'habitflow:finance:read')) {
    return mcpError('Forbidden: Requires both habitflow:read and habitflow:finance:read scopes.');
  }

  const monthKey = args.monthKey || getIstMonthKey();
  const referenceDate = getIstIsoDate();
  const window30Start = addDays(referenceDate, -29);
  const monthStart = `${monthKey}-01`;
  const completionsStart = window30Start < monthStart ? window30Start : monthStart;

  const domain = await fetchInsightsDomainRows({
    supabase: getSupabaseAdmin(),
    userId: auth.userId,
    completionsStart,
    window30Start,
    referenceDate,
  });

  const upcomingObligations7d = calculateUpcomingFinancialObligations({ ...domain.fin, currentDate: referenceDate, withinDays: 7 });
  const anomalies = detectSpendingAnomalies({ selectedMonth: monthKey, ...domain.fin, upcomingObligations7d });
  const forecast = buildCashFlowForecast({
    ...domain.fin,
    creditCardStatements: domain.ccStatements,
    horizonDays: 30,
    referenceDate,
  });

  const habitStats = computeHabitConsistency({
    habits: domain.habits,
    completions: domain.completions,
    userId: auth.userId,
    referenceDate,
    monthKey,
  });
  const crossDomainInsights = computeCrossDomainInsights({
    todayDate: referenceDate,
    transactions: domain.fin.transactions,
    categories: domain.fin.categories,
    debtRecords: domain.fin.debtRecords,
    mealLogs: domain.meals,
    workoutSessions: domain.workouts,
    fitnessDailyLogs: domain.fitDailyLogs,
    supplementInventory: domain.supplements,
    supplementLogs: domain.supLogs,
    habits: habitStats.mappedHabits,
    habitCompletions: habitStats.mappedCompletions,
    moodLogs: domain.moodLogs,
  });

  return mcpJson({
    monthKey,
    referenceDateIst: referenceDate,
    anomaliesDetected: anomalies.length,
    anomalies,
    upcomingObligations7d,
    cashFlowForecast30d: {
      startingLiquidBalance: forecast.startingLiquidBalance,
      endingProjectedBalance: forecast.endingProjectedBalance,
      lowestProjectedBalance: forecast.lowestProjectedBalance,
      lowestBalanceDate: forecast.lowestBalanceDate,
      crunchDate: forecast.crunchDate,
      dailyDiscretionaryBurn: forecast.dailyDiscretionaryBurn,
      estimatedMonthlyIncome: forecast.estimatedMonthlyIncome,
      paydayOfMonth: forecast.paydayOfMonth,
    },
    crossDomainSummary: habitStats.summary,
    crossDomainInsights,
  });
}
