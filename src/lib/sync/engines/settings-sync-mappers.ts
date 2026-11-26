function orFallback<T>(value: unknown, fallback: T): T {
  return (value as T) || fallback;
}

function pickFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickLocalOrRemoteFlag(remoteVal: unknown, localVal: unknown, defaultVal: boolean): boolean {
  if (typeof remoteVal === 'boolean') return remoteVal;
  if (typeof localVal === 'boolean') return localVal;
  return defaultVal;
}

function buildRemoteProfileFields(userId: string, settings: Record<string, unknown>) {
  return {
    user_id: userId,
    user_name: orFallback(settings.userName, null),
    avatar_id: orFallback(settings.avatarId, 'avatar-1'),
    week_start_day: Number(settings.weekStartsOn ?? 0),
    default_category: orFallback(settings.defaultCategory, 'health'),
    accent: orFallback(settings.accent, 'mint'),
  };
}

function buildRemoteProgressFields(settings: Record<string, unknown>) {
  return {
    xp: orFallback(settings.xp, 0),
    level: orFallback(settings.level, 1),
    gems: orFallback(settings.gems, 0),
    streak_shield: orFallback(settings.streakShield, 0),
    stats: orFallback(settings.stats, null),
  };
}

function buildRemoteCustomizationFields(settings: Record<string, unknown>) {
  return {
    unlocked_themes: Array.isArray(settings.unlockedThemes) ? settings.unlockedThemes : [],
    motivation_text: orFallback(settings.motivation_text, null),
    dashboard_layout: orFallback(settings.dashboardLayout, null),
    generation_counter: orFallback(settings.generationCounter, 1),
    updated_at: new Date().toISOString(),
  };
}

function buildRemoteSettingsVisibility(settings: Record<string, unknown>) {
  return {
    show_fitness: pickFlag(settings.showFitness, true),
    show_finance: pickFlag(settings.showFinance, true),
    show_tasks: pickFlag(settings.showTasks, true),
    show_goals: pickFlag(settings.showGoals, true),
    show_milestones: pickFlag(settings.showMilestones, true),
    habit_only_mode: pickFlag(settings.habitOnlyMode, false),
  };
}

export function buildRemoteSettingsPayload(
  userId: string,
  settings: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...buildRemoteProfileFields(userId, settings),
    ...buildRemoteProgressFields(settings),
    ...buildRemoteCustomizationFields(settings),
    ...buildRemoteSettingsVisibility(settings),
  };
}

const VALID_ACCENTS = ['mint', 'cobalt', 'forest', 'ink'];

function resolveAccent(remoteAccent: unknown, localAccent: unknown) {
  if (typeof remoteAccent === 'string' && VALID_ACCENTS.includes(remoteAccent)) {
    return remoteAccent;
  }
  return orFallback(localAccent, 'mint');
}

function mapRemoteProfileFields(
  remoteData: Record<string, unknown>,
  local: Record<string, unknown> | undefined,
  userId: string
) {
  return {
    id: orFallback(local?.id, crypto.randomUUID()),
    userId,
    theme: orFallback(local?.theme, 'system'),
    accent: resolveAccent(remoteData.accent, local?.accent),
    userName: orFallback(remoteData.user_name, undefined),
    weekStartsOn: Number(remoteData.week_start_day ?? 0),
    showMotivationalQuotes: pickFlag(remoteData.show_motivational_quotes, true),
    defaultCategory: orFallback(remoteData.default_category, 'health'),
  };
}

function mapRemoteGamificationFields(remoteData: Record<string, unknown>) {
  return {
    xp: orFallback(remoteData.xp, 0),
    level: orFallback(remoteData.level, 1),
    gems: orFallback(remoteData.gems, 0),
    streakShield: orFallback(remoteData.streak_shield, 0),
    avatarId: orFallback(remoteData.avatar_id, 'avatar-1'),
  };
}

function mapRemoteCustomizationFields(remoteData: Record<string, unknown>) {
  return {
    stats: orFallback(remoteData.stats, undefined),
    unlockedThemes: orFallback(remoteData.unlocked_themes, []),
    motivation_text: orFallback(remoteData.motivation_text, ''),
    dashboardLayout: orFallback(remoteData.dashboard_layout, undefined),
  };
}

function mapRemoteVisibilityFlags(
  remoteData: Record<string, unknown>,
  local: Record<string, unknown> | undefined
) {
  return {
    showFitness: pickLocalOrRemoteFlag(remoteData.show_fitness, local?.showFitness, true),
    showFinance: pickLocalOrRemoteFlag(remoteData.show_finance, local?.showFinance, true),
    showTasks: pickLocalOrRemoteFlag(remoteData.show_tasks, local?.showTasks, true),
    showGoals: pickLocalOrRemoteFlag(remoteData.show_goals, local?.showGoals, true),
    showMilestones: pickLocalOrRemoteFlag(remoteData.show_milestones, local?.showMilestones, true),
    habitOnlyMode: pickLocalOrRemoteFlag(remoteData.habit_only_mode, local?.habitOnlyMode, false),
  };
}

function mapRemoteTimestamps(remoteData: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    generationCounter: orFallback(remoteData.generation_counter, 1),
    createdAt: orFallback(remoteData.created_at, now),
    updatedAt: orFallback(remoteData.updated_at, now),
    isDirty: false,
  };
}

export function mapRemoteSettingsToLocal(
  remoteData: Record<string, unknown>,
  local: Record<string, unknown> | undefined,
  userId: string
) {
  return {
    ...mapRemoteProfileFields(remoteData, local, userId),
    ...mapRemoteGamificationFields(remoteData),
    ...mapRemoteCustomizationFields(remoteData),
    ...mapRemoteVisibilityFlags(remoteData, local),
    ...mapRemoteTimestamps(remoteData),
  };
}
