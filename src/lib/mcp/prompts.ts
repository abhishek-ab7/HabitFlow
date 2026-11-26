import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getIstIsoDate, getIstMonthKey } from './config';

function textPromptResponse(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
}

function registerDailyPlanningPrompt(server: McpServer) {
  server.registerPrompt(
    'daily_planning',
    {
      title: 'Daily Morning Planning Routine',
      description:
        'Analyzes overdue tasks, today habits, and top focus goals, recommending an optimal 3-task priority list based on user energy level.',
      argsSchema: {
        energyLevel: z.enum(['high', 'medium', 'low']).optional().default('high').describe('Current physical/mental energy level'),
      },
    },
    async (args) =>
      textPromptResponse(`Good morning! Please act as my HabitFlow executive assistant.
Today is ${getIstIsoDate()} (IST). My energy level is ${args.energyLevel || 'high'}.

First, call get_daily_briefing to fetch my pending habits and tasks.
Then:
1. Identify any overdue tasks and triage them (mark urgent, reschedule, or highlight as critical).
2. Select my top 3 Most Important Tasks (MITs) matching my ${args.energyLevel} energy level.
3. Schedule my due habits into realistic time blocks (morning, afternoon, evening).
4. Present a concise, motivating daily action plan with clear checkboxes.`)
  );
}

function registerEveningReviewPrompt(server: McpServer) {
  server.registerPrompt(
    'evening_review',
    {
      title: 'Evening Habit & Reflection Review',
      description: 'Audits incomplete habits for today, logs an end-of-day reflection, and checks today spending.',
    },
    async () =>
      textPromptResponse(`Good evening! Let's do our HabitFlow evening wind-down for ${getIstIsoDate()} (IST).

1. Call get_habits for today and identify which habits were completed and which are still pending.
2. Inquire about my mood and ask if I would like to log a completion, rest day, or reflection note.
3. If finance is active, summarize today's transactions from get_transactions.
4. Prepare tomorrow's top priority task so I can wake up with clarity.`)
  );
}

function registerMonthlyFinanceAuditPrompt(server: McpServer) {
  server.registerPrompt(
    'monthly_finance_audit',
    {
      title: 'Monthly Financial Audit & Budget Check',
      description: 'Runs a deep audit on monthly spending pace, category overruns, credit card cycle dues, and cash runway.',
      argsSchema: {
        monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Target month (YYYY-MM, defaults to current IST month)'),
      },
    },
    async (args) =>
      textPromptResponse(`Please conduct a comprehensive HabitFlow financial audit for month ${args.monthKey || getIstMonthKey()}.

1. Call get_finance_overview with includeForecast: true and includeAnomalies: true.
2. Call get_credit_card_cycles to review unbilled spends and outstanding statement dues.
3. Identify which categories are exceeding budget pace.
4. Provide 3 specific, high-leverage recommendations to protect savings and optimize cash runway before month-end.`)
  );
}

function registerFriendSettlementPrompt(server: McpServer) {
  server.registerPrompt(
    'friend_settlement_plan',
    {
      title: 'Friend Debt Settlement Strategy',
      description: 'Reviews isolated Everyday Tab vs. Long-Term Loan balances for a friend and drafts clear settlement steps.',
      argsSchema: {
        personName: z.string().optional().describe('Friend name to audit'),
      },
    },
    async (args) =>
      textPromptResponse(`Please analyze my shared debts with ${args.personName ? args.personName : 'my friends'} in HabitFlow.

1. Call get_friend_ledgers with bucketType: 'all'.
2. Review the isolated Everyday Split Tab and Long-Term Loans separately—never mix them.
3. Clearly state who owes whom what amount in each bucket.
4. If there are pending splits or payments, propose a clean, friendly settlement plan with exact UPI amounts.`)
  );
}

function registerSundayResetPrompt(server: McpServer) {
  server.registerPrompt(
    'sunday_reset',
    {
      title: '5-Minute Sunday Reset Ritual (4 Truths)',
      description:
        'Guides a fast 5-minute weekly Life OS review across Safe-to-Spend/Debt, 7-day Body/Workouts, Junk/Trigger leaks, and pinning Next Week Top 3 MITs.',
      argsSchema: {
        targetDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('Target Monday/Today date YYYY-MM-DD for pinning Top 3 MITs'),
      },
    },
    async (args) => {
      const today = getIstIsoDate();
      const targetMitDate = args.targetDate || today;
      return textPromptResponse(`Run my HabitFlow 5-Minute Sunday Reset Ritual anchored on IST date ${today}. Review all 4 Truths:

1. Truth 1 (Cashflow & Debt/CC Float): Call get_finance_overview and get_credit_card_cycles to inspect Safe-to-Spend/day, CC float, and debt/EMI payoff progress.
2. Truth 2 (Body, Workouts & Steps): Call get_fitness_overview to summarize 7-day rolling weight delta, waist trend, workout session count, and average steps.
3. Truth 3 (Junk Leakage & Triggers): Call get_habit_finance_insights and check crossDomainInsights for 14d/30d Junk Food spend, empty kcal fat-loss drag, and sleep/energy/mood spend triggers.
4. Truth 4 (Next Week's Top 3 MITs): Call get_tasks and propose up to 3 Must-Do MITs, then ask me to confirm before calling manage_task with metadata: { isMitForDate: "${targetMitDate}", mitRank: 1|2|3 }.`);
    }
  );
}

export function registerMcpPrompts(server: McpServer) {
  registerDailyPlanningPrompt(server);
  registerEveningReviewPrompt(server);
  registerMonthlyFinanceAuditPrompt(server);
  registerFriendSettlementPrompt(server);
  registerSundayResetPrompt(server);
}
