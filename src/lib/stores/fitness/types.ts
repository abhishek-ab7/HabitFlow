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

export type FitnessEntityId = string;
export type FitnessIsoDate = string;
export type FitnessUserId = string;

export interface FitnessStoreActions {
  loadFitnessData: (userId?: FitnessUserId, force?: boolean) => Promise<void>;
  clearFitnessState: () => void;

  // Bio & Profile slice
  upsertProfile: (
    data: FitnessProfileFormData,
    userIdOverride?: FitnessUserId
  ) => Promise<FitnessProfile>;
  upsertDailyLog: (
    date: FitnessIsoDate,
    patch: FitnessDailyLogPatch,
    userIdOverride?: FitnessUserId
  ) => Promise<FitnessDailyLog>;
  incrementWater: (
    deltaMl: number,
    date?: FitnessIsoDate,
    userIdOverride?: FitnessUserId
  ) => Promise<FitnessDailyLog>;
  incrementSteps: (
    deltaSteps: number,
    date?: FitnessIsoDate,
    userIdOverride?: FitnessUserId
  ) => Promise<FitnessDailyLog>;
  toggleLowEnergyMode: (
    date?: FitnessIsoDate,
    enabled?: boolean,
    userIdOverride?: FitnessUserId
  ) => Promise<FitnessDailyLog & { restedHabitIds: string[] }>;

  // Diet & Staples slice
  seedStarterStaplesIfEmpty: (userId: FitnessUserId) => Promise<void>;
  addMealLog: (data: MealLogFormData, userIdOverride?: FitnessUserId) => Promise<MealLog>;
  updateMealLog: (
    id: FitnessEntityId,
    patch: Partial<MealLogFormData & { date: FitnessIsoDate }>
  ) => Promise<MealLog | null>;
  deleteMealLog: (id: FitnessEntityId) => Promise<void>;
  logFromTemplate: (
    templateId: FitnessEntityId,
    options?: {
      date?: FitnessIsoDate;
      multiplier?: number;
      mealType?: MealType;
      source?: MealLogSource;
    },
    userIdOverride?: FitnessUserId
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
    userIdOverride?: FitnessUserId
  ) => Promise<WorkoutSession>;
  updateWorkoutSession: (
    id: FitnessEntityId,
    patch: Partial<WorkoutSessionFormData & { date: FitnessIsoDate }>
  ) => Promise<WorkoutSession | null>;
  deleteWorkoutSession: (id: FitnessEntityId) => Promise<void>;

  // Supplement slice
  addSupplement: (
    data: SupplementInventoryFormData,
    userIdOverride?: FitnessUserId
  ) => Promise<SupplementInventory>;
  updateSupplement: (
    id: FitnessEntityId,
    patch: Partial<SupplementInventoryFormData>
  ) => Promise<SupplementInventory | null>;
  deleteSupplement: (id: FitnessEntityId) => Promise<void>;
  restockSupplement: (
    supplementId: FitnessEntityId,
    params: {
      servingsAdded?: number;
      costInr?: number;
      linkedTransactionId?: FitnessEntityId | null;
      date?: FitnessIsoDate;
    }
  ) => Promise<SupplementInventory | null>;
  takeSupplementDose: (
    supplementId: FitnessEntityId,
    params?: {
      servings?: number;
      date?: FitnessIsoDate;
      notes?: string | null;
      userIdOverride?: FitnessUserId;
    }
  ) => Promise<SupplementLog | null>;
  deleteSupplementLog: (id: FitnessEntityId) => Promise<void>;
  adjustSupplementStock: (
    supplementId: FitnessEntityId,
    params: { delta?: number; targetRemaining?: number }
  ) => Promise<SupplementInventory | null>;
  takeTodaySupplementStack: (
    date?: FitnessIsoDate,
    userIdOverride?: FitnessUserId
  ) => Promise<SupplementLog[]>;
}

export type FitnessStore = FitnessStoreState & FitnessStoreActions;

export type FitnessSliceCreator<T> = StateCreator<FitnessStore, [], [], T>;
