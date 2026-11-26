import type { McpServer } from '@modelcontextprotocol/server';
import { registerGetFriendLedgersTool } from './finance-friends/get-ledgers';
import { registerManageFriendDebtTool } from './finance-friends/manage-friend-debt';

export function registerFinanceFriendsTools(server: McpServer) {
  registerGetFriendLedgersTool(server);
  registerManageFriendDebtTool(server);
}
