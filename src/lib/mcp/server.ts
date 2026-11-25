import type { McpServer } from '@modelcontextprotocol/server';
import { registerBriefingInsightsTools } from './tools/briefing-insights';
import { registerHabitsTools } from './tools/habits';
import { registerTasksTools } from './tools/tasks';
import { registerGoalsTools } from './tools/goals';
import { registerMoodSettingsTools } from './tools/mood-settings';
import { registerFinanceCoreTools } from './tools/finance-core';
import { registerFinanceTransactionsTools } from './tools/finance-transactions';
import { registerFinanceCreditCardsTools } from './tools/finance-credit-cards';
import { registerFinanceFriendsTools } from './tools/finance-friends';
import { registerFinanceObligationsTools } from './tools/finance-obligations';
import { registerFitnessTools } from './tools/fitness';
import { registerMcpResources } from './resources';
import { registerMcpPrompts } from './prompts';

/**
 * Initializes and binds all 33 consolidated domain tools, 7 live resources,
 * and 5 workflow prompts to the HabitFlow MCP server instance.
 */
export async function setupHabitFlowMcpServer(server: McpServer): Promise<void> {
  // 1. Cross-Domain Briefing & Insights
  registerBriefingInsightsTools(server);

  // 2. Habits & Streaks
  registerHabitsTools(server);

  // 3. Tasks & Subtasks
  registerTasksTools(server);

  // 4. Goals & Milestones
  registerGoalsTools(server);

  // 5. Mood & Settings
  registerMoodSettingsTools(server);

  // 6. Finance Core (Accounts, Categories, Budgets, Net Worth)
  registerFinanceCoreTools(server);

  // 7. Finance Transactions & Splits
  registerFinanceTransactionsTools(server);

  // 8. Credit Card Cycles & Statements
  registerFinanceCreditCardsTools(server);

  // 9. Friend Ledgers & Isolated Debts
  registerFinanceFriendsTools(server);

  // 10. Financial Obligations (Bills, EMIs, SIPs, Commitments)
  registerFinanceObligationsTools(server);

  // 11. Body, Fitness, Diet, Workouts & Supplements (Life OS)
  registerFitnessTools(server);

  // 12. Live MCP Resources
  registerMcpResources(server);

  // 13. Reusable MCP Prompts
  registerMcpPrompts(server);
}
