import type { McpServer } from '@modelcontextprotocol/server';
import {
  readActiveHabitsResource,
  readCreditCardsSummaryResource,
  readFinanceSummaryResource,
  readFitnessTodayResource,
  readFocusGoalsResource,
  readFriendsLedgerSummaryResource,
  readTodaySummaryResource,
} from './resources-handlers';

export function registerMcpResources(server: McpServer) {
  server.registerResource(
    'today_summary',
    'habitflow://today',
    {
      title: "Today's HabitFlow Snapshot",
      description: "Live daily briefing snapshot for today in IST: habits due, overdue/due tasks, focus goals, and mood.",
      mimeType: 'application/json',
    },
    readTodaySummaryResource
  );

  server.registerResource(
    'active_habits',
    'habitflow://habits/active',
    {
      title: 'Active Habits & Streaks',
      description: 'All active habits with streak counters, weekly progress, and target configurations.',
      mimeType: 'application/json',
    },
    readActiveHabitsResource
  );

  server.registerResource(
    'focus_goals',
    'habitflow://goals/focus',
    {
      title: 'Top Focus Goals',
      description: 'Active top-priority goals with milestone status, progress bars, and target dates.',
      mimeType: 'application/json',
    },
    readFocusGoalsResource
  );

  server.registerResource(
    'finance_summary',
    'habitflow://finance/summary',
    {
      title: 'Current Month Financial Summary',
      description: 'Monthly income, expense, net savings, budget pace, liquid cash, and total net worth.',
      mimeType: 'application/json',
    },
    readFinanceSummaryResource
  );

  server.registerResource(
    'credit_cards_summary',
    'habitflow://finance/credit-cards',
    {
      title: 'Credit Cards & Dual-Cycle Statements',
      description: 'Active credit card utilization, current unbilled cycle spends, and open billed statement balances.',
      mimeType: 'application/json',
    },
    readCreditCardsSummaryResource
  );

  server.registerResource(
    'friends_ledger_summary',
    'habitflow://finance/friends-ledger',
    {
      title: 'Friends Isolated Ledger Summary',
      description: 'Per-friend isolated Everyday Tab balances and Long-Term Loan balances.',
      mimeType: 'application/json',
    },
    readFriendsLedgerSummaryResource
  );

  server.registerResource(
    'fitness_today',
    'habitflow://fitness/today',
    {
      title: "Today's Fitness, Diet & Supplement Telemetry",
      description:
        'Live IST body metrics, Big 2 calories/protein fuel progress, 7d rolling weight, waist trend, today meals/workouts, and supplement low-stock alert status.',
      mimeType: 'application/json',
    },
    readFitnessTodayResource
  );
}
