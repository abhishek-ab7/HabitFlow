import type { McpServer } from '@modelcontextprotocol/server';
import { registerGetCreditCardCyclesTool } from './finance-credit-cards/get-cycles';
import { registerManageCreditCardStatementTool } from './finance-credit-cards/manage-statement';

export function registerFinanceCreditCardsTools(server: McpServer) {
  registerGetCreditCardCyclesTool(server);
  registerManageCreditCardStatementTool(server);
}
