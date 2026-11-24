import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getIstIsoDate, getIstMonthKey } from './config';

export function registerMcpPrompts(server: McpServer) {
  // 1. daily_planning
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
    async (args) => {
      const today = getIstIsoDate();
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Good morning! Please act as my HabitFlow executive assistant.
Today is ${today} (IST). My energy level is ${args.energyLevel || 'high'}.

First, call get_daily_briefing to fetch my pending habits and tasks.
Then:
1. Identify any overdue tasks and triage them (mark urgent, reschedule, or highlight as critical).
2. Select my top 3 Most Important Tasks (MITs) matching my ${args.energyLevel} energy level.
3. Schedule my due habits into realistic time blocks (morning, afternoon, evening).
4. Present a concise, motivating daily action plan with clear checkboxes.`,
            },
          },
        ],
      };
    }
  );

  // 2. evening_review
  server.registerPrompt(
    'evening_review',
    {
      title: 'Evening Habit & Reflection Review',
      description: 'Audits incomplete habits for today, logs an end-of-day reflection, and checks today spending.',
    },
    async () => {
      const today = getIstIsoDate();
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Good evening! Let's do our HabitFlow evening wind-down for ${today} (IST).

1. Call get_habits for today and identify which habits were completed and which are still pending.
2. Inquire about my mood and ask if I would like to log a completion, rest day, or reflection note.
3. If finance is active, summarize today's transactions from get_transactions.
4. Prepare tomorrow's top priority task so I can wake up with clarity.`,
            },
          },
        ],
      };
    }
  );

  // 3. monthly_finance_audit
  server.registerPrompt(
    'monthly_finance_audit',
    {
      title: 'Monthly Financial Audit & Budget Check',
      description: 'Runs a deep audit on monthly spending pace, category overruns, credit card cycle dues, and cash runway.',
      argsSchema: {
        monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Target month (YYYY-MM, defaults to current IST month)'),
      },
    },
    async (args) => {
      const month = args.monthKey || getIstMonthKey();
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please conduct a comprehensive HabitFlow financial audit for month ${month}.

1. Call get_finance_overview with includeForecast: true and includeAnomalies: true.
2. Call get_credit_card_cycles to review unbilled spends and outstanding statement dues.
3. Identify which categories are exceeding budget pace.
4. Provide 3 specific, high-leverage recommendations to protect savings and optimize cash runway before month-end.`,
            },
          },
        ],
      };
    }
  );

  // 4. friend_settlement_plan
  server.registerPrompt(
    'friend_settlement_plan',
    {
      title: 'Friend Debt Settlement Strategy',
      description: 'Reviews isolated Everyday Tab vs. Long-Term Loan balances for a friend and drafts clear settlement steps.',
      argsSchema: {
        personName: z.string().optional().describe('Friend name to audit'),
      },
    },
    async (args) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please analyze my shared debts with ${args.personName ? args.personName : 'my friends'} in HabitFlow.

1. Call get_friend_ledgers with bucketType: 'all'.
2. Review the isolated Everyday Split Tab and Long-Term Loans separately—never mix them.
3. Clearly state who owes whom what amount in each bucket.
4. If there are pending splits or payments, propose a clean, friendly settlement plan with exact UPI amounts.`,
            },
          },
        ],
      };
    }
  );
}
