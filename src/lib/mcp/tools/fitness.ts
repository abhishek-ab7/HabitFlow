import type { McpServer } from '@modelcontextprotocol/server';
import { registerManageFitnessProfileTool } from './fitness/manage-fitness-profile';
import { registerGetFitnessOverviewTool } from './fitness/get-fitness-overview';
import { registerLogDailyBodyMetricsTool } from './fitness/body-metrics';
import { registerManageMealsTool } from './fitness/manage-meals';
import { registerManageWorkoutsTool } from './fitness/manage-workouts';
import { registerManageSupplementsTool } from './fitness/manage-supplements';

export function registerFitnessTools(server: McpServer) {
  registerManageFitnessProfileTool(server);
  registerGetFitnessOverviewTool(server);
  registerLogDailyBodyMetricsTool(server);
  registerManageMealsTool(server);
  registerManageWorkoutsTool(server);
  registerManageSupplementsTool(server);
}
