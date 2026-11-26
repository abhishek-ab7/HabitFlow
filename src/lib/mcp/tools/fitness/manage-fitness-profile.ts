import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import { mapFitnessProfileFromRow } from '../../mappers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';

const PROFILE_UPDATE_COLUMNS = [
  ['heightCm', 'height_cm'],
  ['currentWeightKg', 'current_weight_kg'],
  ['targetWeightKg', 'target_weight_kg'],
  ['startingWeightKg', 'starting_weight_kg'],
  ['targetWaistInches', 'target_waist_inches'],
  ['calorieTarget', 'calorie_target'],
  ['proteinTargetG', 'protein_target_g'],
  ['carbsTargetG', 'carbs_target_g'],
  ['fatTargetG', 'fat_target_g'],
  ['waterTargetMl', 'water_target_ml'],
  ['stepsTarget', 'steps_target'],
  ['sleepTargetHours', 'sleep_target_hours'],
  ['activityLevel', 'activity_level'],
  ['goalType', 'goal_type'],
  ['dietPreference', 'diet_preference'],
  ['gymScheduleDays', 'gym_schedule_days'],
  ['lowEnergyCalorieCeiling', 'low_energy_calorie_ceiling'],
  ['lowEnergyStepsTarget', 'low_energy_steps_target'],
] as const;

type UserId = string;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

