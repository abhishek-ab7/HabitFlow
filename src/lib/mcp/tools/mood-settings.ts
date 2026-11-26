import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  handleGetUserSettings,
  handleManageMood,
  handleUpdateUserSettings,
} from './mood-settings-handlers';

function registerManageMoodTool(server: McpServer) {
  server.registerTool(
    'manage_mood',
    {
      title: 'Manage Mood Logs',
      description: 'List historical mood entries, log/update a mood check-in for a specific IST date, or delete a mood entry (delete requires confirm: true).',
      inputSchema: {
        action: z.enum(['list', 'log', 'delete']).describe('Action: list historical moods, log a mood, or delete a mood entry'),
        moodId: z.string().uuid().optional().describe('Mood entry UUID (optional for delete)'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().describe('Date for mood log (defaults to today in IST)'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter start date for list action'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter end date for list action'),
        mood: z.enum(['happy', 'calm', 'neutral', 'sad', 'stressed']).optional().describe('Mood state matching MoodType (happy | calm | neutral | sad | stressed)'),
        confirm: z.boolean().optional().describe('Confirmation flag required for delete'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handleManageMood
  );
}

function registerGetSettingsTool(server: McpServer) {
  server.registerTool(
    'get_user_settings',
    {
      title: 'Get User Settings',
      description: 'Retrieves user profile preferences, theme accent, dashboard layout, and gamification level/XP stats.',
      inputSchema: { refresh: z.boolean().optional().describe('Force fresh read from database') },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handleGetUserSettings
  );
}

function registerUpdateSettingsTool(server: McpServer) {
  server.registerTool(
    'update_user_settings',
    {
      title: 'Update User Settings',
      description:
        'Updates user profile configuration, workspace module visibility toggles (showFitness, showFinance, showTasks, showGoals, showMilestones, habitOnlyMode), week start day, accent theme, motivation text, or dashboard layout. XP/gems/level remain read-only.',
      inputSchema: {
        userName: z.string().min(1).max(50).optional().describe('User display name'),
        avatarId: z.string().optional().describe('Avatar identifier'),
        weekStartDay: z.number().int().min(0).max(6).optional().describe('Week start day (0=Sunday, 1=Monday)'),
        defaultCategory: z.string().optional().describe('Default category for new habits'),
        accent: z.string().optional().describe('Theme accent name (mint, cobalt, forest, ink)'),
        motivationText: z.string().optional().describe('Custom dashboard motivation text'),
        dashboardLayout: z.any().optional().describe('Dashboard card arrangement JSON'),
        showFitness: z.boolean().optional().describe('Toggle Body & Fitness module visibility'),
        showFinance: z.boolean().optional().describe('Toggle FlowFinance module visibility'),
        showTasks: z.boolean().optional().describe('Toggle Tasks module visibility'),
        showGoals: z.boolean().optional().describe('Toggle Goals module visibility'),
        showMilestones: z.boolean().optional().describe('Toggle Milestones module visibility'),
        habitOnlyMode: z.boolean().optional().describe('Toggle minimal Habit-Only Mode'),
        streakShield: z.number().int().min(0).max(99).optional().describe('Adjust available streak shields'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handleUpdateUserSettings
  );
}

export function registerMoodSettingsTools(server: McpServer) {
  registerManageMoodTool(server);
  registerGetSettingsTool(server);
  registerUpdateSettingsTool(server);
}
