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

const MCP_RESOURCE_DEFS = [
  {
    name: 'today_summary',
    uri: 'habitflow://today',
    title: "Today's HabitFlow Snapshot",
    description: "Live daily briefing snapshot for today in IST: habits due, overdue/due tasks, focus goals, and mood.",
    handler: readTodaySummaryResource,
  },
  {
    name: 'active_habits',
    uri: 'habitflow://habits/active',
    title: 'Active Habits & Streaks',
    description: 'All active habits with streak counters, weekly progress, and target configurations.',
    handler: readActiveHabitsResource,
  },
  {
    name: 'focus_goals',
    uri: 'habitflow://goals/focus',
    title: 'Top Focus Goals',
    description: 'Active top-priority goals with milestone status, progress bars, and target dates.',
    handler: readFocusGoalsResource,
  },
  {
    name: 'finance_summary',
    uri: 'habitflow://finance/summary',
    title: 'Current Month Financial Summary',
    description: 'Monthly income, expense, net savings, budget pace, liquid cash, and total net worth.',
    handler: readFinanceSummaryResource,
  },
  {
    name: 'credit_cards_summary',
    uri: 'habitflow://finance/credit-cards',
    title: 'Credit Cards & Dual-Cycle Statements',
    description: 'Active credit card utilization, current unbilled cycle spends, and open billed statement balances.',
    handler: readCreditCardsSummaryResource,
  },
  {
    name: 'friends_ledger_summary',
    uri: 'habitflow://finance/friends-ledger',
    title: 'Friends Isolated Ledger Summary',
    description: 'Per-friend isolated Everyday Tab balances and Long-Term Loan balances.',
    handler: readFriendsLedgerSummaryResource,
  },
  {
    name: 'fitness_today',
    uri: 'habitflow://fitness/today',
    title: "Today's Fitness, Diet & Supplement Telemetry",
    description:
      'Live IST body metrics, Big 2 calories/protein fuel progress, 7d rolling weight, waist trend, today meals/workouts, and supplement low-stock alert status.',
    handler: readFitnessTodayResource,
  },
] as const;

export function registerMcpResources(server: McpServer) {
  for (const res of MCP_RESOURCE_DEFS) {
    server.registerResource(
      res.name,
      res.uri,
      { title: res.title, description: res.description, mimeType: 'application/json' },
      res.handler
    );
  }
}