async function fetchProfileRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  activeOnly: boolean
) {
  let query = supabase.from('fitness_profiles').select('*').eq('user_id', userId);
  if (activeOnly) query = query.is('deleted_at', null);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

async function getFitnessProfile(userId: UserId) {
  try {
    const row = await fetchProfileRow(getSupabaseAdmin(), userId, true);
    return mcpJson({ profile: row ? mapFitnessProfileFromRow(row) : null });
  } catch (err) {
    return mcpError(`Failed to fetch fitness profile: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function buildNewProfileRow(userId: UserId, args: Record<string, unknown>) {
  return {
    user_id: userId,
    height_cm: orVal(args.heightCm, null),
    current_weight_kg: orVal(args.currentWeightKg, null),
    target_weight_kg: orVal(args.targetWeightKg, null),
    starting_weight_kg: orVal(args.startingWeightKg, orVal(args.currentWeightKg, null)),
    target_waist_inches: orVal(args.targetWaistInches, null),
    calorie_target: orVal(args.calorieTarget, 2000),
    protein_target_g: orVal(args.proteinTargetG, 130),
    carbs_target_g: orVal(args.carbsTargetG, null),
    fat_target_g: orVal(args.fatTargetG, null),
    water_target_ml: orVal(args.waterTargetMl, 3000),
    steps_target: orVal(args.stepsTarget, 8000),
    sleep_target_hours: orVal(args.sleepTargetHours, 7.5),
    activity_level: orVal(args.activityLevel, 'moderate'),
    goal_type: orVal(args.goalType, 'fat_loss'),
    diet_preference: orVal(args.dietPreference, 'non_veg'),
    gym_schedule_days: orVal(args.gymScheduleDays, [1, 2, 3, 4, 5, 6]),
    low_energy_calorie_ceiling: orVal(args.lowEnergyCalorieCeiling, null),
    low_energy_steps_target: orVal(args.lowEnergyStepsTarget, 3500),
    ...getInsertMetadata(),
  };
}

async function patchProfileRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  profileId: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('fitness_profiles')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', profileId)
    .select()
    .single();
  if (error) throw error;
  return mapFitnessProfileFromRow(data);
}

async function deleteOrRestoreProfile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (args.action === 'delete' && !args.confirm) {
    return { error: 'Confirmation Required: Deleting fitness profile requires confirm: true.' };
  }
  const existing = await fetchProfileRow(supabase, userId, false);
  if (!existing) return { error: 'Fitness profile not found.' };

  const patch =
    args.action === 'delete' ? getSoftDeleteMetadata(existing) : { deleted_at: null, ...getUpdateMetadata(existing) };
  const profile = await patchProfileRow(supabase, userId, String(existing.id), patch);
  return { payload: { action: args.action === 'delete' ? 'deleted' : 'restored', profile } };
}

async function upsertFitnessProfile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ payload: unknown }> {
  const existing = await fetchProfileRow(supabase, userId, false);
  if (existing) {
    const profile = await patchProfileRow(supabase, userId, String(existing.id), {
      ...pickDefinedColumns(args, PROFILE_UPDATE_COLUMNS),
      deleted_at: null,
      ...getUpdateMetadata(existing),
    });
    return { payload: { action: 'updated', profile } };
  }
  const { data, error } = await supabase.from('fitness_profiles').insert(buildNewProfileRow(userId, args)).select().single();
  if (error) throw error;
  return { payload: { action: 'created', profile: mapFitnessProfileFromRow(data) } };
}

async function handleManageProfileWrite(auth: McpAuthContext, args: Record<string, unknown>) {
  const startMs = Date.now();
  const action = String(args.action || 'upsert');
  const supabase = getSupabaseAdmin();

  try {
    const outcome: { error?: string; payload?: unknown } =
      action === 'delete' || action === 'restore'
        ? await deleteOrRestoreProfile(supabase, auth.userId, args)
        : await upsertFitnessProfile(supabase, auth.userId, args);
    if (outcome.error) return mcpError(outcome.error);

    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_fitness_profile',
      action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_fitness_profile',
      action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage fitness profile',
    });
  }
}

export function registerManageFitnessProfileTool(server: McpServer) {
  server.registerTool(
    'manage_fitness_profile',
    {
      title: 'Manage Fitness Profile & Targets',
      description:
        'Get, upsert, soft-delete, or restore the user fitness profile (height, current/target/starting weight, target waist, calorie/protein/water/steps/sleep targets, activity level, goal type, diet preference, gym schedule, and Low-Energy Mode ceilings).',
      inputSchema: {
        action: z.enum(['get', 'upsert', 'delete', 'restore']).optional().default('upsert').describe('Action to perform (defaults to upsert)'),
        heightCm: z.number().min(80).max(260).optional(),
        currentWeightKg: z.number().min(20).max(350).optional(),
        targetWeightKg: z.number().min(20).max(350).optional(),
        startingWeightKg: z.number().min(20).max(350).optional(),
        targetWaistInches: z.number().min(15).max(80).optional(),
        calorieTarget: z.number().int().min(800).max(8000).optional(),
        proteinTargetG: z.number().int().min(20).max(500).optional(),
        carbsTargetG: z.number().int().min(0).max(1000).nullable().optional(),
        fatTargetG: z.number().int().min(0).max(400).nullable().optional(),
        waterTargetMl: z.number().int().min(500).max(12000).optional(),
        stepsTarget: z.number().int().min(500).max(100000).optional(),
        sleepTargetHours: z.number().min(3).max(14).optional(),
        activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
        goalType: z.enum(['fat_loss', 'muscle_gain', 'recomp', 'maintenance']).optional(),
        dietPreference: z.enum(['veg', 'eggetarian', 'non_veg', 'vegan']).optional(),
        gymScheduleDays: z.array(z.number().int().min(0).max(6)).optional(),
        lowEnergyCalorieCeiling: z.number().int().min(800).max(6000).nullable().optional(),
        lowEnergyStepsTarget: z.number().int().min(500).max(50000).optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for delete'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      if (args.action === 'get') {
        const authRes = authorizeMcpTool('habitflow:read');
        if (!authRes.ok) return authRes.response;
        return getFitnessProfile(authRes.auth.userId);
      }
      const authRes = authorizeMcpTool('habitflow:write');
      if (!authRes.ok) return authRes.response;
      return handleManageProfileWrite(authRes.auth, args);
    }
  );
}
