import type {
  MealTemplate,
  MealType,
  Priority,
  SupplementInventory,
  WorkoutExercise,
  WorkoutType,
} from '@/lib/types';

export interface UniversalAccountRef {
  id: string;
  name: string;
  type: string;
}

export interface UniversalCategoryRef {
  id: string;
  name: string;
  slug: string;
  type: string;
}

export interface UniversalParserContext {
  todayIso?: string;
  accounts?: UniversalAccountRef[];
  categories?: UniversalCategoryRef[];
  mealTemplates?: MealTemplate[];
  supplements?: SupplementInventory[];
}

export interface UniversalExpenseAction {
  id: string;
  kind: 'expense';
  enabled: boolean;
  title: string;
  amount: number;
  txType: 'expense' | 'income' | 'investment';
  accountId?: string;
  accountName: string;
  categoryId?: string;
  categorySlug: string;
  categoryName: string;
  date: string;
  isJunkFood: boolean;
  linkDietMealId?: string;
}

export interface UniversalMealAction {
  id: string;
  kind: 'meal';
  enabled: boolean;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealType: MealType;
  isJunk: boolean;
  templateId?: string | null;
  date: string;
  linkedExpenseActionId?: string;
}

export interface UniversalWorkoutAction {
  id: string;
  kind: 'workout';
  enabled: boolean;
  title: string;
  workoutType: WorkoutType;
  durationMinutes: number;
  estimatedCaloriesBurned: number;
  exercises: WorkoutExercise[];
  date: string;
}

export interface UniversalBioAction {
  id: string;
  kind: 'bio';
  enabled: boolean;
  date: string;
  stepsDelta?: number;
  stepsExact?: number;
  waterDeltaMl?: number;
  sleepHours?: number;
  energyLevel?: number;
  weightKg?: number;
  waistInches?: number;
}

export interface UniversalSupplementAction {
  id: string;
  kind: 'supplement';
  enabled: boolean;
  supplementId?: string;
  supplementName: string;
  servings: number;
  date: string;
}

export interface UniversalTaskAction {
  id: string;
  kind: 'task';
  enabled: boolean;
  title: string;
  priority: Priority;
  isUrgent?: boolean;
  domainTag?: 'health' | 'finance' | 'fitness' | 'general';
  dueDate?: string;
  dueTime?: string;
  estimateMinutes?: number;
}

export type UniversalCaptureAction =
  | UniversalExpenseAction
  | UniversalMealAction
  | UniversalWorkoutAction
  | UniversalBioAction
  | UniversalSupplementAction
  | UniversalTaskAction;

export interface UniversalParseResult {
  rawInput: string;
  actions: UniversalCaptureAction[];
  detectedDate: string;
  summary: string;
}
