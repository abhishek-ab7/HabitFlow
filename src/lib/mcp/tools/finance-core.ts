import type { McpServer } from '@modelcontextprotocol/server';
import { registerGetFinanceOverviewTool } from './finance-core/get-finance-overview';
import { registerManageFinanceAccountTool } from './finance-core/manage-finance-account';
import { registerManageFinanceCategoryTool } from './finance-core/manage-finance-category';
import { registerManageFinanceBudgetTool } from './finance-core/manage-finance-budget';
import { registerManageNetWorthSnapshotTool } from './finance-core/manage-net-worth-snapshot';

export function registerFinanceCoreTools(server: McpServer) {
  registerGetFinanceOverviewTool(server);
  registerManageFinanceAccountTool(server);
  registerManageFinanceCategoryTool(server);
  registerManageFinanceBudgetTool(server);
  registerManageNetWorthSnapshotTool(server);
}
