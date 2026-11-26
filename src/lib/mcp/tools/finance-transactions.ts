import type { McpServer } from '@modelcontextprotocol/server';
import { registerGetTransactionsTool } from './finance-transactions/get-transactions';
import { registerManageTransactionTool } from './finance-transactions/manage-transaction';

export function registerFinanceTransactionsTools(server: McpServer) {
  registerGetTransactionsTool(server);
  registerManageTransactionTool(server);
}
