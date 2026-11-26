import { parseISO } from 'date-fns';
import { getMcpAuthContext, hasScope } from './auth';
import { getSupabaseAdmin } from './supabase-admin';
import { getIstIsoDate, getIstMonthKey } from './config';
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
  mapSupplementInventoryFromRow,
  mapSupplementLogFromRow,
  mapWorkoutSessionFromRow,
} from './mappers';
import { calculateHabitStats, getHabitWeekProgress } from '@/lib/calculations';
import {
  calculate7DayRollingWeight,
  calculateDailyFuelSummary,
  calculateSupplementStockAndRoi,
  calculateWeeklyWaistTrend,
} from '@/lib/fitness/shared-analytics';
import {
  calculateMonthlySummary,
  calculateNetWorthSummary,
  calculateFriendLedgerGroups,
} from '@/lib/finance/shared-analytics';
import { addDays, computeCreditCardSummary } from '@/lib/finance/credit-card-cycles';

function resourceJson(uri: URL, payload: unknown) {
  return { contents: [{ uri: uri.href, text: JSON.stringify(payload, null, 2) }] };
}

function resourceError(uri: URL, message: string) {
  return { contents: [{ uri: uri.href, text: JSON.stringify({ error: message }) }] };
}

function formatTodayHabitDue(h: any, compMap: Map<string, any>) {
  const comp = compMap.get(h.id);
  return {
    id: h.id,
    name: h.name,
    category: h.category,
    polarity: h.polarity || 'build',
    anchorBlock: h.anchor_block ?? null,
    isCompleted: comp ? comp.completed : false,
    value: comp?.value ?? null,
    targetValue: h.target_value ?? null,
  };
}

function formatTodayPendingTask(t: any, dateIst: string) {
  return {
    id: t.id,
    title: t.title,
    priority: t.priority,
    dueDate: t.due_date,
    metadata: t.metadata || {},
    isOverdue: t.due_date ? t.due_date < dateIst : false,
  };
}

function buildTodayFitnessSummary(params: {
  profileRow: any;
  bioRow: any;
  mealRows: any[];
  workoutsTodayCount: number;
  dateIst: string;
}) {
  const mappedProfile = params.profileRow ? mapFitnessProfileFromRow(params.profileRow) : null;
  const mappedBio = params.bioRow ? mapFitnessDailyLogFromRow(params.bioRow) : undefined;
  const dailyFuel = calculateDailyFuelSummary(
    params.mealRows.map(mapMealLogFromRow),
    mappedBio,
    mappedProfile,
    params.dateIst
  );
  return {
    caloriesConsumed: dailyFuel.caloriesConsumed,
    calorieTarget: dailyFuel.calorieTarget,
    proteinConsumedG: dailyFuel.proteinConsumedG,
    proteinTargetG: dailyFuel.proteinTargetG,
    waterMl: dailyFuel.waterMl,
    steps: dailyFuel.steps,
    sleepHours: dailyFuel.sleepHours,
    lowEnergyMode: dailyFuel.lowEnergyMode ?? false,
    workoutsTodayCount: params.workoutsTodayCount,
  };
}

async function fetchTodaySummaryTables(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  dateIst: string
) {
  return Promise.all([
    supabase.from('habits').select('*').eq('user_id', userId).eq('is_archived', false),
    supabase.from('completions').select('*').eq('user_id', userId).eq('date', dateIst),
    supabase.from('tasks').select('*').eq('user_id', userId).neq('status', 'archived').or(`due_date.lte.${dateIst},status.eq.todo,status.eq.in_progress`),
    supabase.from('goals').select('*, milestones(*)').eq('user_id', userId).eq('is_archived', false).eq('is_focus', true),
    supabase.from('mood_logs').select('*').eq('user_id', userId).eq('date', dateIst).maybeSingle(),
    supabase.from('fitness_profiles').select('*').eq('user_id', userId).is('deleted_at', null).limit(1),
    supabase.from('fitness_daily_logs').select('*').eq('user_id', userId).eq('date', dateIst).is('deleted_at', null).maybeSingle(),
    supabase.from('meal_logs').select('*').eq('user_id', userId).eq('date', dateIst).is('deleted_at', null),
    supabase.from('workout_sessions').select('*').eq('user_id', userId).eq('date', dateIst).is('deleted_at', null),
  ]);
}

function formatFocusGoalSummary(g: any) {
  return {
    id: g.id,
    title: g.title,
    progress: g.progress,
    financialLink: g.financial_link ?? null,
    fitnessLink: g.fitness_link ?? null,
  };
}

function safeRows<T>(res: { data?: T[] | null }): T[] {
  return res.data ?? [];
}

