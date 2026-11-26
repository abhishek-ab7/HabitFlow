import type { McpServer } from '@modelcontextprotocol/server';
import { registerManageRecurringBillTool } from './finance-obligations/manage-recurring-bill';
import { registerManageEmiTool } from './finance-obligations/manage-emi';
import { registerManageSipPlanTool } from './finance-obligations/manage-sip-plan';
import { registerManageMonthlyCommitmentTool } from './finance-obligations/manage-commitment';

export function registerFinanceObligationsTools(server: McpServer) {
  registerManageRecurringBillTool(server);
  registerManageEmiTool(server);
  registerManageSipPlanTool(server);
  registerManageMonthlyCommitmentTool(server);
}
