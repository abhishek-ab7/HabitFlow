/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DietPreference,
  FitnessActivityLevel,
  FitnessDailyLog,
  FitnessGoalType,
  FitnessProfile,
  HabitAnchorBlock,
  MealLog,
  MealLogSource,
  MealTemplate,
  MealType,
  SupplementCategory,
  SupplementInventory,
  SupplementLog,
  WorkoutExercise,
  WorkoutSession,
  WorkoutType,
} from '@/lib/types';
import {
  arrOr,
  bool,
  nullNum,
  num,
  rowIdentity,
  rowTimestamps,
  str,
  strArr,
} from './row-utils';

function mapProfileBodyFields(r: Record<string, any>) {
  return {
    heightCm: nullNum(r.height_cm),
    currentWeightKg: nullNum(r.current_weight_kg),
    targetWeightKg: nullNum(r.target_weight_kg),
    startingWeightKg: nullNum(r.starting_weight_kg),
    targetWaistInches: nullNum(r.target_waist_inches),
    calorieTarget: num(r.calorie_target, 2000),
    proteinTargetG: num(r.protein_target_g, 130),
    carbsTargetG: nullNum(r.carbs_target_g),
    fatTargetG: nullNum(r.fat_target_g),
  };
}

function mapProfileScheduleFields(r: Record<string, any>) {
  return {
    waterTargetMl: num(r.water_target_ml, 3000),
    stepsTarget: num(r.steps_target, 8000),
    sleepTargetHours: num(r.sleep_target_hours, 7.5),
    activityLevel: str(r.activity_level, 'moderate') as FitnessActivityLevel,
    goalType: str(r.goal_type, 'fat_loss') as FitnessGoalType,
    dietPreference: str(r.diet_preference, 'non_veg') as DietPreference,
    gymScheduleDays: Array.isArray(r.gym_schedule_days)
      ? r.gym_schedule_days.map(Number)
      : [1, 2, 3, 4, 5, 6],
    lowEnergyCalorieCeiling: nullNum(r.low_energy_calorie_ceiling),
    lowEnergyStepsTarget: num(r.low_energy_steps_target, 3500),
  };
}

export function mapFitnessProfileFromRow(r: Record<string, any>): FitnessProfile {
  return {
    ...rowIdentity(r),
    ...mapProfileBodyFields(r),
    ...mapProfileScheduleFields(r),
    ...rowTimestamps(r),
  };
}

export function mapFitnessDailyLogFromRow(r: Record<string, any>): FitnessDailyLog {
  return {
    ...rowIdentity(r),
    date: str(r.date).slice(0, 10),
    weightKg: nullNum(r.weight_kg),
    waistInches: nullNum(r.waist_inches),
    waterMl: num(r.water_ml),
    steps: num(r.steps),
    sleepHours: nullNum(r.sleep_hours),
    sleepQuality: nullNum(r.sleep_quality),
    energyLevel: nullNum(r.energy_level),
    sorenessLevel: nullNum(r.soreness_level),
    lowEnergyMode: bool(r.low_energy_mode),
    junkFreeOverride: bool(r.junk_free_override),
    restedHabitIds: strArr(r.rested_habit_ids),
    notes: r.notes ?? null,
    ...rowTimestamps(r),
  };
}

export function mapMealTemplateFromRow(r: Record<string, any>): MealTemplate {
  return {
    ...rowIdentity(r),
    name: str(r.name),
    hindiAliases: strArr(r.hindi_aliases),
    calories: num(r.calories),
    proteinG: num(r.protein_g),
    carbsG: num(r.carbs_g),
    fatG: num(r.fat_g),
    fiberG: nullNum(r.fiber_g),
    servingLabel: str(r.serving_label, '1 serving'),
    mealType: (r.meal_type || null) as MealType | null,
    isJunk: bool(r.is_junk),
    isPinned: r.is_pinned !== false,
    order: num(r.order_index),
    ...rowTimestamps(r),
  };
}

export function mapMealLogFromRow(r: Record<string, any>): MealLog {
  const timestamps = rowTimestamps(r);
  return {
    ...rowIdentity(r),
    date: str(r.date).slice(0, 10),
    mealType: str(r.meal_type, 'snack') as MealType,
    name: str(r.name),
    calories: num(r.calories),
    proteinG: num(r.protein_g),
    carbsG: num(r.carbs_g),
    fatG: num(r.fat_g),
    fiberG: nullNum(r.fiber_g),
    quantityMultiplier: num(r.quantity_multiplier, 1),
    isJunk: bool(r.is_junk),
    templateId: r.template_id ?? null,
    linkedTransactionId: r.linked_transaction_id ?? null,
    source: str(r.source, 'manual') as MealLogSource,
    notes: r.notes ?? null,
    loggedAt: r.logged_at || r.created_at || timestamps.createdAt,
    ...timestamps,
  };
}

export function mapWorkoutSessionFromRow(r: Record<string, any>): WorkoutSession {
  return {
    ...rowIdentity(r),
    date: str(r.date).slice(0, 10),
    title: str(r.title),
    workoutType: str(r.workout_type, 'strength') as WorkoutType,
    durationMinutes: num(r.duration_minutes),
    estimatedCaloriesBurned: nullNum(r.estimated_calories_burned),
    exercises: arrOr<WorkoutExercise>(r.exercises, []),
    rpe: nullNum(r.rpe),
    notes: r.notes ?? null,
    source: str(r.source, 'manual'),
    ...rowTimestamps(r),
  };
}

export function mapSupplementInventoryFromRow(r: Record<string, any>): SupplementInventory {
  return {
    ...rowIdentity(r),
    name: str(r.name),
    brand: r.brand ?? null,
    category: str(r.category, 'other') as SupplementCategory,
    unitLabel: str(r.unit_label, 'scoop'),
    totalServings: num(r.total_servings, 30),
    remainingServings: num(r.remaining_servings, 30),
    dailyDosage: num(r.daily_dosage, 1),
    costInr: num(r.cost_inr),
    proteinPerServingG: nullNum(r.protein_per_serving_g),
    manualAdjustment: num(r.manual_adjustment),
    anchorBlock: (r.anchor_block || null) as HabitAnchorBlock | null,
    lowStockThresholdDays: num(r.low_stock_threshold_days, 7),
    linkedTransactionId: r.linked_transaction_id ?? null,
    lastRestockedAt: r.last_restocked_at ? String(r.last_restocked_at).slice(0, 10) : null,
    isActive: r.is_active !== false,
    notes: r.notes ?? null,
    ...rowTimestamps(r),
  };
}

export function mapSupplementLogFromRow(r: Record<string, any>): SupplementLog {
  const timestamps = rowTimestamps(r);
  return {
    ...rowIdentity(r),
    supplementId: str(r.supplement_id),
    date: str(r.date).slice(0, 10),
    servingsTaken: num(r.servings_taken, 1),
    takenAt: r.taken_at || r.created_at || timestamps.createdAt,
    notes: r.notes ?? null,
    ...timestamps,
  };
}
