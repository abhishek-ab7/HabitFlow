import { z } from 'zod';
import type {
  UniversalCaptureAction,
  UniversalParserContext,
} from '@/lib/quick-capture/parser-types';

export type CaptureDomain = 'finance_food' | 'fitness_bio' | 'tasks';
export type CaptureGraphStatus = 'READY_TO_COMMIT' | 'AWAITING_HUMAN';
export type CaptureSource = 'gemini' | 'deterministic';

export interface RecentTransactionRef {
  id: string;
  title: string;
  amount: number;
  date: string;
}

export interface AmbiguityOption {
  label: string;
  value: string;
}

export interface AmbiguityPrompt {
  id: string;
  actionId: string;
  field: 'accountId';
  question: string;
  options: AmbiguityOption[];
}

export interface DuplicateWarning {
  id: string;
  actionId: string;
  existingTxId: string;
  existingTitle: string;
  amount: number;
  date: string;
  reason: string;
}

export interface CaptureGraphInput {
  rawText: string;
  todayIso: string;
  context: UniversalParserContext;
  recentTransactions?: RecentTransactionRef[];
}

export interface CaptureGraphResult {
  actions: UniversalCaptureAction[];
  detectedDate: string;
  summary: string;
  source: CaptureSource;
  status: CaptureGraphStatus;
  detectedDomains: CaptureDomain[];
  overallConfidence: number;
  ambiguities: AmbiguityPrompt[];
  duplicateWarnings: DuplicateWarning[];
}

// ============================================================================
// Zod v4 Schemas for Domain Extractor Outputs (Zero DOM/Next dependencies)
// ============================================================================

export const RawAiExpenseSchema = z.object({
  title: z.string().optional(),
  amount: z.coerce.number().optional(),
  txType: z.string().optional(),
  accountNameHint: z.string().optional(),
  categorySlug: z.string().optional(),
  isJunkFood: z.boolean().optional(),
  date: z.string().optional(),
});

export const RawAiMealSchema = z.object({
  name: z.string().optional(),
  calories: z.coerce.number().optional(),
  proteinG: z.coerce.number().optional(),
  carbsG: z.coerce.number().optional(),
  fatG: z.coerce.number().optional(),
  mealType: z.string().optional(),
  isJunk: z.boolean().optional(),
  date: z.string().optional(),
});

export const RawAiWorkoutSchema = z.object({
  title: z.string().optional(),
  workoutType: z.string().optional(),
  durationMinutes: z.coerce.number().optional(),
  date: z.string().optional(),
});

export const RawAiBioSchema = z
  .object({
    stepsExact: z.coerce.number().optional(),
    stepsDelta: z.coerce.number().optional(),
    waterDeltaMl: z.coerce.number().optional(),
    sleepHours: z.coerce.number().optional(),
    energyLevel: z.coerce.number().optional(),
    weightKg: z.coerce.number().optional(),
    waistInches: z.coerce.number().optional(),
    date: z.string().optional(),
  })
  .nullable()
  .optional();

export const RawAiTaskSchema = z.object({
  title: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  dueDate: z.string().optional(),
});

export const FinanceFoodExtractionSchema = z.object({
  expenses: z.array(RawAiExpenseSchema).optional().default([]),
  meals: z.array(RawAiMealSchema).optional().default([]),
});

export const FitnessBioExtractionSchema = z.object({
  workouts: z.array(RawAiWorkoutSchema).optional().default([]),
  bio: RawAiBioSchema,
});

export const TasksExtractionSchema = z.object({
  tasks: z.array(RawAiTaskSchema).optional().default([]),
});

export const RecentTransactionRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().default(''),
  amount: z.coerce.number().finite().nonnegative(),
  date: z.string().min(4),
});

export type RawAiExpense = z.infer<typeof RawAiExpenseSchema>;
export type RawAiMeal = z.infer<typeof RawAiMealSchema>;
export type RawAiWorkout = z.infer<typeof RawAiWorkoutSchema>;
export type RawAiBio = z.infer<typeof RawAiBioSchema>;
export type RawAiTask = z.infer<typeof RawAiTaskSchema>;
