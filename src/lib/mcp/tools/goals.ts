import type { McpServer } from '@modelcontextprotocol/server';
import { registerGetGoalsTool } from './goals/get-goals';
import { registerManageGoalTool } from './goals/manage-goal';
import { registerManageMilestoneTool } from './goals/manage-milestone';

export function registerGoalsTools(server: McpServer) {
  registerGetGoalsTool(server);
  registerManageGoalTool(server);
  registerManageMilestoneTool(server);
}
