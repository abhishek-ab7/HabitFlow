import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
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
} from '../mappers';
import { calculateDailyFuelSummary } from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import { detectSpendingAnomalies } from '@/lib/finance/anomalies';
import { buildCashFlowForecast } from '@/lib/finance/forecast';
import { addDays } from '@/lib/finance/credit-card-cycles';
import { calculateMonthlySummary, calculateUpcomingFinancialObligations } from '@/lib/finance/shared-analytics';

export function registerBriefingInsightsTools(server: McpServer) {
  // 1. get_daily_briefing
  server.registerTool(
    'get_daily_briefing',
    {
      title: 'Get Daily Briefing',
      description:
        'Retrieves an IST-aligned consolidated daily briefing covering due habits, urgent & overdue tasks, focus goals, today mood log, and optionally finance snapshot and obligations.',
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
          .optional()
          .describe('Target date in YYYY-MM-DD (defaults to today in IST)'),
        includeFinance: z
          .boolean()
          .optional()
          .describe('Whether to include finance summary and upcoming bill/EMI obligations (requires habitflow:finance:read)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read')) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }],
        };
      }

      const dateIst = args.date || getIstIsoDate();
      const window30Start = addDays(dateIst, -29);
      const supabase = getSupabaseAdmin();

      // Fetch habits, completions, tasks, goals, mood, and fitness telemetry for date
      const [
        { data: habits },
        { data: completions },
        { data: tasks },
        { data: goals },
        { data: moodLog },
        { data: fitProfileRows },
        { data: fitDailyRows },
        { data: mealRows },
        { data: workoutRows },
        { data: supRows },
        { data: supLogRows },
      ] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', auth.userId).eq('is_archived', false),
        supabase.from('completions').select('*').eq('user_id', auth.userId).gte('date', window30Start).lte('date', dateIst),
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
        supabase.from('mood_logs').select('*').eq('user_id', auth.userId).gte('date', window30Start).lte('date', dateIst),
        supabase.from('fitness_profiles').select('*').eq('user_id', auth.userId).is('deleted_at', null).limit(1),
        supabase.from('fitness_daily_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', window30Start).lte('date', dateIst),
        supabase.from('meal_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', window30Start).lte('date', dateIst),
        supabase.from('workout_sessions').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', window30Start).lte('date', dateIst),
        supabase.from('supplement_inventory').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('supplement_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', window30Start).lte('date', dateIst),
      ]);

      const todayComps = (completions || []).filter((c) => c.date === dateIst);
      const completionMap = new Map(todayComps.map((c) => [c.habit_id, c]));
      const habitsDue = (habits || []).map((h) => {
        const comp = completionMap.get(h.id);
        return {
          id: h.id,
          name: h.name,
          category: h.category,
          polarity: h.polarity || 'build',
          anchorBlock: h.anchor_block ?? null,
          frequencyType: h.frequency_type,
          isCompleted: comp ? comp.completed : false,
          status: comp?.status || (comp?.completed ? 'completed' : 'pending'),
          value: comp?.value ?? null,
          targetValue: h.target_value ?? null,
          unit: h.unit ?? null,
        };
      });

      const tasksDueAndOverdue = (tasks || [])
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

      const focusGoals = (goals || []).map((g) => ({
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

      const mappedFitProfile =
        fitProfileRows && fitProfileRows[0] ? mapFitnessProfileFromRow(fitProfileRows[0]) : null;
      const mappedFitLogs = (fitDailyRows || []).map(mapFitnessDailyLogFromRow);
      const mappedMeals = (mealRows || []).map(mapMealLogFromRow);
      const mappedWorkouts = (workoutRows || []).map(mapWorkoutSessionFromRow);
      const mappedSupplements = (supRows || []).map(mapSupplementInventoryFromRow);
      const mappedSupLogs = (supLogRows || []).map(mapSupplementLogFromRow);
      const mappedMoodLogs = (moodLog || []).map((m) => mapMoodLogFromRow(m, auth.userId));
      const todayMoodRec = mappedMoodLogs.find((m) => m.date === dateIst);

      const todayFitLog = mappedFitLogs.find((d) => d.date === dateIst);
      const dailyFuel = calculateDailyFuelSummary(mappedMeals, todayFitLog, mappedFitProfile, dateIst);

      let financeSnapshot = null;
      let upcomingObligations = null;
      let financeTxsForInsights: ReturnType<typeof mapFinanceTransactionFromRow>[] = [];
      let financeCatsForInsights: ReturnType<typeof mapFinanceCategoryFromRow>[] = [];
      let financeDebtsForInsights: ReturnType<typeof mapDebtRecordFromRow>[] = [];

      if (args.includeFinance && hasScope(auth, 'habitflow:finance:read')) {
        const monthKey = dateIst.substring(0, 7);
        const [
          _accountsRes,
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
        void _accountsRes;

        const mappedTxs = (txs || []).map(mapFinanceTransactionFromRow);
        const mappedCategories = (categories || []).map(mapFinanceCategoryFromRow);
        const mappedBudgets = (budgets || []).map(mapFinanceBudgetFromRow);
        const mappedCommitments = (commitments || []).map(mapMonthlyCommitmentFromRow);
        const mappedEmis = (emis || []).map(mapEmiTrackerFromRow);
        const mappedDebts = (debts || []).map(mapDebtRecordFromRow);
        const mappedDebtInsts = (debtInsts || []).map(mapDebtInstallmentFromRow);
        const mappedBills = (bills || []).map(mapFinanceRecurringBillFromRow);
        const mappedSips = (sips || []).map(mapFinanceSipPlanFromRow);

        financeTxsForInsights = mappedTxs;
        financeCatsForInsights = mappedCategories;
        financeDebtsForInsights = mappedDebts;

        const monthlySummary = calculateMonthlySummary({
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
          referenceDate: dateIst,
        });

        financeSnapshot = {
          monthKey,
          totalSpent: monthlySummary.totalSpent,
          totalIncome: monthlySummary.totalIncome,
          safeToSpendDaily: monthlySummary.safeToSpendDaily,
          safeToSpendMonthly: monthlySummary.safeToSpendMonthly,
        };

        upcomingObligations = calculateUpcomingFinancialObligations({
          emiTrackers: mappedEmis,
          commitments: mappedCommitments,
          debtRecords: mappedDebts,
          debtInstallments: mappedDebtInsts,
          recurringBills: mappedBills,
          sipPlans: mappedSips,
          transactions: mappedTxs,
          currentDate: dateIst,
          withinDays: 7,
        });
      }

      const mappedCompletions = (completions || []).map((c) =>
        mapHabitCompletionFromRow(c, auth.userId)
      );
      const crossDomainInsights = computeCrossDomainInsights({
        todayDate: dateIst,
        transactions: financeTxsForInsights,
        categories: financeCatsForInsights,
        debtRecords: financeDebtsForInsights,
        mealLogs: mappedMeals,
        workoutSessions: mappedWorkouts,
        fitnessDailyLogs: mappedFitLogs,
        supplementInventory: mappedSupplements,
        supplementLogs: mappedSupLogs,
        habits: (habits || []).map((h) => mapHabitFromRow(h, dateIst)),
        habitCompletions: mappedCompletions,
        moodLogs: mappedMoodLogs,
      });

      const result = {
        dateIst,
        habitsDue,
        tasksDueAndOverdue,
        focusGoals,
        todayMood: todayMoodRec ? { mood: todayMoodRec.mood, date: todayMoodRec.date } : null,
        fitnessSummary: {
          dailyFuel,
          workoutsTodayCount: mappedWorkouts.filter((w) => w.date === dateIst).length,
        },
        crossDomainInsights: {
          alerts: crossDomainInsights.alerts,
          walletWaistline: crossDomainInsights.walletWaistline,
          gymSupplementRoi: crossDomainInsights.gymSupplementRoi,
          triggers: crossDomainInsights.triggers,
        },
        financeSnapshot,
        upcomingObligations,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // 2. get_habit_finance_insights
  server.registerTool(
    'get_habit_finance_insights',
    {
      title: 'Get Cross-Domain Habit & Finance Insights',
      description:
        'Analyzes spending anomalies, 30-day cash flow forecast runway, and correlates habit completion consistency with spending pace.',
      inputSchema: {
        days: z.number().int().min(14).max(90).optional().default(30).describe('Window of days to analyze'),
        monthKey: z
          .string()
          .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM')
          .optional()
          .describe('Target month (defaults to current month in IST)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read') || !hasScope(auth, 'habitflow:finance:read')) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Forbidden: Requires both habitflow:read and habitflow:finance:read scopes.',
            },
          ],
        };
      }

      const monthKey = args.monthKey || getIstMonthKey();
      const referenceDate = getIstIsoDate();
      const window30Start = addDays(referenceDate, -29);
      const monthStart = `${monthKey}-01`;
      const completionsStart = window30Start < monthStart ? window30Start : monthStart;
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
        { data: ccStatements },
        { data: habits },
        { data: completions },
        { data: fitDailyRows },
        { data: mealRows },
        { data: workoutRows },
        { data: supRows },
        { data: supLogRows },
        { data: moodRows },
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
        supabase.from('credit_card_statements').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('habits').select('*').eq('user_id', auth.userId).eq('is_archived', false),
        supabase.from('completions').select('*').eq('user_id', auth.userId).gte('date', completionsStart).lte('date', referenceDate),
        supabase.from('fitness_daily_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', window30Start).lte('date', referenceDate),
        supabase.from('meal_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', window30Start).lte('date', referenceDate),
        supabase.from('workout_sessions').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', window30Start).lte('date', referenceDate),
        supabase.from('supplement_inventory').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('supplement_logs').select('*').eq('user_id', auth.userId).is('deleted_at', null).gte('date', window30Start).lte('date', referenceDate),
        supabase.from('mood_logs').select('*').eq('user_id', auth.userId).gte('date', window30Start).lte('date', referenceDate),
      ]);

      const mappedAccounts = (accounts as any[])?.map(mapFinanceAccountFromRow) || [];
      const transactions = (txs as any[])?.map(mapFinanceTransactionFromRow) || [];
      const mappedCategories = (categories as any[])?.map(mapFinanceCategoryFromRow) || [];
      const mappedBudgets = (budgets as any[])?.map(mapFinanceBudgetFromRow) || [];
      const mappedCommitments = (commitments as any[])?.map(mapMonthlyCommitmentFromRow) || [];
      const mappedEmis = (emis as any[])?.map(mapEmiTrackerFromRow) || [];
      const mappedDebts = (debts as any[])?.map(mapDebtRecordFromRow) || [];
      const mappedDebtInsts = (debtInsts as any[])?.map(mapDebtInstallmentFromRow) || [];
      const mappedBills = (bills as any[])?.map(mapFinanceRecurringBillFromRow) || [];
      const mappedSips = (sips as any[])?.map(mapFinanceSipPlanFromRow) || [];
      const mappedCcStatements = (ccStatements as any[])?.map(mapCreditCardStatementFromRow) || [];

      const upcomingObligations7d = calculateUpcomingFinancialObligations({
        emiTrackers: mappedEmis,
        commitments: mappedCommitments,
        debtRecords: mappedDebts,
        debtInstallments: mappedDebtInsts,
        recurringBills: mappedBills,
        sipPlans: mappedSips,
        transactions,
        currentDate: referenceDate,
        withinDays: 7,
      });

      const anomalies = detectSpendingAnomalies({
        selectedMonth: monthKey,
        transactions,
        categories: mappedCategories,
        accounts: mappedAccounts,
        debtRecords: mappedDebts,
        recurringBills: mappedBills,
        upcomingObligations7d,
      });
      const forecast = buildCashFlowForecast({
        accounts: mappedAccounts,
        transactions,
        budgets: mappedBudgets,
        recurringBills: mappedBills,
        emiTrackers: mappedEmis,
        sipPlans: mappedSips,
        commitments: mappedCommitments,
        creditCardStatements: mappedCcStatements,
        horizonDays: 30,
        referenceDate,
      });

      const mappedHabits = (habits || []).map((h) => mapHabitFromRow(h, referenceDate));
      const totalHabits = mappedHabits.length;
      const elapsedDaysInMonth = Math.max(
        1,
        referenceDate.startsWith(monthKey)
          ? parseInt(referenceDate.slice(8, 10), 10)
          : new Date(
              parseInt(monthKey.slice(0, 4), 10),
              parseInt(monthKey.slice(5, 7), 10),
              0
            ).getDate()
      );
      const mappedCompletions = (completions || []).map((c) =>
        mapHabitCompletionFromRow(c, auth.userId)
      );
      const completedCount = mappedCompletions.filter(
        (c) =>
          c.date.startsWith(monthKey) &&
          c.completed &&
          c.status !== 'frozen' &&
          c.status !== 'rest' &&
          !c.skipped
      ).length;
      const expectedOpportunities = mappedHabits.reduce(
        (sum, h) => sum + Math.max(1, Math.round((h.targetDaysPerWeek / 7) * elapsedDaysInMonth)),
        0
      );
      const habitCompletionRate =
        totalHabits > 0 && expectedOpportunities > 0
          ? Math.min(100, Math.round((completedCount / expectedOpportunities) * 100))
          : 0;

      const crossDomainInsights = computeCrossDomainInsights({
        todayDate: referenceDate,
        transactions,
        categories: mappedCategories,
        debtRecords: mappedDebts,
        mealLogs: (mealRows || []).map(mapMealLogFromRow),
        workoutSessions: (workoutRows || []).map(mapWorkoutSessionFromRow),
        fitnessDailyLogs: (fitDailyRows || []).map(mapFitnessDailyLogFromRow),
        supplementInventory: (supRows || []).map(mapSupplementInventoryFromRow),
        supplementLogs: (supLogRows || []).map(mapSupplementLogFromRow),
        habits: mappedHabits,
        habitCompletions: mappedCompletions,
        moodLogs: (moodRows || []).map((m) => mapMoodLogFromRow(m, auth.userId)),
      });

      const result = {
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
        },
        crossDomainSummary: {
          totalHabitsTracked: totalHabits,
          monthCompletionsLogged: completedCount,
          expectedOpportunitiesInPeriod: expectedOpportunities,
          habitConsistencyPct: habitCompletionRate,
        },
        crossDomainInsights,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
