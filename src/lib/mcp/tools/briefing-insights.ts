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
  mapMonthlyCommitmentFromRow,
} from '../mappers';
import { calculateHabitStats } from '@/lib/calculations';
import { detectSpendingAnomalies } from '@/lib/finance/anomalies';
import { buildCashFlowForecast } from '@/lib/finance/forecast';
import { calculateMonthlySummary, calculateNetWorthSummary, calculateUpcomingFinancialObligations } from '@/lib/finance/shared-analytics';

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
      const supabase = getSupabaseAdmin();

      // Fetch habits & completions for date
      const [{ data: habits }, { data: completions }, { data: tasks }, { data: goals }, { data: moodLog }] =
        await Promise.all([
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
        ]);

      const completionMap = new Map((completions || []).map((c) => [c.habit_id, c]));
      const habitsDue = (habits || []).map((h) => {
        const comp = completionMap.get(h.id);
        return {
          id: h.id,
          name: h.name,
          category: h.category,
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
        milestones: (g.milestones || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          isCompleted: m.is_completed,
        })),
      }));

      let financeSnapshot = null;
      let upcomingObligations = null;

      if (args.includeFinance && hasScope(auth, 'habitflow:finance:read')) {
        const monthKey = dateIst.substring(0, 7);
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

        const mappedTxs = (txs || []).map(mapFinanceTransactionFromRow);
        const mappedCategories = (categories || []).map(mapFinanceCategoryFromRow);
        const mappedBudgets = (budgets || []).map(mapFinanceBudgetFromRow);
        const mappedCommitments = (commitments || []).map(mapMonthlyCommitmentFromRow);
        const mappedEmis = (emis || []).map(mapEmiTrackerFromRow);
        const mappedDebts = (debts || []).map(mapDebtRecordFromRow);
        const mappedDebtInsts = (debtInsts || []).map(mapDebtInstallmentFromRow);
        const mappedBills = (bills || []).map(mapFinanceRecurringBillFromRow);
        const mappedSips = (sips || []).map(mapFinanceSipPlanFromRow);

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

      const result = {
        dateIst,
        habitsDue,
        tasksDueAndOverdue,
        focusGoals,
        todayMood: moodLog ? { mood: moodLog.mood, date: moodLog.date } : null,
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
      const supabase = getSupabaseAdmin();

      const [
        { data: accounts },
        { data: txs },
        { data: categories },
        { data: budgets },
        { data: commitments },
        { data: emis },
        { data: bills },
        { data: sips },
        { data: ccStatements },
        { data: habits },
        { data: completions },
      ] = await Promise.all([
        supabase.from('finance_accounts').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_transactions').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_categories').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_budgets').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('monthly_commitments').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('emi_trackers').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_recurring_bills').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_sip_plans').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('credit_card_statements').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('habits').select('*').eq('user_id', auth.userId).eq('is_archived', false),
        supabase.from('completions').select('*').eq('user_id', auth.userId).gte('date', `${monthKey}-01`),
      ]);

      const mappedAccounts = (accounts as any[])?.map(mapFinanceAccountFromRow) || [];
      const transactions = (txs as any[])?.map(mapFinanceTransactionFromRow) || [];
      const mappedCategories = (categories as any[])?.map(mapFinanceCategoryFromRow) || [];
      const mappedBudgets = (budgets as any[])?.map(mapFinanceBudgetFromRow) || [];
      const mappedCommitments = (commitments as any[])?.map(mapMonthlyCommitmentFromRow) || [];
      const mappedEmis = (emis as any[])?.map(mapEmiTrackerFromRow) || [];
      const mappedBills = (bills as any[])?.map(mapFinanceRecurringBillFromRow) || [];
      const mappedSips = (sips as any[])?.map(mapFinanceSipPlanFromRow) || [];
      const mappedCcStatements = (ccStatements as any[])?.map(mapCreditCardStatementFromRow) || [];

      const anomalies = detectSpendingAnomalies({
        selectedMonth: monthKey,
        transactions,
        categories: mappedCategories,
        accounts: mappedAccounts,
        debtRecords: [],
        recurringBills: mappedBills,
        upcomingObligations7d: [],
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

      const totalHabits = (habits || []).length;
      const completedCount = (completions || []).filter((c) => c.completed).length;
      const habitCompletionRate = totalHabits > 0 ? Math.round((completedCount / (totalHabits * 30)) * 100) : 0;

      const result = {
        monthKey,
        referenceDateIst: referenceDate,
        anomaliesDetected: anomalies.length,
        anomalies,
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
          habitConsistencyPct: habitCompletionRate,
        },
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
