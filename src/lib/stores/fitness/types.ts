import type { StateCreator } from 'zustand';
import type {
  FitnessDailyLog,
  FitnessDailyLogPatch,
  FitnessProfile,
  FitnessProfileFormData,
  MealLog,
  MealLogFormData,
  MealLogSource,
  MealTemplate,
  MealTemplateFormData,
  MealType,
  SupplementInventory,
  SupplementInventoryFormData,
  SupplementLog,
  WorkoutSession,
  WorkoutSessionFormData,
} from '@/lib/types';

export interface FitnessStoreState {
  profile: FitnessProfile | null;
  dailyLogs: FitnessDailyLog[];
  mealTemplates: MealTemplate[];
  mealLogs: MealLog[];
  workoutSessions: WorkoutSession[];
  supplementInventory: SupplementInventory[];
  supplementLogs: SupplementLog[];
  isLoading: boolean;
  hasLoaded: boolean;
  currentUserId: string | null;
}

export interface FitnessStoreActions {
  loadFitnessData: (userId?: string, force?: boolean) => Promise<void>;
  clearFitnessState: () => void;

  // Bio & Profile slice
  upsertProfile: (
    data: FitnessProfileFormData,
    userIdOverride?: string
  ) => Promise<FitnessProfile>;
  upsertDailyLog: (
    date: string,
    patch: FitnessDailyLogPatch,
    userIdOverride?: string
  ) => Promise<FitnessDailyLog>;
  incrementWater: (
    deltaMl: number,
    date?: string,
    userIdOverride?: string
  ) => Promise<FitnessDailyLog>;
  incrementSteps: (
    deltaSteps: number,
    date?: string,
    userIdOverride?: string
  ) => Promise<FitnessDailyLog>;
  toggleLowEnergyMode: (
    date?: string,
    enabled?: boolean,
    userIdOverride?: string
  ) => Promise<FitnessDailyLog & { restedHabitIds: string[] }>;

  // Diet & Staples slice
  seedStarterStaplesIfEmpty: (userId: string) => Promise<void>;
  addMealLog: (data: MealLogFormData, userIdOverride?: string) => Promise<MealLog>;
  updateMealLog: (
    id: string,
    patch: Partial<MealLogFormData & { date: string }>
  ) => Promise<MealLog | null>;
  deleteMealLog: (id: string) => Promise<void>;
  logFromTemplate: (
    templateId: string,
    options?: {
      date?: string;
      multiplier?: number;
      mealType?: MealType;
      source?: MealLogSource;
    },
    userIdOverride?: string
  ) => Promise<MealLog | null>;
  addMealTemplate: (
    data: MealTemplateFormData,
    userIdOverride?: string
  ) => Promise<MealTemplate>;
  updateMealTemplate: (
    id: string,
    patch: Partial<MealTemplateFormData>
  ) => Promise<MealTemplate | null>;
  deleteMealTemplate: (id: string) => Promise<void>;
  ensureMealForJunkTransaction: (params: {
    transactionId: string;
    userId: string;
    date: string;
    title: string;
    amountInr: number;
    notes?: string;
  }) => Promise<MealLog>;
  upsertMealFromCapture: (params: {
    userId?: string;
    date: string;
    name: string;
    calories: number;
    proteinG: number;
    carbsG?: number;
    fatG?: number;
    mealType?: MealType;
    isJunk?: boolean;
    linkedTransactionId?: string | null;
    templateId?: string | null;
    source?: MealLogSource;
    notes?: string | null;
  }) => Promise<MealLog>;
  linkMealToTransaction: (
    mealId: string,
    transactionId: string | null
  ) => Promise<MealLog | null>;

  // Workout slice
  addWorkoutSession: (
    data: WorkoutSessionFormData,
    userIdOverride?: string
  ) => Promise<WorkoutSession>;
  updateWorkoutSession: (
    id: string,
    patch: Partial<WorkoutSessionFormData & { date: string }>
  ) => Promise<WorkoutSession | null>;
  deleteWorkoutSession: (id: string) => Promise<void>;

  // Supplement slice
  addSupplement: (
    data: SupplementInventoryFormData,
    userIdOverride?: string
  ) => Promise<SupplementInventory>;
  updateSupplement: (
    id: string,
    patch: Partial<SupplementInventoryFormData>
  ) => Promise<SupplementInventory | null>;
  deleteSupplement: (id: string) => Promise<void>;
  restockSupplement: (
    supplementId: string,
    params: {
      servingsAdded?: number;
      costInr?: number;
      linkedTransactionId?: string | null;
      date?: string;
    }
  ) => Promise<SupplementInventory | null>;
  takeSupplementDose: (
    supplementId: string,
    servings?: number,
    date?: string,
    notes?: string | null,
    userIdOverride?: string
  ) => Promise<SupplementLog | null>;
  deleteSupplementLog: (id: string) => Promise<void>;
  adjustSupplementStock: (
    supplementId: string,
    params: { delta?: number; targetRemaining?: number }
  ) => Promise<SupplementInventory | null>;
  takeTodaySupplementStack: (
    date?: string,
    userIdOverride?: string
  ) => Promise<SupplementLog[]>;
}

export type FitnessStore = FitnessStoreState & FitnessStoreActions;

export type FitnessSliceCreator<T> = StateCreator<FitnessStore, [], [], T>;