function buildTodaySummaryPayload(
  dateIst: string,
  tables: Awaited<ReturnType<typeof fetchTodaySummaryTables>>
) {
  const [habitsRes, compRes, tasksRes, goalsRes, moodRes, fitProfileRes, bioRes, mealRes, workoutRes] = tables;
  const compMap = new Map(safeRows(compRes).map((c) => [c.habit_id, c]));
  return {
    dateIst,
    habitsDue: safeRows(habitsRes).map((h) => formatTodayHabitDue(h, compMap)),
    pendingTasks: safeRows(tasksRes)
      .filter((t) => t.status !== 'done')
      .map((t) => formatTodayPendingTask(t, dateIst)),
    focusGoals: safeRows(goalsRes).map(formatFocusGoalSummary),
    todayMood: moodRes.data?.mood ?? null,
    fitnessSummary: buildTodayFitnessSummary({
      profileRow: safeRows(fitProfileRes)[0],
      bioRow: bioRes.data,
      mealRows: safeRows(mealRes),
      workoutsTodayCount: safeRows(workoutRes).length,
      dateIst,
    }),
  };
}

export async function readTodaySummaryResource(uri: URL) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:read')) return resourceError(uri, 'Forbidden: Missing habitflow:read scope.');

  const dateIst = getIstIsoDate();
  const tables = await fetchTodaySummaryTables(getSupabaseAdmin(), auth.userId, dateIst);
  return resourceJson(uri, buildTodaySummaryPayload(dateIst, tables));
}

export async function readActiveHabitsResource(uri: URL) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:read')) return resourceError(uri, 'Forbidden: Missing habitflow:read scope.');

  const dateIst = getIstIsoDate();
  const supabase = getSupabaseAdmin();
  const [{ data: habits }, { data: completions }] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', auth.userId).eq('is_archived', false).order('order_index'),
    supabase.from('completions').select('*').eq('user_id', auth.userId).gte('date', `${getIstMonthKey()}-01`),
  ]);

  const allComps = completions || [];
  const refDate = parseISO(dateIst);
  const enriched = (habits || []).map((h) => {
    const habitComps = allComps.filter((c) => c.habit_id === h.id).map((c) => mapHabitCompletionFromRow(c, auth.userId));
    const habitObj = mapHabitFromRow(h, `${dateIst}T00:00:00.000Z`);
    const stats = calculateHabitStats(habitObj, habitComps, refDate);
    return {
      id: h.id,
      name: h.name,
      category: h.category,
      frequencyType: h.frequency_type,
      currentStreak: stats.currentStreak,
      longestStreak: stats.bestStreak,
      completionRate: stats.completionRate,
      weekProgress: getHabitWeekProgress(habitObj, habitComps, refDate),
      targetValue: h.target_value,
      unit: h.unit,
    };
  });
  return resourceJson(uri, { count: enriched.length, habits: enriched });
}

export async function readFocusGoalsResource(uri: URL) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:read')) return resourceError(uri, 'Forbidden: Missing habitflow:read scope.');

  const supabase = getSupabaseAdmin();
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*, milestones(*)')
    .eq('user_id', auth.userId)
    .eq('is_archived', false)
    .order('is_focus', { ascending: false });

  if (error) return resourceError(uri, error.message);

  const formatted = (goals || []).map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    isFocus: g.is_focus,
    progress: g.progress,
    targetDate: g.target_date,
    milestones: (g.milestones || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      isCompleted: m.is_completed,
    })),
  }));
  return resourceJson(uri, { count: formatted.length, goals: formatted });
}

export async function readFinanceSummaryResource(uri: URL) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:finance:read')) return resourceError(uri, 'Forbidden: Missing habitflow:finance:read scope.');

  const monthKey = getIstMonthKey();
  const referenceDate = getIstIsoDate();
  const supabase = getSupabaseAdmin();
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
    tables.map((t) => supabase.from(t).select('*').eq('user_id', auth.userId).is('deleted_at', null))
  );
  const rows = results.map((r) => r.data || []);
  const data = {
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

  const monthly = calculateMonthlySummary({ monthKey, ...data, referenceDate });
  const netWorth = calculateNetWorthSummary(data);

  return resourceJson(uri, {
    monthKey,
    income: monthly.totalIncome,
    spent: monthly.totalSpent,
    invested: monthly.totalInvested,
    netSavings: monthly.netSavings,
    safeToSpendDaily: monthly.safeToSpendDaily,
    safeToSpendMonthly: monthly.safeToSpendMonthly,
    netWorth: netWorth.netWorth,
    liquidAssets: netWorth.liquidAssets,
  });
}

