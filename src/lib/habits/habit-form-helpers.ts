import type {
  AutoTrackHabitRule,
  Category,
  Habit,
  HabitAnchorBlock,
  HabitFormData,
  HabitFrequencyType,
  HabitPolarity,
} from '@/lib/types';

export const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'health', label: 'Health', emoji: '💪' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'learning', label: 'Learning', emoji: '📚' },
  { value: 'personal', label: 'Personal', emoji: '🌟' },
  { value: 'finance', label: 'Finance', emoji: '💰' },
  { value: 'relationships', label: 'Relationships', emoji: '❤️' },
];

export const CATEGORY_COLORS: Record<Category, string> = {
  health: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/30',
  work: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  learning: 'bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500/30',
  personal: 'bg-pink-500/20 text-pink-600 border-pink-500/30 hover:bg-pink-500/30',
  finance: 'bg-sky-500/20 text-sky-600 border-sky-500/30 hover:bg-sky-500/30',
  relationships: 'bg-orange-500/20 text-orange-600 border-orange-500/30 hover:bg-orange-500/30',
};

export const WEEKDAY_PILLS: { day: number; short: string; label: string }[] = [
  { day: 1, short: 'M', label: 'Mon' },
  { day: 2, short: 'T', label: 'Tue' },
  { day: 3, short: 'W', label: 'Wed' },
  { day: 4, short: 'T', label: 'Thu' },
  { day: 5, short: 'F', label: 'Fri' },
  { day: 6, short: 'S', label: 'Sat' },
  { day: 0, short: 'S', label: 'Sun' },
];

export const COMMON_EMOJIS = [
  '🧘', '💪', '🏃', '💤', '🥗', '💧', '🍎', '🚴', '🚶', '💊',
  '📚', '💻', '✍️', '🧠', '🎯', '⚡', '📅', '📝', '🎓', '🔬',
  '🎨', '🎵', '📷', '🎭', '🧶', '🎸', '🎹', '🖌️', '💃', '📽️',
  '🕯️', '🛁', '🌱', '☀️', '😊', '🙏', '📿', '🌳', '🌺', '🍵',
  '💰', '💼', '📈', '📊', '🏧', '💳', '🏗️', '🚀', '👔', '🤑',
  '❤️', '👨‍👩‍👧‍👦', '🤝', '💌', '📞', '🥳', '🎁', '👶', '🐾', '🏠',
  '🧹', '🧼', '🧺', '🛒', '🚗', '✈️', '🌍', '🛠️', '🔧', '⭐',
];

export const DEFAULT_HABIT_FORM = {
  name: '',
  category: 'personal' as Category,
  frequencyType: 'daily' as HabitFrequencyType,
  targetDays: 7,
  scheduledDays: [1, 2, 3, 4, 5],
  intervalDays: 2,
  autoTrackRule: 'none' as AutoTrackHabitRule,
  polarity: 'build' as HabitPolarity,
  anchorBlock: '' as HabitAnchorBlock | '',
  icon: '',
  isQuantitative: false,
  targetValue: 0,
  unit: '',
  difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  stackAfterHabitId: '',
  showAdvanced: false,
};

export function normalizeAutoTrackRule(
  rule?: AutoTrackHabitRule | 'protein_target' | 'no_junk_food'
): AutoTrackHabitRule {
  if (rule === 'protein_target') return 'protein_target_met';
  if (rule === 'no_junk_food') return 'zero_junk_today';
  return rule ?? 'none';
}

function getScheduleDefaults(habit: Habit) {
  return {
    frequencyType: (habit.frequencyType || (habit.targetDaysPerWeek < 7 ? 'weekly_flexible' : 'daily')) as HabitFrequencyType,
    targetDays: habit.targetDaysPerWeek,
    scheduledDays: habit.scheduledDays || [1, 2, 3, 4, 5],
    intervalDays: habit.intervalDays || 2,
  };
}

function getQuantitativeDefaults(habit: Habit) {
  return {
    isQuantitative: Boolean(habit.isQuantitative),
    targetValue: habit.targetValue || 0,
    unit: habit.unit || '',
  };
}

function getHabitBehaviorDefaults(habit: Habit) {
  return {
    polarity: (habit.polarity || 'build') as HabitPolarity,
    anchorBlock: (habit.anchorBlock || '') as HabitAnchorBlock | '',
    icon: habit.icon || '',
    difficulty: (habit.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
  };
}

function getMetadataDefaults(habit: Habit) {
  const autoTrackRule = normalizeAutoTrackRule(habit.autoTrackRule);
  const stackAfterHabitId = habit.metadata?.stackTriggerHabitId || '';
  return {
    autoTrackRule,
    ...getHabitBehaviorDefaults(habit),
    ...getQuantitativeDefaults(habit),
    stackAfterHabitId,
    showAdvanced: autoTrackRule !== 'none' || Boolean(stackAfterHabitId),
  };
}

export function getInitialHabitValues(habit?: Habit) {
  if (!habit) return DEFAULT_HABIT_FORM;
  return {
    name: habit.name,
    category: habit.category,
    ...getScheduleDefaults(habit),
    ...getMetadataDefaults(habit),
  };
}

export function computeEffectiveTargetDays(params: {
  frequencyType: HabitFrequencyType;
  scheduledDays: number[];
  intervalDays: number;
  targetDays: number;
}) {
  const { frequencyType, scheduledDays, intervalDays, targetDays } = params;
  if (frequencyType === 'daily') return 7;
  if (frequencyType === 'specific_days') return Math.max(1, scheduledDays.length);
  if (frequencyType === 'interval') return Math.max(1, Math.round(7 / Math.max(2, intervalDays)));
  return targetDays;
}

function buildQuantitativePayload(fields: {
  isQuantitative: boolean;
  targetValue: number;
  unit: string;
}) {
  if (!fields.isQuantitative) {
    return { isQuantitative: false, targetValue: undefined, unit: undefined };
  }
  return {
    isQuantitative: true,
    targetValue: fields.targetValue,
    unit: fields.unit.trim(),
  };
}

function buildSchedulePayload(fields: {
  frequencyType: HabitFrequencyType;
  scheduledDays: number[];
  intervalDays: number;
  targetDays: number;
}) {
  return {
    frequencyType: fields.frequencyType,
    targetDaysPerWeek: computeEffectiveTargetDays(fields),
    scheduledDays: fields.frequencyType === 'specific_days' ? fields.scheduledDays : undefined,
    intervalDays: fields.frequencyType === 'interval' ? fields.intervalDays : undefined,
  };
}

export function buildHabitFormPayload(fields: {
  name: string;
  category: Category;
  frequencyType: HabitFrequencyType;
  scheduledDays: number[];
  intervalDays: number;
  targetDays: number;
  autoTrackRule: AutoTrackHabitRule;
  polarity: HabitPolarity;
  anchorBlock: HabitAnchorBlock | '';
  icon: string;
  isQuantitative: boolean;
  targetValue: number;
  unit: string;
  difficulty: 'easy' | 'medium' | 'hard';
  stackAfterHabitId: string;
  existingMetadata?: Habit['metadata'];
}): HabitFormData {
  return {
    name: fields.name.trim(),
    category: fields.category,
    ...buildSchedulePayload(fields),
    autoTrackRule: fields.autoTrackRule,
    polarity: fields.polarity,
    anchorBlock: fields.anchorBlock || undefined,
    icon: fields.icon || undefined,
    ...buildQuantitativePayload(fields),
    difficulty: fields.difficulty,
    metadata: {
      ...(fields.existingMetadata || {}),
      stackTriggerHabitId: fields.stackAfterHabitId || undefined,
    },
  };
}
