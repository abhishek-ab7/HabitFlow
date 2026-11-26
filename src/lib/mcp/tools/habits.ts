import type { McpServer } from '@modelcontextprotocol/server';
import { registerGetHabitsTool } from './habits/get-habits';
import { registerManageHabitTool } from './habits/manage-habit';
import {
  registerLogHabitCompletionTool,
  registerManageHabitCompletionsTool,
} from './habits/manage-completions';
import { registerManageHabitStacksTool } from './habits/manage-stacks';

export function registerHabitsTools(server: McpServer) {
  registerGetHabitsTool(server);
  registerManageHabitTool(server);
  registerLogHabitCompletionTool(server);
  registerManageHabitCompletionsTool(server);
  registerManageHabitStacksTool(server);
}
