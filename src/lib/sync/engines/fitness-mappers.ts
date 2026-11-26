/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  FitnessProfile,
  MealLog,
  MealTemplate,
  SupplementInventory,
  SupplementLog,
  WorkoutSession,
} from '@/lib/types';
import { toNullableNum, toNum } from './fitness-daily-merge';

function orVal<T>(value: unknown, fallback: T): T {
  return (value as T) || fallback;
}

function mapBaseTimestamps(r: any) {
  const now = new Date().toISOString();
  return {
    deletedAt: r.deleted_at ?? null,
    generationCounter: toNum(r.generation_counter, 1),
    isDirty: false,
    createdAt: r.created_at || now,
    updatedAt: r.updated_at || now,
  };
}

export function mapProfileToLocal(r: any): FitnessProfile {
  return {
    id: r.id,
    userId: r.user_id,
    heightCm: toNullableNum(r.height_cm),
    currentWeightKg: toNullableNum(r.current_weight_kg),
    targetWeightKg: toNullableNum(r.target_weight_kg),
    startingWeightKg: toNullableNum(r.starting_weight_kg),
    targetWaistInches: toNullableNum(r.target_waist_inches),
    calorieTarget: toNum(r.calorie_target, 2000),
    proteinTargetG: toNum(r.protein_target_g, 130),
    carbsTargetG: toNullableNum(r.carbs_target_g),
    fatTargetG: toNullableNum(r.fat_target_g),
    waterTargetMl: toNum(r.water_target_ml, 3000),
    stepsTarget: toNum(r.steps_target, 8000),
    sleepTargetHours: toNum(r.sleep_target_hours, 7.5),
    activityLevel: orVal(r.activity_level, 'moderate'),
    goalType: orVal(r.goal_type, 'fat_loss'),
    dietPreference: orVal(r.diet_preference, 'non_veg'),
    gymScheduleDays: Array.isArray(r.gym_schedule_days) ? r.gym_schedule_days : [1, 2, 3, 4, 5, 6],
    lowEnergyCalorieCeiling: toNullableNum(r.low_energy_calorie_ceiling),
    lowEnergyStepsTarget: toNullableNum(r.low_energy_steps_target),
    ...mapBaseTimestamps(r),
  };
}

