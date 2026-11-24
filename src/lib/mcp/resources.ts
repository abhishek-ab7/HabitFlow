import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from './auth';
import { getSupabaseAdmin } from './supabase-admin';
import { getIstIsoDate, getIstMonthKey } from './config';
import { calculateHabitStats, getHabitWeekProgress } from '@/lib/calculations';
import {
  calculateMonthlySummary,
  calculateNetWorthSummary,
  calculateFriendLedgerGroups,
} from '@/lib/finance/shared-analytics';
import { computeCreditCardSummary } from '@/lib/finance/credit-card-cycles';

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

      const [{ data: habits }, { data: completions }, { data: tasks }, { data: goals }, { data: mood }] =
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

      const compMap = new Map((completions || []).map((c) => [c.habit_id, c]));
      const habitsDue = (habits || []).map((h) => {
        const comp = compMap.get(h.id);
        return {
          id: h.id,
          name: h.name,
          category: h.category,
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
          isOverdue: t.due_date ? t.due_date < dateIst : false,
        }));

      const payload = {
        dateIst,
        habitsDue,
        pendingTasks,
        focusGoals: (goals || []).map((g) => ({ id: g.id, title: g.title, progress: g.progress })),
        todayMood: mood?.mood ?? null,
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
      const enriched = (habits || []).map((h) => {
        const habitComps = allComps
          .filter((c) => c.habit_id === h.id)
          .map((c) => ({
            id: c.id,
            userId: auth.userId,
            habitId: c.habit_id,
            date: c.date,
            completed: c.completed,
            skipped: c.skipped,
            status: c.status,
            restReason: c.rest_reason,
            value: c.value,
          }));

        const habitObj: any = {
          id: h.id,
          name: h.name,
          category: h.category,
          frequencyType: h.frequency_type,
          scheduledDays: h.scheduled_days,
          intervalDays: h.interval_days,
          targetDays: h.target_days,
          isQuantitative: h.is_quantitative,
          targetValue: h.target_value,
          unit: h.unit,
        };

        const stats = calculateHabitStats(habitObj, habitComps);
        return {
          id: h.id,
          name: h.name,
          category: h.category,
          frequencyType: h.frequency_type,
          currentStreak: stats.currentStreak,
          longestStreak: stats.bestStreak,
          completionRate: stats.completionRate,
          weekProgress: getHabitWeekProgress(habitObj, habitComps),
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

      const monthly = calculateMonthlySummary({
        monthKey,
        transactions: (txs as any) || [],
        categories: (categories as any) || [],
        budgets: (budgets as any) || [],
        commitments: (commitments as any) || [],
        emiTrackers: (emis as any) || [],
        debtRecords: (debts as any) || [],
        debtInstallments: (debtInsts as any) || [],
        recurringBills: (bills as any) || [],
        sipPlans: (sips as any) || [],
        referenceDate,
      });

      const netWorth = calculateNetWorthSummary({
        accounts: (accounts as any) || [],
        sipPlans: (sips as any) || [],
        debtRecords: (debts as any) || [],
        emiTrackers: (emis as any) || [],
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
            account: card as any,
            transactions: (txs as any) || [],
            persistedStatements: (statements as any) || [],
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

      const groups = calculateFriendLedgerGroups((debts as any) || []);

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
}
