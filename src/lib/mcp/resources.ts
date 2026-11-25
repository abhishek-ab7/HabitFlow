import { parseISO } from 'date-fns';
import type { McpServer } from '@modelcontextprotocol/server';
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

export function registerMcpResources(server: McpServer) {
  // 1. habitflow://today
  server.registerResource(
    'today_summary',
    'habitflow://today',
    {
      title: "Today's HabitFlow Snapshot",
      description: "Live daily briefing snapshot for today in IST: habits due, overdue/due tasks, focus goals, and mood.",
      mimeType: 'application/json',
    },
    async (uri) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read')) {
        return {
          contents: [{ uri: uri.href, text: JSON.stringify({ error: 'Forbidden: Missing habitflow:read scope.' }) }],
        };
      }

      const dateIst = getIstIsoDate();
      const supabase = getSupabaseAdmin();

      const [
        { data: habits },
        { data: completions },
        { data: tasks },
        { data: goals },
        { data: mood },
        { data: fitProfileRows },
        { data: todayBioRow },
        { data: todayMealRows },
        { data: todayWorkoutRows },
      ] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', auth.userId).eq('is_archived', false),
        supabase.from('completions').select('*').eq('user_id', auth.userId).eq('date', dateIst),
        supabase
          .from('tasks')
          .select('*')
          .eq('user_id', auth.userId)
          .neq('status', 'archived')
          .or(`due_date.lte.${dateIst},status.eq.todo,status.eq.in_progress`),
        supabase
          .from('goals')
          .select('*, milestones(*)')
          .eq('user_id', auth.userId)
          .eq('is_archived', false)
          .eq('is_focus', true),
        supabase.from('mood_logs').select('*').eq('user_id', auth.userId).eq('date', dateIst).maybeSingle(),
        supabase.from('fitness_profiles').select('*').eq('user_id', auth.userId).is('deleted_at', null).limit(1),
        supabase.from('fitness_daily_logs').select('*').eq('user_id', auth.userId).eq('date', dateIst).is('deleted_at', null).maybeSingle(),
        supabase.from('meal_logs').select('*').eq('user_id', auth.userId).eq('date', dateIst).is('deleted_at', null),
        supabase.from('workout_sessions').select('*').eq('user_id', auth.userId).eq('date', dateIst).is('deleted_at', null),
      ]);

      const compMap = new Map((completions || []).map((c) => [c.habit_id, c]));
      const habitsDue = (habits || []).map((h) => {
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
      });

      const pendingTasks = (tasks || [])
        .filter((t) => t.status !== 'done')
        .map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.due_date,
          metadata: t.metadata || {},
          isOverdue: t.due_date ? t.due_date < dateIst : false,
        }));

      const mappedProfile = fitProfileRows?.[0] ? mapFitnessProfileFromRow(fitProfileRows[0]) : null;
      const mappedBio = todayBioRow ? mapFitnessDailyLogFromRow(todayBioRow) : undefined;
      const mappedMeals = (todayMealRows || []).map(mapMealLogFromRow);
      const dailyFuel = calculateDailyFuelSummary(mappedMeals, mappedBio, mappedProfile, dateIst);

      const payload = {
        dateIst,
        habitsDue,
        pendingTasks,
        focusGoals: (goals || []).map((g) => ({
          id: g.id,
          title: g.title,
          progress: g.progress,
          financialLink: g.financial_link ?? null,
          fitnessLink: g.fitness_link ?? null,
        })),
        todayMood: mood?.mood ?? null,
        fitnessSummary: {
          caloriesConsumed: dailyFuel.caloriesConsumed,
          calorieTarget: dailyFuel.calorieTarget,
          proteinConsumedG: dailyFuel.proteinConsumedG,
          proteinTargetG: dailyFuel.proteinTargetG,
          waterMl: dailyFuel.waterMl,
          steps: dailyFuel.steps,
          sleepHours: dailyFuel.sleepHours,
          lowEnergyMode: dailyFuel.lowEnergyMode ?? false,
          workoutsTodayCount: (todayWorkoutRows || []).length,
        },
      };

      return { contents: [{ uri: uri.href, text: JSON.stringify(payload, null, 2) }] };
    }
  );

  // 2. habitflow://habits/active
  server.registerResource(
    'active_habits',
    'habitflow://habits/active',
    {
      title: 'Active Habits & Streaks',
      description: 'All active habits with streak counters, weekly progress, and target configurations.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read')) {
        return {
          contents: [{ uri: uri.href, text: JSON.stringify({ error: 'Forbidden: Missing habitflow:read scope.' }) }],
        };
      }

      const dateIst = getIstIsoDate();
      const supabase = getSupabaseAdmin();

      const [{ data: habits }, { data: completions }] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', auth.userId).eq('is_archived', false).order('order_index'),
        supabase.from('completions').select('*').eq('user_id', auth.userId).gte('date', `${getIstMonthKey()}-01`),
      ]);

      const allComps = completions || [];
      const refDate = parseISO(dateIst);
      const enriched = (habits || []).map((h) => {
        const habitComps = allComps
          .filter((c) => c.habit_id === h.id)
          .map((c) => mapHabitCompletionFromRow(c, auth.userId));

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

      return { contents: [{ uri: uri.href, text: JSON.stringify({ count: enriched.length, habits: enriched }, null, 2) }] };
    }
  );

  // 3. habitflow://goals/focus
  server.registerResource(
    'focus_goals',
    'habitflow://goals/focus',
    {
      title: 'Top Focus Goals',
      description: 'Active top-priority goals with milestone status, progress bars, and target dates.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read')) {
        return {
          contents: [{ uri: uri.href, text: JSON.stringify({ error: 'Forbidden: Missing habitflow:read scope.' }) }],
        };
      }

      const supabase = getSupabaseAdmin();
      const { data: goals, error } = await supabase
        .from('goals')
        .select('*, milestones(*)')
        .eq('user_id', auth.userId)
        .eq('is_archived', false)
        .order('is_focus', { ascending: false });

      if (error) {
        return { contents: [{ uri: uri.href, text: JSON.stringify({ error: error.message }) }] };
      }

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

      return { contents: [{ uri: uri.href, text: JSON.stringify({ count: formatted.length, goals: formatted }, null, 2) }] };
    }
  );

  // 4. habitflow://finance/summary
  server.registerResource(
    'finance_summary',
    'habitflow://finance/summary',
    {
      title: 'Current Month Financial Summary',
      description: 'Monthly income, expense, net savings, budget pace, liquid cash, and total net worth.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:finance:read')) {
        return {
          contents: [{ uri: uri.href, text: JSON.stringify({ error: 'Forbidden: Missing habitflow:finance:read scope.' }) }],
        };
      }

      const monthKey = getIstMonthKey();
      const referenceDate = getIstIsoDate();
      const supabase = getSupabaseAdmin();

      const [
        { data: accounts },
        { data: txs },
        { data: categories },
        { data: budgets },
        { data: commitments },
        { data: emis },
        { data: debts },
        { data: debtInsts },
        { data: bills },
        { data: sips },
      ] = await Promise.all([
        supabase.from('finance_accounts').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_transactions').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_categories').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_budgets').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('monthly_commitments').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('emi_trackers').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('debt_records').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('debt_installments').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_recurring_bills').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_sip_plans').select('*').eq('user_id', auth.userId).is('deleted_at', null),
      ]);

      const mappedAccounts = (accounts || []).map(mapFinanceAccountFromRow);
      const mappedTxs = (txs || []).map(mapFinanceTransactionFromRow);
      const mappedCategories = (categories || []).map(mapFinanceCategoryFromRow);
      const mappedBudgets = (budgets || []).map(mapFinanceBudgetFromRow);
      const mappedCommitments = (commitments || []).map(mapMonthlyCommitmentFromRow);
      const mappedEmis = (emis || []).map(mapEmiTrackerFromRow);
      const mappedDebts = (debts || []).map(mapDebtRecordFromRow);
      const mappedDebtInsts = (debtInsts || []).map(mapDebtInstallmentFromRow);
      const mappedBills = (bills || []).map(mapFinanceRecurringBillFromRow);
      const mappedSips = (sips || []).map(mapFinanceSipPlanFromRow);

      const monthly = calculateMonthlySummary({
        monthKey,
        transactions: mappedTxs,
        categories: mappedCategories,
        budgets: mappedBudgets,
        commitments: mappedCommitments,
        emiTrackers: mappedEmis,
        debtRecords: mappedDebts,
        debtInstallments: mappedDebtInsts,
        recurringBills: mappedBills,
        sipPlans: mappedSips,
        referenceDate,
      });

      const netWorth = calculateNetWorthSummary({
        accounts: mappedAccounts,
        sipPlans: mappedSips,
        debtRecords: mappedDebts,
        emiTrackers: mappedEmis,
      });

      const payload = {
        monthKey,
        income: monthly.totalIncome,
        spent: monthly.totalSpent,
        invested: monthly.totalInvested,
        netSavings: monthly.netSavings,
        safeToSpendDaily: monthly.safeToSpendDaily,
        safeToSpendMonthly: monthly.safeToSpendMonthly,
        netWorth: netWorth.netWorth,
        liquidAssets: netWorth.liquidAssets,
      };

      return { contents: [{ uri: uri.href, text: JSON.stringify(payload, null, 2) }] };
    }
  );

  // 5. habitflow://finance/credit-cards
  server.registerResource(
    'credit_cards_summary',
    'habitflow://finance/credit-cards',
    {
      title: 'Credit Cards & Dual-Cycle Statements',
      description: 'Active credit card utilization, current unbilled cycle spends, and open billed statement balances.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:finance:read')) {
        return {
          contents: [{ uri: uri.href, text: JSON.stringify({ error: 'Forbidden: Missing habitflow:finance:read scope.' }) }],
        };
      }

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
          supabase
            .from('finance_transactions')
            .select('*')
            .eq('user_id', auth.userId)
            .or(`account_id.eq.${card.id},to_account_id.eq.${card.id}`)
            .is('deleted_at', null),
          supabase
            .from('credit_card_statements')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('account_id', card.id)
            .is('deleted_at', null),
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

      return { contents: [{ uri: uri.href, text: JSON.stringify({ count: summaries.length, cards: summaries }, null, 2) }] };
    }
  );

  // 6. habitflow://finance/friends-ledger
  server.registerResource(
    'friends_ledger_summary',
    'habitflow://finance/friends-ledger',
    {
      title: 'Friends Isolated Ledger Summary',
      description: 'Per-friend isolated Everyday Tab balances and Long-Term Loan balances.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:finance:read')) {
        return {
          contents: [{ uri: uri.href, text: JSON.stringify({ error: 'Forbidden: Missing habitflow:finance:read scope.' }) }],
        };
      }

      const supabase = getSupabaseAdmin();
      const { data: debts } = await supabase
        .from('debt_records')
        .select('*')
        .eq('user_id', auth.userId)
        .is('deleted_at', null);

      const groups = calculateFriendLedgerGroups((debts || []).map(mapDebtRecordFromRow));

      const simplified = groups.map((g) => ({
        friendName: g.friendName,
        contactInfo: g.contactInfo,
        everydayNet: g.everydayNet,
        everydayStatus: g.everydayNet > 0 ? `Friend owes you ₹${g.everydayNet}` : g.everydayNet < 0 ? `You owe friend ₹${Math.abs(g.everydayNet)}` : 'Settled',
        longTermLoansNet: g.longTermNetPosition,
        hasActiveEntries: g.hasActiveEntries,
      }));

      return { contents: [{ uri: uri.href, text: JSON.stringify({ count: simplified.length, friends: simplified }, null, 2) }] };
    }
  );

  // 7. habitflow://fitness/today
  server.registerResource(
    'fitness_today',
    'habitflow://fitness/today',
    {
      title: "Today's Fitness, Diet & Supplement Telemetry",
      description:
        'Live IST body metrics, Big 2 calories/protein fuel progress, 7d rolling weight, waist trend, today meals/workouts, and supplement low-stock alert status.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read')) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: 'Forbidden: Missing habitflow:read scope.' }),
            },
          ],
        };
      }

      const dateIst = getIstIsoDate();
      const supabase = getSupabaseAdmin();

      const [
        { data: profileRows },
        { data: dailyRows },
        { data: mealRows },
        { data: workoutRows },
        { data: supRows },
        { data: supLogRows },
      ] = await Promise.all([
        supabase.from('fitness_profiles').select('*').eq('user_id', auth.userId).is('deleted_at', null).limit(1),
        supabase.from('fitness_daily_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', addDays(dateIst, -45)).lte('date', dateIst),
        supabase.from('meal_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).eq('date', dateIst),
        supabase.from('workout_sessions').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', addDays(dateIst, -14)).lte('date', dateIst),
        supabase.from('supplement_inventory').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('supplement_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', addDays(dateIst, -30)),
      ]);

      const profile = profileRows?.[0] ? mapFitnessProfileFromRow(profileRows[0]) : null;
      const dailyLogs = (dailyRows || []).map(mapFitnessDailyLogFromRow);
      const todayMeals = (mealRows || []).map(mapMealLogFromRow);
      const recentWorkouts = (workoutRows || []).map(mapWorkoutSessionFromRow);
      const supplements = (supRows || []).map(mapSupplementInventoryFromRow);
      const supLogs = (supLogRows || []).map(mapSupplementLogFromRow);

      const todayLog = dailyLogs.find((d) => d.date === dateIst);
      const dailyFuel = calculateDailyFuelSummary(todayMeals, todayLog, profile, dateIst);
      const rollingWeight = calculate7DayRollingWeight(dailyLogs);
      const waistTrend = calculateWeeklyWaistTrend(dailyLogs);
      const supRoi = calculateSupplementStockAndRoi(supplements, supLogs, dateIst);

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(
              {
                dateIst,
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
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
