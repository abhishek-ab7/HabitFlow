import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  handleGetDailyBriefing,
  handleGetHabitFinanceInsights,
} from './briefing-insights-handlers';

export function registerBriefingInsightsTools(server: McpServer) {
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
    handleGetDailyBriefing
  );

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
    handleGetHabitFinanceInsights
  );
}
