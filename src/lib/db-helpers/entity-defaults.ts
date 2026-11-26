import type { Task, TaskFormData, UserSettings } from '../types';

const DEFAULT_STATS: UserSettings['stats'] = {
  vitality: 1,
  intelligence: 1,
  discipline: 1,
  charisma: 1,
  wealth: 1,
  creativity: 1,
};

const DEFAULT_DASHBOARD_LAYOUT: NonNullable<UserSettings['dashboardLayout']> = [
  { id: 'metrics', size: 'full', hidden: false, pinned: true },
  { id: 'today-tasks', size: 'full', hidden: false, pinned: false },
  { id: 'finance-overview', size: 'full', hidden: false, pinned: false },
  { id: 'habit-overview', size: '1/2', hidden: false, pinned: false },
  { id: 'focus-goal', size: '1/2', hidden: false, pinned: false },
  { id: 'ai-coach', size: '1/2', hidden: false, pinned: false },
  { id: 'weekly-review', size: '1/2', hidden: false, pinned: false },
];

function buildProfileSettingsDefaults(
  data: Partial<UserSettings> & { userId: string },
  now: string
) {
  return {
    id: crypto.randomUUID(),
    userId: data.userId,
    theme: data.theme || 'system',
    accent: data.accent || 'mint',
    userName: data.userName,
    weekStartsOn: data.weekStartsOn ?? 0,
    defaultCategory: data.defaultCategory || 'health',
    createdAt: now,
    updatedAt: now,
    xp: 0,
    level: 1,
    gems: 0,
    streakShield: 0,
    avatarId: 'avatar-1',
    stats: data.stats || DEFAULT_STATS,
    unlockedThemes: data.unlockedThemes || [],
    dashboardLayout: data.dashboardLayout || DEFAULT_DASHBOARD_LAYOUT,
  };
}

function buildFeatureToggleDefaults(data: Partial<UserSettings>) {
  return {
    showMotivationalQuotes: data.showMotivationalQuotes ?? true,
    soundEnabled: data.soundEnabled ?? true,
    hapticsEnabled: data.hapticsEnabled ?? true,
    showTasks: data.showTasks ?? true,
    showGoals: data.showGoals ?? true,
    showMilestones: data.showMilestones ?? true,
    showFinance: data.showFinance ?? true,
    showFitness: data.showFitness ?? true,
    habitOnlyMode: data.habitOnlyMode ?? false,
  };
}

export function buildNewUserSettings(
  data: Partial<UserSettings> & { userId: string },
  now: string
): UserSettings {
  return {
    ...buildProfileSettingsDefaults(data, now),
    ...buildFeatureToggleDefaults(data),
  };
}

function buildTaskMetadataDefaults(data: TaskFormData) {
  return {
    description: data.description || null,
    notes: data.notes || null,
    due_date: data.due_date || null,
    goal_id: data.goal_id || null,
    tags: data.tags || [],
    metadata: data.metadata || {},
    parentTaskId: data.parentTaskId || null,
  };
}

function buildTaskSchedulingDefaults(data: TaskFormData) {
  return {
    recurrenceRule: data.recurrenceRule || '',
    estimatedTime: data.estimatedTime || 0,
    actualTime: data.actualTime || 0,
    isUrgent: data.isUrgent ?? false,
    isImportant: data.isImportant ?? false,
    depth: data.depth || 0,
  };
}

export function buildNewTaskRecord(
  data: TaskFormData & { userId: string },
  now: string
): Task {
  return {
    id: crypto.randomUUID(),
    userId: data.userId,
    title: data.title,
    status: 'todo',
    priority: data.priority,
    created_at: now,
    updated_at: now,
    ...buildTaskMetadataDefaults(data),
    ...buildTaskSchedulingDefaults(data),
  };
}