export function mapProfileToRemote(p: FitnessProfile, userId: string): Record<string, any> {
  return {
    id: p.id,
    user_id: userId,
    height_cm: p.heightCm ?? null,
    current_weight_kg: p.currentWeightKg ?? null,
    target_weight_kg: p.targetWeightKg ?? null,
    starting_weight_kg: p.startingWeightKg ?? null,
    target_waist_inches: p.targetWaistInches ?? null,
    calorie_target: p.calorieTarget,
    protein_target_g: p.proteinTargetG,
    carbs_target_g: p.carbsTargetG ?? null,
    fat_target_g: p.fatTargetG ?? null,
    water_target_ml: p.waterTargetMl,
    steps_target: p.stepsTarget,
    sleep_target_hours: p.sleepTargetHours,
    activity_level: p.activityLevel,
    goal_type: p.goalType,
    diet_preference: p.dietPreference,
    gym_schedule_days: p.gymScheduleDays ?? [1, 2, 3, 4, 5, 6],
    low_energy_calorie_ceiling: p.lowEnergyCalorieCeiling ?? null,
    low_energy_steps_target: p.lowEnergyStepsTarget ?? 3500,
    deleted_at: p.deletedAt ?? null,
    generation_counter: toNum(p.generationCounter, 1),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function mapMealTemplateToLocal(r: any): MealTemplate {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    hindiAliases: Array.isArray(r.hindi_aliases) ? r.hindi_aliases : [],
    calories: toNum(r.calories, 0),
    proteinG: toNum(r.protein_g, 0),
    carbsG: toNum(r.carbs_g, 0),
    fatG: toNum(r.fat_g, 0),
    fiberG: toNullableNum(r.fiber_g),
    servingLabel: orVal(r.serving_label, '1 serving'),
    mealType: r.meal_type ?? null,
    isJunk: Boolean(r.is_junk),
    isPinned: Boolean(r.is_pinned),
    order: toNum(r.order_index, 0),
    ...mapBaseTimestamps(r),
  };
}

export function mapMealTemplateToRemote(t: MealTemplate, userId: string): Record<string, any> {
  return {
    id: t.id,
    user_id: userId,
    name: t.name,
    hindi_aliases: Array.isArray(t.hindiAliases) ? t.hindiAliases : [],
    calories: Math.round(toNum(t.calories, 0)),
    protein_g: toNum(t.proteinG, 0),
    carbs_g: toNum(t.carbsG, 0),
    fat_g: toNum(t.fatG, 0),
    fiber_g: toNullableNum(t.fiberG),
    serving_label: orVal(t.servingLabel, '1 serving'),
    meal_type: t.mealType ?? null,
    is_junk: Boolean(t.isJunk),
    is_pinned: Boolean(t.isPinned),
    order_index: toNum(t.order, 0),
    deleted_at: t.deletedAt ?? null,
    generation_counter: toNum(t.generationCounter, 1),
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

export function mapMealLogToLocal(r: any): MealLog {
  const now = new Date().toISOString();
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    mealType: orVal(r.meal_type, 'snack'),
    name: r.name,
    calories: toNum(r.calories, 0),
    proteinG: toNum(r.protein_g, 0),
    carbsG: toNum(r.carbs_g, 0),
    fatG: toNum(r.fat_g, 0),
    fiberG: toNullableNum(r.fiber_g),
    quantityMultiplier: toNum(r.quantity_multiplier, 1),
    isJunk: Boolean(r.is_junk),
    templateId: r.template_id ?? null,
    linkedTransactionId: r.linked_transaction_id ?? null,
    source: orVal(r.source, 'manual'),
    notes: r.notes ?? null,
    loggedAt: r.logged_at || r.created_at || now,
    ...mapBaseTimestamps(r),
  };
}

export function mapMealLogToRemote(m: MealLog, userId: string): Record<string, any> {
  return {
    id: m.id,
    user_id: userId,
    date: m.date,
    meal_type: orVal(m.mealType, 'snack'),
    name: m.name,
    calories: Math.round(toNum(m.calories, 0)),
    protein_g: toNum(m.proteinG, 0),
    carbs_g: toNum(m.carbsG, 0),
    fat_g: toNum(m.fatG, 0),
    fiber_g: toNullableNum(m.fiberG),
    quantity_multiplier: toNum(m.quantityMultiplier, 1),
    is_junk: Boolean(m.isJunk),
    template_id: m.templateId ?? null,
    linked_transaction_id: m.linkedTransactionId ?? null,
    source: orVal(m.source, 'manual'),
    notes: m.notes ?? null,
    logged_at: m.loggedAt || m.createdAt,
    deleted_at: m.deletedAt ?? null,
    generation_counter: toNum(m.generationCounter, 1),
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

export function mapWorkoutToLocal(r: any): WorkoutSession {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    title: r.title,
    workoutType: orVal(r.workout_type, 'strength'),
    durationMinutes: toNum(r.duration_minutes, 0),
    estimatedCaloriesBurned: toNullableNum(r.estimated_calories_burned),
    exercises: Array.isArray(r.exercises) ? r.exercises : [],
    rpe: toNullableNum(r.rpe),
    notes: r.notes ?? null,
    source: orVal(r.source, 'manual'),
    ...mapBaseTimestamps(r),
  };
}

export function mapWorkoutToRemote(w: WorkoutSession, userId: string): Record<string, any> {
  return {
    id: w.id,
    user_id: userId,
    date: w.date,
    title: w.title,
    workout_type: orVal(w.workoutType, 'strength'),
    duration_minutes: Math.round(toNum(w.durationMinutes, 0)),
    estimated_calories_burned: toNullableNum(w.estimatedCaloriesBurned),
    exercises: Array.isArray(w.exercises) ? w.exercises : [],
    rpe: toNullableNum(w.rpe),
    notes: w.notes ?? null,
    source: orVal(w.source, 'manual'),
    deleted_at: w.deletedAt ?? null,
    generation_counter: toNum(w.generationCounter, 1),
    created_at: w.createdAt,
    updated_at: w.updatedAt,
  };
}

export function mapSupplementToLocal(r: any): SupplementInventory {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    brand: r.brand ?? null,
    category: orVal(r.category, 'other'),
    unitLabel: orVal(r.unit_label, 'scoop'),
    totalServings: toNum(r.total_servings, 30),
    remainingServings: toNum(r.remaining_servings, 30),
    dailyDosage: toNum(r.daily_dosage, 1),
    costInr: toNum(r.cost_inr, 0),
    proteinPerServingG: toNullableNum(r.protein_per_serving_g),
    manualAdjustment: toNum(r.manual_adjustment, 0),
    anchorBlock: r.anchor_block ?? null,
    lowStockThresholdDays: toNum(r.low_stock_threshold_days, 7),
    linkedTransactionId: r.linked_transaction_id ?? null,
    lastRestockedAt: r.last_restocked_at ?? null,
    isActive: r.is_active !== false,
    notes: r.notes ?? null,
    ...mapBaseTimestamps(r),
  };
}

export function mapSupplementToRemote(s: SupplementInventory, userId: string): Record<string, any> {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    brand: s.brand ?? null,
    category: orVal(s.category, 'other'),
    unit_label: orVal(s.unitLabel, 'scoop'),
    total_servings: toNum(s.totalServings, 30),
    remaining_servings: toNum(s.remainingServings, 30),
    daily_dosage: toNum(s.dailyDosage, 1),
    cost_inr: toNum(s.costInr, 0),
    protein_per_serving_g: toNullableNum(s.proteinPerServingG),
    manual_adjustment: toNum(s.manualAdjustment, 0),
    anchor_block: s.anchorBlock ?? null,
    low_stock_threshold_days: Math.round(toNum(s.lowStockThresholdDays, 7)),
    linked_transaction_id: s.linkedTransactionId ?? null,
    last_restocked_at: s.lastRestockedAt ?? null,
    is_active: Boolean(s.isActive),
    notes: s.notes ?? null,
    deleted_at: s.deletedAt ?? null,
    generation_counter: toNum(s.generationCounter, 1),
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export function mapSupplementLogToLocal(r: any): SupplementLog {
  const now = new Date().toISOString();
  return {
    id: r.id,
    userId: r.user_id,
    supplementId: r.supplement_id,
    date: r.date,
    servingsTaken: toNum(r.servings_taken, 1),
    takenAt: r.taken_at || r.created_at || now,
    notes: r.notes ?? null,
    ...mapBaseTimestamps(r),
  };
}

export function mapSupplementLogToRemote(l: SupplementLog, userId: string): Record<string, any> {
  return {
    id: l.id,
    user_id: userId,
    supplement_id: l.supplementId,
    date: l.date,
    servings_taken: toNum(l.servingsTaken, 1),
    taken_at: l.takenAt || l.createdAt,
    notes: l.notes ?? null,
    deleted_at: l.deletedAt ?? null,
    generation_counter: toNum(l.generationCounter, 1),
    created_at: l.createdAt,
    updated_at: l.updatedAt,
  };
}