export async function readCreditCardsSummaryResource(uri: URL) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:finance:read')) return resourceError(uri, 'Forbidden: Missing habitflow:finance:read scope.');

  const referenceDate = getIstIsoDate();
  const supabase = getSupabaseAdmin();
  const { data: cards } = await supabase
    .from('finance_accounts')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('type', 'credit_card')
    .is('deleted_at', null);

  const summaries = [];
  for (const card of cards || []) {
    const [{ data: txs }, { data: statements }] = await Promise.all([
      supabase.from('finance_transactions').select('*').eq('user_id', auth.userId).or(`account_id.eq.${card.id},to_account_id.eq.${card.id}`).is('deleted_at', null),
      supabase.from('credit_card_statements').select('*').eq('user_id', auth.userId).eq('account_id', card.id).is('deleted_at', null),
    ]);
    summaries.push(
      computeCreditCardSummary({
        account: mapFinanceAccountFromRow(card),
        transactions: (txs || []).map(mapFinanceTransactionFromRow),
        persistedStatements: (statements || []).map(mapCreditCardStatementFromRow),
        referenceDate,
      })
    );
  }
  return resourceJson(uri, { count: summaries.length, cards: summaries });
}

export async function readFriendsLedgerSummaryResource(uri: URL) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:finance:read')) return resourceError(uri, 'Forbidden: Missing habitflow:finance:read scope.');

  const supabase = getSupabaseAdmin();
  const { data: debts } = await supabase.from('debt_records').select('*').eq('user_id', auth.userId).is('deleted_at', null);
  const groups = calculateFriendLedgerGroups((debts || []).map(mapDebtRecordFromRow));
  const simplified = groups.map((g) => ({
    friendName: g.friendName,
    contactInfo: g.contactInfo,
    everydayNet: g.everydayNet,
    everydayStatus:
      g.everydayNet > 0 ? `Friend owes you ₹${g.everydayNet}` : g.everydayNet < 0 ? `You owe friend ₹${Math.abs(g.everydayNet)}` : 'Settled',
    longTermLoansNet: g.longTermNetPosition,
    hasActiveEntries: g.hasActiveEntries,
  }));
  return resourceJson(uri, { count: simplified.length, friends: simplified });
}

function buildFitnessTodayPayload(params: {
  dateIst: string;
  profileRow: any;
  dailyRows: any[];
  mealRows: any[];
  workoutRows: any[];
  supRows: any[];
  supLogRows: any[];
}) {
  const profile = params.profileRow ? mapFitnessProfileFromRow(params.profileRow) : null;
  const dailyLogs = params.dailyRows.map(mapFitnessDailyLogFromRow);
  const todayMeals = params.mealRows.map(mapMealLogFromRow);
  const recentWorkouts = params.workoutRows.map(mapWorkoutSessionFromRow);
  const supplements = params.supRows.map(mapSupplementInventoryFromRow);
  const supLogs = params.supLogRows.map(mapSupplementLogFromRow);

  const dailyFuel = calculateDailyFuelSummary(todayMeals, dailyLogs.find((d) => d.date === params.dateIst), profile, params.dateIst);
  const rollingWeight = calculate7DayRollingWeight(dailyLogs);
  const waistTrend = calculateWeeklyWaistTrend(dailyLogs);
  const supRoi = calculateSupplementStockAndRoi(supplements, supLogs, params.dateIst);

  return {
    dateIst: params.dateIst,
    dailyFuel,
    rollingWeight: {
      latestWeightKg: rollingWeight.latestWeightKg,
      latestRollingAvgKg: rollingWeight.latestRollingAvgKg,
      weeklyDeltaKg: rollingWeight.weeklyDeltaKg,
    },
    waistTrend: {
      latestWaistInches: waistTrend.latestWaistInches,
      totalDeltaInches: waistTrend.totalDeltaInches,
    },
    todayMeals,
    recentWorkoutsCount: recentWorkouts.length,
    lowStockSupplements: supRoi.lowStockItems.map((i) => ({
      id: i.supplement.id,
      name: i.supplement.name,
      daysRemaining: i.daysRemaining,
    })),
  };
}

export async function readFitnessTodayResource(uri: URL) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:read')) return resourceError(uri, 'Forbidden: Missing habitflow:read scope.');

  const dateIst = getIstIsoDate();
  const supabase = getSupabaseAdmin();
  const [profileRes, dailyRes, mealRes, workoutRes, supRes, supLogRes] = await Promise.all([
    supabase.from('fitness_profiles').select('*').eq('user_id', auth.userId).is('deleted_at', null).limit(1),
    supabase.from('fitness_daily_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', addDays(dateIst, -45)).lte('date', dateIst),
    supabase.from('meal_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).eq('date', dateIst),
    supabase.from('workout_sessions').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', addDays(dateIst, -14)).lte('date', dateIst),
    supabase.from('supplement_inventory').select('*').eq('user_id', auth.userId).is('deleted_at', null),
    supabase.from('supplement_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', addDays(dateIst, -30)),
  ]);

  return resourceJson(
    uri,
    buildFitnessTodayPayload({
      dateIst,
      profileRow: profileRes.data?.[0],
      dailyRows: dailyRes.data || [],
      mealRows: mealRes.data || [],
      workoutRows: workoutRes.data || [],
      supRows: supRes.data || [],
      supLogRows: supLogRes.data || [],
    })
  );
}
