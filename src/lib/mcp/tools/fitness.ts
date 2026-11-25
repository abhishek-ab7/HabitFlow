import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate } from '../config';
import {
  createLinkedFinanceExpense,
  getInsertMetadata,
  getSoftDeleteMetadata,
  getUpdateMetadata,
} from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';
import {
  mapFinanceCategoryFromRow,
  mapFinanceTransactionFromRow,
  mapFitnessDailyLogFromRow,
  mapFitnessProfileFromRow,
  mapMealLogFromRow,
  mapMealTemplateFromRow,
  mapSupplementInventoryFromRow,
  mapSupplementLogFromRow,
  mapWorkoutSessionFromRow,
} from '../mappers';
import {
  calculate7DayRollingWeight,
  calculateDailyFuelSummary,
  calculateSupplementStockAndRoi,
  calculateWeeklyWaistTrend,
  deriveSupplementRemainingServings,
  getProgressiveOverloadHint,
} from '@/lib/fitness/shared-analytics';
import { computeCrossDomainInsights } from '@/lib/intelligence/cross-domain-insights';
import { addDays } from '@/lib/finance/credit-card-cycles';
import {
  buildAutoMealSupplementNoteTag,
  hasAutoMealSupplementLog,
  matchProteinMealToSupplement,
} from '@/lib/fitness/supplement-meal-bridge';
import { findBestMealTransactionMatch } from '@/lib/fitness/meal-finance-matcher';

const EXERCISE_SET_SCHEMA = z.object({
  reps: z.number().int().min(1),
  weightKg: z.number().min(0),
  rpe: z.number().min(1).max(10).optional(),
  isWarmup: z.boolean().optional(),
});

const EXERCISE_SCHEMA = z.object({
  name: z.string().min(1),
  sets: z.array(EXERCISE_SET_SCHEMA),
  notes: z.string().optional(),
});

export function registerFitnessTools(server: McpServer) {
  // manage_fitness_profile — full CRUD for fitness_profiles
  server.registerTool(
    'manage_fitness_profile',
    {
      title: 'Manage Fitness & Nutrition Profile',
      description:
        'Get, create/update (upsert), soft-delete, or restore the user fitness profile (calorie/protein/macro targets, weight & waist goals, steps/water/sleep targets, gym schedule, and low-energy mode ceilings).',
      inputSchema: {
        action: z.enum(['get', 'upsert', 'delete', 'restore']).describe('Profile action'),
        includeDeleted: z.boolean().optional().default(false).describe('Include soft-deleted profile when getting'),
        heightCm: z.number().min(80).max(260).nullable().optional(),
        currentWeightKg: z.number().min(20).max(350).nullable().optional(),
        targetWeightKg: z.number().min(20).max(350).nullable().optional(),
        startingWeightKg: z.number().min(20).max(350).nullable().optional(),
        targetWaistInches: z.number().min(15).max(80).nullable().optional(),
        calorieTarget: z.number().int().min(800).max(8000).optional(),
        proteinTargetG: z.number().int().min(20).max(500).optional(),
        carbsTargetG: z.number().int().min(0).max(1000).nullable().optional(),
        fatTargetG: z.number().int().min(0).max(400).nullable().optional(),
        waterTargetMl: z.number().int().min(500).max(12000).optional(),
        stepsTarget: z.number().int().min(1000).max(50000).optional(),
        sleepTargetHours: z.number().min(3).max(16).optional(),
        activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
        goalType: z.enum(['fat_loss', 'muscle_gain', 'recomp', 'maintenance']).optional(),
        dietPreference: z.enum(['non_veg', 'eggetarian', 'veg', 'vegan']).optional(),
        gymScheduleDays: z.array(z.number().int().min(0).max(6)).optional(),
        lowEnergyCalorieCeiling: z.number().int().min(800).max(6000).nullable().optional(),
        lowEnergyStepsTarget: z.number().int().min(500).max(20000).optional(),
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
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'get') {
        if (!hasScope(auth, 'habitflow:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }] };
        }
        let query = supabase.from('fitness_profiles').select('*').eq('user_id', auth.userId);
        if (!args.includeDeleted) query = query.is('deleted_at', null);
        const { data, error } = await query.maybeSingle();
        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch fitness profile: ${error.message}` }] };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { profile: data ? mapFitnessProfileFromRow(data) : null },
                null,
                2
              ),
            },
          ],
        };
      }

      if (!hasScope(auth, 'habitflow:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }] };
      }

      const start = Date.now();
      try {
        const { data: existing, error: fetchErr } = await supabase
          .from('fitness_profiles')
          .select('*')
          .eq('user_id', auth.userId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;

        if (args.action === 'delete') {
          if (!args.confirm) {
            return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: delete requires confirm: true.' }] };
          }
          if (!existing) {
            return { isError: true, content: [{ type: 'text', text: 'Fitness profile not found.' }] };
          }
          const { data, error } = await supabase
            .from('fitness_profiles')
            .update(getSoftDeleteMetadata(existing))
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          await logMcpToolInvocation(auth, { toolName: 'manage_fitness_profile', action: 'delete', input: args, status: 'ok', durationMs: Date.now() - start });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'deleted', profile: mapFitnessProfileFromRow(data) }, null, 2) }] };
        }

        if (args.action === 'restore') {
          if (!existing) {
            return { isError: true, content: [{ type: 'text', text: 'Fitness profile not found.' }] };
          }
          const { data, error } = await supabase
            .from('fitness_profiles')
            .update({ deleted_at: null, ...getUpdateMetadata(existing) })
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          await logMcpToolInvocation(auth, { toolName: 'manage_fitness_profile', action: 'restore', input: args, status: 'ok', durationMs: Date.now() - start });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'restored', profile: mapFitnessProfileFromRow(data) }, null, 2) }] };
        }

        // action === 'upsert'
        let savedRow: Record<string, any>;
        if (existing) {
          const updates: Record<string, any> = { deleted_at: null };
          if (args.heightCm !== undefined) updates.height_cm = args.heightCm;
          if (args.currentWeightKg !== undefined) updates.current_weight_kg = args.currentWeightKg;
          if (args.targetWeightKg !== undefined) updates.target_weight_kg = args.targetWeightKg;
          if (args.startingWeightKg !== undefined) updates.starting_weight_kg = args.startingWeightKg;
          if (args.targetWaistInches !== undefined) updates.target_waist_inches = args.targetWaistInches;
          if (args.calorieTarget !== undefined) updates.calorie_target = args.calorieTarget;
          if (args.proteinTargetG !== undefined) updates.protein_target_g = args.proteinTargetG;
          if (args.carbsTargetG !== undefined) updates.carbs_target_g = args.carbsTargetG;
          if (args.fatTargetG !== undefined) updates.fat_target_g = args.fatTargetG;
          if (args.waterTargetMl !== undefined) updates.water_target_ml = args.waterTargetMl;
          if (args.stepsTarget !== undefined) updates.steps_target = args.stepsTarget;
          if (args.sleepTargetHours !== undefined) updates.sleep_target_hours = args.sleepTargetHours;
          if (args.activityLevel !== undefined) updates.activity_level = args.activityLevel;
          if (args.goalType !== undefined) updates.goal_type = args.goalType;
          if (args.dietPreference !== undefined) updates.diet_preference = args.dietPreference;
          if (args.gymScheduleDays !== undefined) updates.gym_schedule_days = args.gymScheduleDays;
          if (args.lowEnergyCalorieCeiling !== undefined) updates.low_energy_calorie_ceiling = args.lowEnergyCalorieCeiling;
          if (args.lowEnergyStepsTarget !== undefined) updates.low_energy_steps_target = args.lowEnergyStepsTarget;

          const { data, error } = await supabase
            .from('fitness_profiles')
            .update({ ...updates, ...getUpdateMetadata(existing) })
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          savedRow = data;
        } else {
          const { data, error } = await supabase
            .from('fitness_profiles')
            .insert({
              user_id: auth.userId,
              height_cm: args.heightCm ?? null,
              current_weight_kg: args.currentWeightKg ?? null,
              target_weight_kg: args.targetWeightKg ?? null,
              starting_weight_kg: args.startingWeightKg ?? args.currentWeightKg ?? null,
              target_waist_inches: args.targetWaistInches ?? null,
              calorie_target: args.calorieTarget ?? 2000,
              protein_target_g: args.proteinTargetG ?? 130,
              carbs_target_g: args.carbsTargetG ?? null,
              fat_target_g: args.fatTargetG ?? null,
              water_target_ml: args.waterTargetMl ?? 3000,
              steps_target: args.stepsTarget ?? 8000,
              sleep_target_hours: args.sleepTargetHours ?? 7.5,
              activity_level: args.activityLevel || 'moderate',
              goal_type: args.goalType || 'fat_loss',
              diet_preference: args.dietPreference || 'non_veg',
              gym_schedule_days: args.gymScheduleDays ?? [1, 2, 3, 4, 5, 6],
              low_energy_calorie_ceiling: args.lowEnergyCalorieCeiling ?? null,
              low_energy_steps_target: args.lowEnergyStepsTarget ?? 3500,
              ...getInsertMetadata(),
            })
            .select()
            .single();
          if (error) throw error;
          savedRow = data;
        }

        await logMcpToolInvocation(auth, {
          toolName: 'manage_fitness_profile',
          action: existing ? 'update' : 'create',
          input: args,
          status: 'ok',
          durationMs: Date.now() - start,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { action: existing ? 'updated' : 'created', profile: mapFitnessProfileFromRow(savedRow) },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_fitness_profile',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage fitness profile: ${err.message}` }] };
      }
    }
  );

  // 29. get_fitness_overview
  server.registerTool(
    'get_fitness_overview',
    {
      title: 'Get Fitness & Bio Overview',
      description:
        'Retrieves IST-aligned Fitness & Diet summary: Big 2 Calorie/Protein progress, water/steps/sleep, Low-Energy Mode state, 7-day rolling weight delta, waist trend, recent workouts, and supplement low-stock status.',
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
          .optional()
          .describe('Target IST date YYYY-MM-DD (defaults to today in IST)'),
        days: z
          .number()
          .int()
          .min(7)
          .max(60)
          .optional()
          .default(14)
          .describe('Lookback days for weight/workout trends'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:read')) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }],
        };
      }

      const dateIst = args.date || getIstIsoDate();
      const lookbackStart = addDays(dateIst, -(args.days || 14) + 1);
      const supabase = getSupabaseAdmin();

      const [
        { data: profileRows, error: profErr },
        { data: logRows, error: logErr },
        { data: mealRows, error: mealErr },
        { data: workoutRows, error: workErr },
        { data: supRows, error: supErr },
        { data: supLogRows, error: supLogErr },
      ] = await Promise.all([
        supabase
          .from('fitness_profiles')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null)
          .limit(1),
        supabase
          .from('fitness_daily_logs')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null)
          .gte('date', addDays(dateIst, -45))
          .lte('date', dateIst)
          .order('date', { ascending: false }),
        supabase
          .from('meal_logs')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null)
          .gte('date', lookbackStart)
          .lte('date', dateIst)
          .order('logged_at', { ascending: false }),
        supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null)
          .gte('date', lookbackStart)
          .lte('date', dateIst)
          .order('date', { ascending: false }),
        supabase
          .from('supplement_inventory')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null),
        supabase
          .from('supplement_logs')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null)
          .gte('date', addDays(dateIst, -35)),
      ]);

      const firstErr = profErr || logErr || mealErr || workErr || supErr || supLogErr;
      if (firstErr) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch fitness overview: ${firstErr.message}` }],
        };
      }

      const profile =
        profileRows && profileRows[0] ? mapFitnessProfileFromRow(profileRows[0]) : null;
      const dailyLogs = (logRows || []).map(mapFitnessDailyLogFromRow);
      const mealLogs = (mealRows || []).map(mapMealLogFromRow);
      const workoutSessions = (workoutRows || []).map(mapWorkoutSessionFromRow);
      const supplements = (supRows || []).map(mapSupplementInventoryFromRow);
      const supplementLogs = (supLogRows || []).map(mapSupplementLogFromRow);

      const todayLog = dailyLogs.find((d) => d.date === dateIst);
      const dailyFuel = calculateDailyFuelSummary(mealLogs, todayLog, profile, dateIst);
      const rollingWeight = calculate7DayRollingWeight(dailyLogs);
      const waistTrend = calculateWeeklyWaistTrend(dailyLogs);
      const supplementRoi = calculateSupplementStockAndRoi(supplements, supplementLogs, dateIst);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                dateIst,
                profile,
                dailyFuel,
                todayBioLog: todayLog || null,
                rollingWeight: {
                  latestWeightKg: rollingWeight.latestWeightKg,
                  latestRollingAvgKg: rollingWeight.latestRollingAvgKg,
                  weeklyDeltaKg: rollingWeight.weeklyDeltaKg,
                },
                waistTrend: {
                  latestWaistInches: waistTrend.latestWaistInches,
                  totalDeltaInches: waistTrend.totalDeltaInches,
                },
                recentWorkoutsCount: workoutSessions.length,
                recentWorkouts: workoutSessions.slice(0, 5),
                todayMeals: mealLogs.filter((m) => m.date === dateIst),
                lowStockSupplements: supplementRoi.lowStockItems.map((i) => ({
                  id: i.supplement.id,
                  name: i.supplement.name,
                  daysRemaining: i.daysRemaining,
                  remainingServings: i.derivedRemainingServings,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 30. log_daily_body_metrics (full CRUD: upsert, list, delete, restore + Low-Energy gym auto-rest hook)
  server.registerTool(
    'log_daily_body_metrics',
    {
      title: 'Manage Daily Body Metrics',
      description:
        'List, upsert (field-merged without null clobber), soft-delete, or restore fitness_daily_logs. Supports weightKg, waistInches, waterMl/addWaterMl, steps, sleepHours, energyLevel, sorenessLevel, lowEnergyMode (+ optional autoRestGymHabits), junkFreeOverride, and notes.',
      inputSchema: {
        action: z.enum(['upsert', 'list', 'delete', 'restore']).optional().default('upsert').describe('Action to perform (defaults to upsert)'),
        logId: z.string().uuid().optional().describe('Daily log UUID (optional for delete/restore)'),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
          .optional()
          .describe('IST date YYYY-MM-DD (defaults to today in IST)'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter start date for list'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter end date for list'),
        limit: z.number().int().min(1).max(90).optional().default(30).describe('Max rows for list'),
        includeDeleted: z.boolean().optional().default(false),
        weightKg: z.number().min(20).max(350).nullable().optional(),
        waistInches: z.number().min(15).max(80).nullable().optional(),
        waterMl: z.number().int().min(0).max(20000).optional().describe('Set exact daily water ml'),
        addWaterMl: z.number().int().min(1).max(5000).optional().describe('Increment daily water ml'),
        steps: z.number().int().min(0).max(150000).optional(),
        sleepHours: z.number().min(0).max(24).nullable().optional(),
        sleepQuality: z.number().int().min(1).max(5).nullable().optional(),
        energyLevel: z.number().int().min(1).max(5).nullable().optional(),
        sorenessLevel: z.number().int().min(1).max(5).nullable().optional(),
        lowEnergyMode: z.boolean().optional(),
        autoRestGymHabits: z.boolean().optional().describe('When lowEnergyMode is true, automatically mark gym-anchored habits as rest for this date'),
        restReason: z.string().optional().describe('Optional reason when auto-resting gym habits in Low-Energy Mode (defaults to Low-Energy Day)'),
        junkFreeOverride: z.boolean().optional(),
        restedHabitIds: z.array(z.string()).optional(),
        notes: z.string().nullable().optional(),
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
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();
      const action = args.action || 'upsert';

      if (action === 'list') {
        if (!hasScope(auth, 'habitflow:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }] };
        }
        let query = supabase.from('fitness_daily_logs').select('*').eq('user_id', auth.userId);
        if (!args.includeDeleted) query = query.is('deleted_at', null);
        if (args.date) query = query.eq('date', args.date);
        if (args.startDate) query = query.gte('date', args.startDate);
        if (args.endDate) query = query.lte('date', args.endDate);
        const { data, error } = await query.order('date', { ascending: false }).limit(args.limit || 30);
        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to list daily body metrics: ${error.message}` }] };
        }
        const logs = (data || []).map(mapFitnessDailyLogFromRow);
        return { content: [{ type: 'text', text: JSON.stringify({ count: logs.length, logs }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:write')) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }],
        };
      }

      const start = Date.now();
      const dateIst = args.date || getIstIsoDate();

      try {
        if (action === 'delete' || action === 'restore') {
          if (action === 'delete' && !args.confirm) {
            return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: delete requires confirm: true.' }] };
          }
          let query = supabase.from('fitness_daily_logs').select('*').eq('user_id', auth.userId);
          query = args.logId ? query.eq('id', args.logId) : query.eq('date', dateIst);
          const { data: existingLog, error: fetchErr } = await query.maybeSingle();
          if (fetchErr) throw fetchErr;
          if (!existingLog) {
            return { isError: true, content: [{ type: 'text', text: `Daily log not found for ${args.logId || dateIst}` }] };
          }

          const patch =
            action === 'delete'
              ? getSoftDeleteMetadata(existingLog)
              : { deleted_at: null, ...getUpdateMetadata(existingLog) };
          const { data, error } = await supabase
            .from('fitness_daily_logs')
            .update(patch)
            .eq('user_id', auth.userId)
            .eq('id', existingLog.id)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'log_daily_body_metrics',
            action,
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { action: action === 'delete' ? 'deleted' : 'restored', dailyLog: mapFitnessDailyLogFromRow(data) },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('fitness_daily_logs')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('date', dateIst)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        // Cross-domain hook: auto-rest gym-anchored habits when entering Low-Energy Mode,
        // and cleanly revert only auto-rested rows when disabling Low-Energy Mode.
        let autoRestedIds: string[] = [];
        let revertedRestHabitIds: string[] = [];
        const restReason = args.restReason?.trim() || 'Low-Energy Day';
        const restNote = `Rest Day: ${restReason}`;

        if (args.lowEnergyMode && args.autoRestGymHabits) {
          const { data: allActiveHabits } = await supabase
            .from('habits')
            .select('id, name, polarity, anchor_block, auto_track_rule')
            .eq('user_id', auth.userId)
            .eq('is_archived', false);

          const gymHabits = (allActiveHabits || []).filter((h: any) => {
            if (h.polarity === 'quit') return false;
            if (h.auto_track_rule && h.auto_track_rule !== 'none') {
              return h.auto_track_rule === 'workout_logged';
            }
            return (
              h.anchor_block === 'gym' ||
              /\b(workout|exercise|gym|training|lift|cardio|run|running|jog|cycling|swim|morning walk)\b/i.test(
                String(h.name || '')
              )
            );
          });

          for (const h of gymHabits) {
            const { data: existingComp } = await supabase
              .from('completions')
              .select('*')
              .eq('user_id', auth.userId)
              .eq('habit_id', h.id)
              .eq('date', dateIst)
              .maybeSingle();

            if (
              existingComp?.completed === true &&
              existingComp?.status !== 'rest' &&
              existingComp?.status !== 'frozen'
            ) {
              continue;
            }

            if (existingComp) {
              const { error: compUpdErr } = await supabase
                .from('completions')
                .update({
                  completed: false,
                  skipped: true,
                  status: 'rest',
                  rest_reason: restReason,
                  notes:
                    existingComp.notes && !/^Rest Day:/i.test(String(existingComp.notes))
                      ? existingComp.notes
                      : restNote,
                  ...getUpdateMetadata(existingComp),
                })
                .eq('id', existingComp.id);
              if (compUpdErr) throw compUpdErr;
            } else {
              const { error: compInsErr } = await supabase.from('completions').insert({
                user_id: auth.userId,
                habit_id: h.id,
                date: dateIst,
                completed: false,
                skipped: true,
                status: 'rest',
                rest_reason: restReason,
                notes: restNote,
                ...getInsertMetadata(),
              });
              if (compInsErr) throw compInsErr;
            }
            autoRestedIds.push(h.id);
          }
        } else if (args.lowEnergyMode === false) {
          const { data: dayComps } = await supabase
            .from('completions')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('date', dateIst);

          const trackedIds = new Set<string>(
            Array.isArray(existing?.rested_habit_ids)
              ? existing.rested_habit_ids.map(String)
              : []
          );
          for (const comp of dayComps || []) {
            const isLowEnergyRest =
              (comp.status === 'rest' ||
                comp.skipped === true ||
                /^Rest Day:/i.test(String(comp.notes || ''))) &&
              (trackedIds.has(comp.habit_id) ||
                comp.rest_reason === 'Low-Energy Day' ||
                comp.rest_reason === 'Low-Energy Mode');
            if (isLowEnergyRest && !comp.completed) {
              const nextNotes = /^Rest Day:\s*(Low-Energy|Recovery)/i.test(
                String(comp.notes || '')
              )
                ? null
                : comp.notes;
              const { error: revErr } = await supabase
                .from('completions')
                .update({
                  completed: false,
                  skipped: false,
                  status: null,
                  rest_reason: null,
                  notes: nextNotes,
                  ...getUpdateMetadata(comp),
                })
                .eq('id', comp.id);
              if (revErr) throw revErr;
              revertedRestHabitIds.push(comp.habit_id);
            }
          }
        }

        let savedRow: Record<string, unknown>;

        if (existing) {
          const updates: Record<string, unknown> = { deleted_at: null };
          if (args.weightKg !== undefined) updates.weight_kg = args.weightKg;
          if (args.waistInches !== undefined) updates.waist_inches = args.waistInches;
          if (args.waterMl !== undefined) {
            updates.water_ml = args.waterMl;
          } else if (args.addWaterMl !== undefined) {
            updates.water_ml = Math.max(0, Number(existing.water_ml || 0) + args.addWaterMl);
          }
          if (args.steps !== undefined) updates.steps = args.steps;
          if (args.sleepHours !== undefined) updates.sleep_hours = args.sleepHours;
          if (args.sleepQuality !== undefined) updates.sleep_quality = args.sleepQuality;
          if (args.energyLevel !== undefined) updates.energy_level = args.energyLevel;
          if (args.sorenessLevel !== undefined) updates.soreness_level = args.sorenessLevel;
          if (args.lowEnergyMode !== undefined) updates.low_energy_mode = args.lowEnergyMode;
          if (args.junkFreeOverride !== undefined)
            updates.junk_free_override = args.junkFreeOverride;
          if (args.lowEnergyMode === false) {
            updates.rested_habit_ids = args.restedHabitIds ?? [];
          } else if (args.restedHabitIds !== undefined || autoRestedIds.length > 0) {
            const existingRested = Array.isArray(existing.rested_habit_ids) ? existing.rested_habit_ids : [];
            const baseList = args.restedHabitIds !== undefined ? args.restedHabitIds : existingRested;
            updates.rested_habit_ids = Array.from(new Set([...baseList, ...autoRestedIds]));
          }
          if (args.notes !== undefined) updates.notes = args.notes;

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('fitness_daily_logs')
            .update({ ...updates, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          savedRow = data;
        } else {
          const meta = getInsertMetadata();
          const newRow = {
            user_id: auth.userId,
            date: dateIst,
            weight_kg: args.weightKg ?? null,
            waist_inches: args.waistInches ?? null,
            water_ml:
              args.waterMl !== undefined
                ? args.waterMl
                : args.addWaterMl !== undefined
                  ? args.addWaterMl
                  : 0,
            steps: args.steps ?? 0,
            sleep_hours: args.sleepHours ?? null,
            sleep_quality: args.sleepQuality ?? null,
            energy_level: args.energyLevel ?? null,
            soreness_level: args.sorenessLevel ?? null,
            low_energy_mode: args.lowEnergyMode ?? false,
            junk_free_override: args.junkFreeOverride ?? false,
            rested_habit_ids:
              args.lowEnergyMode === false
                ? args.restedHabitIds ?? []
                : Array.from(new Set([...(args.restedHabitIds ?? []), ...autoRestedIds])),
            notes: args.notes ?? null,
            ...meta,
          };

          const { data, error } = await supabase
            .from('fitness_daily_logs')
            .insert(newRow)
            .select()
            .single();

          if (error) throw error;
          savedRow = data;
        }

        // Sync current_weight_kg onto fitness_profiles ONLY if this log date >= latest weigh-in date
        let profileWeightSynced = false;
        if (typeof args.weightKg === 'number' && Number.isFinite(args.weightKg) && args.weightKg > 0) {
          const { data: allWeightLogs } = await supabase
            .from('fitness_daily_logs')
            .select('date, weight_kg')
            .eq('user_id', auth.userId)
            .is('deleted_at', null)
            .order('date', { ascending: false });

          const latestWeightedRow = (allWeightLogs || []).find(
            (r: any) =>
              r.weight_kg !== null &&
              r.weight_kg !== undefined &&
              Number.isFinite(Number(r.weight_kg)) &&
              Number(r.weight_kg) > 0
          );
          const latestWeighInDate = latestWeightedRow
            ? String(latestWeightedRow.date).slice(0, 10)
            : null;

          if (!latestWeighInDate || dateIst >= latestWeighInDate) {
            const { data: prof } = await supabase
              .from('fitness_profiles')
              .select('*')
              .eq('user_id', auth.userId)
              .is('deleted_at', null)
              .maybeSingle();

            if (prof) {
              const { error: profUpdErr } = await supabase
                .from('fitness_profiles')
                .update({
                  current_weight_kg: args.weightKg,
                  ...(prof.starting_weight_kg === null || prof.starting_weight_kg === undefined
                    ? { starting_weight_kg: args.weightKg }
                    : {}),
                  ...getUpdateMetadata(prof),
                })
                .eq('user_id', auth.userId)
                .eq('id', prof.id);
              if (profUpdErr) throw profUpdErr;
              profileWeightSynced = true;
            }
          }
        }

        await logMcpToolInvocation(auth, {
          toolName: 'log_daily_body_metrics',
          action: existing ? 'update' : 'insert',
          input: args,
          status: 'ok',
          durationMs: Date.now() - start,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  action: existing ? 'merged_updated' : 'created',
                  autoRestedHabitIds: autoRestedIds,
                  revertedRestHabitIds,
                  profileWeightSynced,
                  dailyLog: mapFitnessDailyLogFromRow(savedRow),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'log_daily_body_metrics',
          action: action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to log body metrics: ${err.message}` }],
        };
      }
    }
  );

  // 31. manage_meals
  server.registerTool(
    'manage_meals',
    {
      title: 'Manage Meals & Saved Templates',
      description:
        'Full CRUD for meal logs and Indian staple meal templates: list, log (optionally creating a linked finance expense when expenseAmount + accountId are provided), update, soft-delete, restore, list_templates, upsert_template, delete_template, restore_template.',
      inputSchema: {
        action: z
          .enum([
            'list',
            'log',
            'update',
            'delete',
            'restore',
            'list_templates',
            'upsert_template',
            'delete_template',
            'restore_template',
          ])
          .describe('Meal management action'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        includeDeleted: z.boolean().optional().default(false),
        mealId: z.string().uuid().optional().describe('Meal log UUID for update, delete, restore'),
        templateId: z.string().uuid().optional().describe('Template UUID for upsert, delete_template, restore_template, or template lookup'),
        name: z.string().min(1).max(160).optional(),
        mealType: z
          .enum(['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'])
          .optional(),
        calories: z.number().min(0).optional(),
        proteinG: z.number().min(0).optional(),
        carbsG: z.number().min(0).optional(),
        fatG: z.number().min(0).optional(),
        fiberG: z.number().min(0).nullable().optional(),
        quantityMultiplier: z.number().min(0.1).max(20).optional(),
        isJunk: z.boolean().optional(),
        servingLabel: z.string().optional(),
        hindiAliases: z.array(z.string()).optional(),
        isPinned: z.boolean().optional(),
        linkedTransactionId: z.string().uuid().nullable().optional(),
        // Optional compound Finance hook when logging a paid meal
        expenseAmount: z.number().positive().optional().describe('Optional INR amount spent to auto-create a linked expense transaction (requires accountId & habitflow:finance:write)'),
        accountId: z.string().uuid().optional().describe('Source finance account UUID for compound paid-meal logging'),
        expenseCategoryId: z.string().uuid().optional().describe('Optional finance category UUID for compound meal expense'),
        merchantName: z.string().optional().describe('Optional restaurant/merchant name for compound meal expense'),
        notes: z.string().nullable().optional(),
        confirm: z.boolean().optional().describe('Required for delete and delete_template'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list' || args.action === 'list_templates') {
        if (!hasScope(auth, 'habitflow:read')) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }],
          };
        }

        if (args.action === 'list_templates') {
          let tQuery = supabase.from('meal_templates').select('*').eq('user_id', auth.userId);
          if (!args.includeDeleted) tQuery = tQuery.is('deleted_at', null);
          const { data, error } = await tQuery.order('order_index', { ascending: true });
          if (error) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Failed to list meal templates: ${error.message}` }],
            };
          }
          const templates = (data || []).map(mapMealTemplateFromRow);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ count: templates.length, templates }, null, 2),
              },
            ],
          };
        }

        const dateIst = args.date || getIstIsoDate();
        let query = supabase.from('meal_logs').select('*').eq('user_id', auth.userId);
        if (!args.includeDeleted) query = query.is('deleted_at', null);

        if (args.startDate || args.endDate) {
          if (args.startDate) query = query.gte('date', args.startDate);
          if (args.endDate) query = query.lte('date', args.endDate);
        } else {
          query = query.eq('date', dateIst);
        }

        const { data, error } = await query.order('logged_at', { ascending: false });
        if (error) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to list meals: ${error.message}` }],
          };
        }

        const meals = (data || []).map(mapMealLogFromRow);
        return {
          content: [
            { type: 'text', text: JSON.stringify({ count: meals.length, meals }, null, 2) },
          ],
        };
      }

      if (!hasScope(auth, 'habitflow:write')) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }],
        };
      }

      const start = Date.now();

      try {
        if (args.action === 'delete' || args.action === 'restore') {
          if (!args.mealId) {
            return { isError: true, content: [{ type: 'text', text: `Validation Error: mealId is required for ${args.action}.` }] };
          }
          if (args.action === 'delete' && !args.confirm) {
            return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: delete requires confirm: true.' }] };
          }

          const { data: existing, error: fetchErr } = await supabase
            .from('meal_logs')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.mealId)
            .single();

          if (fetchErr || !existing) {
            return { isError: true, content: [{ type: 'text', text: `Meal log not found: ${args.mealId}` }] };
          }

          const patch =
            args.action === 'delete'
              ? getSoftDeleteMetadata(existing)
              : { deleted_at: null, ...getUpdateMetadata(existing) };

          const { data, error } = await supabase
            .from('meal_logs')
            .update(patch)
            .eq('user_id', auth.userId)
            .eq('id', args.mealId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_meals',
            action: args.action,
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: args.action === 'delete' ? 'deleted' : 'restored', meal: mapMealLogFromRow(data) }, null, 2),
              },
            ],
          };
        }

        if (args.action === 'update') {
          if (!args.mealId) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: mealId is required for update.' }] };
          }
          const { data: existing, error: fetchErr } = await supabase
            .from('meal_logs')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.mealId)
            .is('deleted_at', null)
            .single();
          if (fetchErr || !existing) {
            return { isError: true, content: [{ type: 'text', text: `Meal log not found: ${args.mealId}` }] };
          }

          const updates: Record<string, unknown> = {};
          if (args.date !== undefined) updates.date = args.date;
          if (args.name !== undefined) updates.name = args.name.trim();
          if (args.mealType !== undefined) updates.meal_type = args.mealType;
          if (args.calories !== undefined) updates.calories = Math.round(args.calories);
          if (args.proteinG !== undefined) updates.protein_g = args.proteinG;
          if (args.carbsG !== undefined) updates.carbs_g = args.carbsG;
          if (args.fatG !== undefined) updates.fat_g = args.fatG;
          if (args.fiberG !== undefined) updates.fiber_g = args.fiberG;
          if (args.quantityMultiplier !== undefined) updates.quantity_multiplier = args.quantityMultiplier;
          if (args.isJunk !== undefined) updates.is_junk = args.isJunk;
          if (args.linkedTransactionId !== undefined) updates.linked_transaction_id = args.linkedTransactionId;
          if (args.notes !== undefined) updates.notes = args.notes;

          const { data, error } = await supabase
            .from('meal_logs')
            .update({ ...updates, ...getUpdateMetadata(existing) })
            .eq('user_id', auth.userId)
            .eq('id', args.mealId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, { toolName: 'manage_meals', action: 'update', input: args, status: 'ok', durationMs: Date.now() - start });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', meal: mapMealLogFromRow(data) }, null, 2) }] };
        }

        if (args.action === 'delete_template' || args.action === 'restore_template') {
          if (!args.templateId) {
            return { isError: true, content: [{ type: 'text', text: `Validation Error: templateId is required for ${args.action}.` }] };
          }
          if (args.action === 'delete_template' && !args.confirm) {
            return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: delete_template requires confirm: true.' }] };
          }
          const { data: existing, error: fetchErr } = await supabase
            .from('meal_templates')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.templateId)
            .single();
          if (fetchErr || !existing) {
            return { isError: true, content: [{ type: 'text', text: `Meal template not found: ${args.templateId}` }] };
          }

          const patch =
            args.action === 'delete_template'
              ? getSoftDeleteMetadata(existing)
              : { deleted_at: null, ...getUpdateMetadata(existing) };

          const { data, error } = await supabase
            .from('meal_templates')
            .update(patch)
            .eq('user_id', auth.userId)
            .eq('id', args.templateId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, { toolName: 'manage_meals', action: args.action, input: args, status: 'ok', durationMs: Date.now() - start });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { action: args.action === 'delete_template' ? 'template_deleted' : 'template_restored', template: mapMealTemplateFromRow(data) },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (args.action === 'upsert_template') {
          if (args.templateId) {
            const { data: existing, error: fetchErr } = await supabase
              .from('meal_templates')
              .select('*')
              .eq('user_id', auth.userId)
              .eq('id', args.templateId)
              .single();
            if (fetchErr || !existing) {
              return {
                isError: true,
                content: [{ type: 'text', text: `Meal template not found: ${args.templateId}` }],
              };
            }
            const updates: Record<string, unknown> = { deleted_at: null };
            if (args.name !== undefined) updates.name = args.name.trim();
            if (args.calories !== undefined) updates.calories = Math.round(args.calories);
            if (args.proteinG !== undefined) updates.protein_g = args.proteinG;
            if (args.carbsG !== undefined) updates.carbs_g = args.carbsG;
            if (args.fatG !== undefined) updates.fat_g = args.fatG;
            if (args.fiberG !== undefined) updates.fiber_g = args.fiberG;
            if (args.servingLabel !== undefined) updates.serving_label = args.servingLabel;
            if (args.hindiAliases !== undefined) updates.hindi_aliases = args.hindiAliases;
            if (args.mealType !== undefined) updates.meal_type = args.mealType;
            if (args.isJunk !== undefined) updates.is_junk = args.isJunk;
            if (args.isPinned !== undefined) updates.is_pinned = args.isPinned;

            const { data, error } = await supabase
              .from('meal_templates')
              .update({ ...updates, ...getUpdateMetadata(existing) })
              .eq('user_id', auth.userId)
              .eq('id', args.templateId)
              .select()
              .single();
            if (error) throw error;

            await logMcpToolInvocation(auth, {
              toolName: 'manage_meals',
              action: 'upsert_template',
              input: args,
              status: 'ok',
              durationMs: Date.now() - start,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { action: 'template_updated', template: mapMealTemplateFromRow(data) },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          if (!args.name) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Validation Error: name is required for template.' }],
            };
          }

          const { data, error } = await supabase
            .from('meal_templates')
            .insert({
              user_id: auth.userId,
              name: args.name.trim(),
              hindi_aliases: args.hindiAliases || [],
              calories: Math.round(args.calories ?? 0),
              protein_g: args.proteinG ?? 0,
              carbs_g: args.carbsG ?? 0,
              fat_g: args.fatG ?? 0,
              fiber_g: args.fiberG ?? null,
              serving_label: args.servingLabel || '1 serving',
              meal_type: args.mealType ?? null,
              is_junk: args.isJunk ?? false,
              is_pinned: args.isPinned !== false,
              order_index: 0,
              ...getInsertMetadata(),
            })
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_meals',
            action: 'upsert_template',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { action: 'template_created', template: mapMealTemplateFromRow(data) },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // action === 'log'
        let templateRow: Record<string, any> | null = null;
        if (args.templateId) {
          const { data } = await supabase
            .from('meal_templates')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.templateId)
            .maybeSingle();
          templateRow = data;
        }

        const mealName = (args.name || templateRow?.name || '').trim();
        if (!mealName) {
          return {
            isError: true,
            content: [
              { type: 'text', text: 'Validation Error: name or valid templateId is required.' },
            ],
          };
        }

        const mult = Math.max(0.1, Number(args.quantityMultiplier ?? 1));
        const dateIst = args.date || getIstIsoDate();
        const isJunkMeal = args.isJunk !== undefined ? args.isJunk : Boolean(templateRow?.is_junk);

        let linkedTxResult: { transaction: Record<string, any>; updatedAccounts: { id: string; newBalance: number }[] } | null = null;
        if (args.expenseAmount && args.expenseAmount > 0) {
          if (!args.accountId) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Validation Error: accountId is required when expenseAmount is provided.' }],
            };
          }
          if (!hasScope(auth, 'habitflow:finance:write')) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope for compound meal expense logging.' }],
            };
          }
          linkedTxResult = await createLinkedFinanceExpense(supabase, auth.userId, {
            title: mealName,
            merchantName: args.merchantName || mealName,
            amount: args.expenseAmount,
            accountId: args.accountId,
            categoryId: args.expenseCategoryId,
            preferredCategorySlugs: ['food-dining', 'other'],
            subcategory: isJunkMeal ? 'Junk Food' : 'Healthy Meal',
            date: dateIst,
            notes: args.notes ?? `Logged via meal: ${mealName}`,
            tags: ['fitness_meal', ...(isJunkMeal ? ['junk_food'] : [])],
          });
        }

        let resolvedLinkedTxId = linkedTxResult?.transaction.id ?? args.linkedTransactionId ?? null;
        let autoLinkedTransaction: {
          id: string;
          title: string;
          amount: number;
          date: string;
        } | null = null;

        if (!resolvedLinkedTxId && hasScope(auth, 'habitflow:finance:read')) {
          const [{ data: dayTxs }, { data: finCats }, { data: dayMeals }] = await Promise.all([
            supabase
              .from('finance_transactions')
              .select('*')
              .eq('user_id', auth.userId)
              .eq('date', dateIst)
              .is('deleted_at', null),
            supabase
              .from('finance_categories')
              .select('*')
              .eq('user_id', auth.userId)
              .is('deleted_at', null),
            supabase
              .from('meal_logs')
              .select('*')
              .eq('user_id', auth.userId)
              .eq('date', dateIst)
              .is('deleted_at', null),
          ]);
          const mappedTxs = (dayTxs || []).map(mapFinanceTransactionFromRow);
          const mappedCats = (finCats || []).map(mapFinanceCategoryFromRow);
          const mappedMealsDay = (dayMeals || []).map(mapMealLogFromRow);
          const txMatch = findBestMealTransactionMatch(
            {
              id: '__draft__',
              name: mealName,
              date: dateIst,
              isJunk: isJunkMeal,
              notes: args.notes ?? null,
            },
            mappedTxs,
            mappedMealsDay,
            mappedCats
          );
          if (txMatch && txMatch.confidence === 'high') {
            resolvedLinkedTxId = txMatch.transaction.id;
            autoLinkedTransaction = {
              id: txMatch.transaction.id,
              title: txMatch.transaction.title,
              amount: txMatch.transaction.amount,
              date: txMatch.transaction.date,
            };
          }
        }

        const insertPayload = {
          user_id: auth.userId,
          date: dateIst,
          meal_type: args.mealType || templateRow?.meal_type || 'snack',
          name: mealName,
          calories: Math.round(
            args.calories !== undefined
              ? args.calories
              : Number(templateRow?.calories || 0) * mult
          ),
          protein_g:
            args.proteinG !== undefined
              ? args.proteinG
              : Number(templateRow?.protein_g || 0) * mult,
          carbs_g:
            args.carbsG !== undefined ? args.carbsG : Number(templateRow?.carbs_g || 0) * mult,
          fat_g: args.fatG !== undefined ? args.fatG : Number(templateRow?.fat_g || 0) * mult,
          fiber_g:
            args.fiberG !== undefined
              ? args.fiberG
              : templateRow?.fiber_g !== undefined && templateRow?.fiber_g !== null
                ? Number(templateRow.fiber_g) * mult
                : null,
          quantity_multiplier: mult,
          is_junk: isJunkMeal,
          template_id: args.templateId ?? null,
          linked_transaction_id: resolvedLinkedTxId,
          source: 'mcp',
          notes: args.notes ?? null,
          logged_at: new Date().toISOString(),
          ...getInsertMetadata(),
        };

        const { data, error } = await supabase
          .from('meal_logs')
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;

        const mappedMeal = mapMealLogFromRow(data);

        // Auto-deduct matching protein supplement inventory for non-junk meals
        let autoLoggedSupplement: {
          supplementId: string;
          name: string;
          brand: string | null;
          servingsTaken: number;
          remainingServings: number;
          logId: string;
        } | null = null;

        if (!isJunkMeal) {
          const { data: supRows } = await supabase
            .from('supplement_inventory')
            .select('*')
            .eq('user_id', auth.userId)
            .is('deleted_at', null);

          const mappedSups = (supRows || []).map(mapSupplementInventoryFromRow);
          const supMatch = matchProteinMealToSupplement(mappedMeal, mappedSups);
          if (supMatch) {
            const { data: existingSupLogs } = await supabase
              .from('supplement_logs')
              .select('*')
              .eq('user_id', auth.userId)
              .eq('supplement_id', supMatch.supplement.id)
              .is('deleted_at', null);

            const mappedExistingSupLogs = (existingSupLogs || []).map(mapSupplementLogFromRow);
            if (
              !hasAutoMealSupplementLog(
                mappedExistingSupLogs,
                mappedMeal.id,
                supMatch.supplement.id
              )
            ) {
              const { data: insSupLog, error: insSupLogErr } = await supabase
                .from('supplement_logs')
                .insert({
                  user_id: auth.userId,
                  supplement_id: supMatch.supplement.id,
                  date: dateIst,
                  servings_taken: supMatch.servings,
                  taken_at: new Date().toISOString(),
                  notes: `Auto-synced from meal: ${mealName} ${buildAutoMealSupplementNoteTag(mappedMeal.id)}`,
                  ...getInsertMetadata(),
                })
                .select()
                .single();

              if (!insSupLogErr && insSupLog) {
                const allLogsForSup = [
                  ...mappedExistingSupLogs,
                  mapSupplementLogFromRow(insSupLog),
                ];
                const nextRemaining = deriveSupplementRemainingServings(
                  supMatch.supplement,
                  allLogsForSup
                );
                const rawSupRow = (supRows || []).find(
                  (r: any) => r.id === supMatch.supplement.id
                );
                const { error: updSupErr } = await supabase
                  .from('supplement_inventory')
                  .update({
                    remaining_servings: nextRemaining,
                    ...getUpdateMetadata(rawSupRow),
                  })
                  .eq('user_id', auth.userId)
                  .eq('id', supMatch.supplement.id);
                if (updSupErr) throw updSupErr;

                autoLoggedSupplement = {
                  supplementId: supMatch.supplement.id,
                  name: supMatch.supplement.name,
                  brand: supMatch.supplement.brand ?? null,
                  servingsTaken: supMatch.servings,
                  remainingServings: nextRemaining,
                  logId: insSupLog.id,
                };
              }
            }
          }
        }

        await logMcpToolInvocation(auth, {
          toolName: 'manage_meals',
          action: 'log',
          input: args,
          status: 'ok',
          durationMs: Date.now() - start,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  action: 'logged',
                  meal: mappedMeal,
                  ...(autoLoggedSupplement ? { autoLoggedSupplement } : {}),
                  ...(autoLinkedTransaction ? { autoLinkedTransaction } : {}),
                  ...(linkedTxResult
                    ? {
                        linkedTransaction: linkedTxResult.transaction,
                        updatedAccounts: linkedTxResult.updatedAccounts,
                      }
                    : {}),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_meals',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to manage meals: ${err.message}` }],
        };
      }
    }
  );

  // 32. manage_workouts
  server.registerTool(
    'manage_workouts',
    {
      title: 'Manage Workout Sessions & Overload Hints',
      description:
        'Full CRUD for workouts: list sessions, log a gym/cardio session with exercises & sets JSONB, update an existing session, compute progressive overload hints, soft-delete (confirm: true), or restore.',
      inputSchema: {
        action: z
          .enum(['list', 'log', 'update', 'get_overload_hints', 'delete', 'restore'])
          .describe('Workout action'),
        workoutId: z.string().uuid().optional().describe('Workout session UUID for update, delete, or restore'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        includeDeleted: z.boolean().optional().default(false),
        title: z.string().min(1).max(160).optional(),
        workoutType: z
          .enum([
            'push',
            'pull',
            'legs',
            'upper',
            'lower',
            'full_body',
            'cardio',
            'mobility',
            'sports',
            'strength',
          ])
          .optional(),
        durationMinutes: z.number().int().min(1).max(600).optional(),
        estimatedCaloriesBurned: z.number().int().min(0).nullable().optional(),
        exercises: z.array(EXERCISE_SCHEMA).optional(),
        exerciseName: z
          .string()
          .optional()
          .describe('Specific exercise name to compute progressive overload hint for'),
        rpe: z.number().int().min(1).max(10).nullable().optional(),
        notes: z.string().nullable().optional(),
        confirm: z.boolean().optional().describe('Required for delete'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list' || args.action === 'get_overload_hints') {
        if (!hasScope(auth, 'habitflow:read')) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }],
          };
        }

        let query = supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', auth.userId);
        if (!args.includeDeleted || args.action === 'get_overload_hints') {
          query = query.is('deleted_at', null);
        }

        if (args.startDate) query = query.gte('date', args.startDate);
        if (args.endDate) query = query.lte('date', args.endDate);

        const { data, error } = await query.order('date', { ascending: false }).limit(50);
        if (error) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to fetch workouts: ${error.message}` }],
          };
        }

        const sessions = (data || []).map(mapWorkoutSessionFromRow);

        if (args.action === 'list') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ count: sessions.length, workouts: sessions }, null, 2),
              },
            ],
          };
        }

        if (args.exerciseName) {
          const hint = getProgressiveOverloadHint(sessions, args.exerciseName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ exerciseName: args.exerciseName, hint }, null, 2),
              },
            ],
          };
        }

        const distinctNames = Array.from(
          new Set(
            sessions.flatMap((s) => (s.exercises || []).map((ex) => ex.name)).filter(Boolean)
          )
        ).slice(0, 12);
        const hints = distinctNames
          .map((name) => getProgressiveOverloadHint(sessions, name))
          .filter(Boolean);

        return {
          content: [
            { type: 'text', text: JSON.stringify({ count: hints.length, hints }, null, 2) },
          ],
        };
      }

      if (!hasScope(auth, 'habitflow:write')) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }],
        };
      }

      const start = Date.now();
      try {
        if (args.action === 'delete' || args.action === 'restore') {
          if (!args.workoutId) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Validation Error: workoutId is required for ${args.action}.` }],
            };
          }
          if (args.action === 'delete' && !args.confirm) {
            return {
              isError: true,
              content: [
                { type: 'text', text: 'Confirmation Required: delete requires confirm: true.' },
              ],
            };
          }

          const { data: existing, error: fetchErr } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.workoutId)
            .single();

          if (fetchErr || !existing) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Workout session not found: ${args.workoutId}` }],
            };
          }

          const patch =
            args.action === 'delete'
              ? getSoftDeleteMetadata(existing)
              : { deleted_at: null, ...getUpdateMetadata(existing) };

          const { data, error } = await supabase
            .from('workout_sessions')
            .update(patch)
            .eq('user_id', auth.userId)
            .eq('id', args.workoutId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_workouts',
            action: args.action,
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { action: args.action === 'delete' ? 'deleted' : 'restored', workout: mapWorkoutSessionFromRow(data) },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (args.action === 'update') {
          if (!args.workoutId) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: workoutId is required for update.' }] };
          }
          const { data: existing, error: fetchErr } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.workoutId)
            .is('deleted_at', null)
            .single();
          if (fetchErr || !existing) {
            return { isError: true, content: [{ type: 'text', text: `Workout session not found: ${args.workoutId}` }] };
          }

          const updates: Record<string, unknown> = {};
          if (args.date !== undefined) updates.date = args.date;
          if (args.title !== undefined) updates.title = args.title.trim();
          if (args.workoutType !== undefined) updates.workout_type = args.workoutType;
          if (args.durationMinutes !== undefined) updates.duration_minutes = args.durationMinutes;
          if (args.estimatedCaloriesBurned !== undefined) updates.estimated_calories_burned = args.estimatedCaloriesBurned;
          if (args.exercises !== undefined) updates.exercises = args.exercises;
          if (args.rpe !== undefined) updates.rpe = args.rpe;
          if (args.notes !== undefined) updates.notes = args.notes;

          const { data, error } = await supabase
            .from('workout_sessions')
            .update({ ...updates, ...getUpdateMetadata(existing) })
            .eq('user_id', auth.userId)
            .eq('id', args.workoutId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, { toolName: 'manage_workouts', action: 'update', input: args, status: 'ok', durationMs: Date.now() - start });
          return {
            content: [
              { type: 'text', text: JSON.stringify({ action: 'updated', workout: mapWorkoutSessionFromRow(data) }, null, 2) },
            ],
          };
        }

        // action === 'log'
        if (!args.title) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Validation Error: title is required to log workout.' }],
          };
        }

        const dateIst = args.date || getIstIsoDate();
        const { data, error } = await supabase
          .from('workout_sessions')
          .insert({
            user_id: auth.userId,
            date: dateIst,
            title: args.title.trim(),
            workout_type: args.workoutType || 'strength',
            duration_minutes: args.durationMinutes ?? 45,
            estimated_calories_burned: args.estimatedCaloriesBurned ?? null,
            exercises: args.exercises || [],
            rpe: args.rpe ?? null,
            notes: args.notes ?? null,
            source: 'mcp',
            ...getInsertMetadata(),
          })
          .select()
          .single();

        if (error) throw error;

        await logMcpToolInvocation(auth, {
          toolName: 'manage_workouts',
          action: 'log',
          input: args,
          status: 'ok',
          durationMs: Date.now() - start,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { action: 'logged', workout: mapWorkoutSessionFromRow(data) },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_workouts',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to manage workout: ${err.message}` }],
        };
      }
    }
  );

  // 33. manage_supplements
  server.registerTool(
    'manage_supplements',
    {
      title: 'Manage Supplements, Dose Logs & ROI Audit',
      description:
        'Full CRUD for supplement inventory and dose logs: list_inventory, upsert_item, restock_item (optionally creating a linked finance expense), delete_item, restore_item, log_dose, list_logs, update_log, delete_log, restore_log, and get_roi_audit.',
      inputSchema: {
        action: z
          .enum([
            'list_inventory',
            'upsert_item',
            'restock_item',
            'delete_item',
            'restore_item',
            'log_dose',
            'list_logs',
            'update_log',
            'delete_log',
            'restore_log',
            'get_roi_audit',
          ])
          .describe('Supplement action'),
        supplementId: z.string().uuid().optional(),
        logId: z.string().uuid().optional().describe('Supplement dose log UUID for update_log, delete_log, restore_log'),
        name: z.string().min(1).max(120).optional(),
        brand: z.string().nullable().optional(),
        category: z
          .enum(['protein', 'creatine', 'vitamin', 'mineral', 'omega', 'pre_workout', 'other'])
          .optional(),
        unitLabel: z.string().optional(),
        totalServings: z.number().min(1).optional(),
        addedServings: z.number().min(1).optional().describe('Additional servings when restocking'),
        remainingServings: z.number().min(0).optional(),
        dailyDosage: z.number().min(0.1).optional(),
        costInr: z.number().min(0).optional(),
        proteinPerServingG: z.number().min(0).nullable().optional(),
        anchorBlock: z.enum(['morning', 'work', 'gym', 'night']).nullable().optional(),
        lowStockThresholdDays: z.number().int().min(1).max(60).optional(),
        isActive: z.boolean().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        includeDeleted: z.boolean().optional().default(false),
        servingsTaken: z.number().min(0.1).optional(),
        expenseAmount: z.number().positive().optional().describe('Optional INR amount spent when restocking to auto-create linked finance expense'),
        accountId: z.string().uuid().optional().describe('Source finance account UUID for compound restock expense'),
        expenseCategoryId: z.string().uuid().optional(),
        notes: z.string().nullable().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for delete_item and delete_log'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();
      const todayIst = getIstIsoDate();

      const recomputeInventoryRemaining = async (supRow: Record<string, any>) => {
        const mappedSup = mapSupplementInventoryFromRow(supRow);
        const { data: allLogs } = await supabase
          .from('supplement_logs')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('supplement_id', mappedSup.id)
          .is('deleted_at', null);
        const nextRemaining = deriveSupplementRemainingServings(
          mappedSup,
          (allLogs || []).map(mapSupplementLogFromRow)
        );
        await supabase
          .from('supplement_inventory')
          .update({
            remaining_servings: nextRemaining,
            ...getUpdateMetadata(supRow),
          })
          .eq('user_id', auth.userId)
          .eq('id', mappedSup.id);
        return nextRemaining;
      };

      if (args.action === 'list_logs') {
        if (!hasScope(auth, 'habitflow:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }] };
        }
        let lQuery = supabase.from('supplement_logs').select('*').eq('user_id', auth.userId);
        if (args.supplementId) lQuery = lQuery.eq('supplement_id', args.supplementId);
        if (args.date) lQuery = lQuery.eq('date', args.date);
        if (args.startDate) lQuery = lQuery.gte('date', args.startDate);
        if (args.endDate) lQuery = lQuery.lte('date', args.endDate);
        if (!args.includeDeleted) lQuery = lQuery.is('deleted_at', null);
        const { data, error } = await lQuery.order('date', { ascending: false }).order('taken_at', { ascending: false });
        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to list supplement logs: ${error.message}` }] };
        }
        const logs = (data || []).map(mapSupplementLogFromRow);
        return { content: [{ type: 'text', text: JSON.stringify({ count: logs.length, logs }, null, 2) }] };
      }

      if (args.action === 'list_inventory' || args.action === 'get_roi_audit') {
        if (!hasScope(auth, 'habitflow:read')) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }],
          };
        }

        let invQuery = supabase.from('supplement_inventory').select('*').eq('user_id', auth.userId);
        if (!args.includeDeleted || args.action === 'get_roi_audit') {
          invQuery = invQuery.is('deleted_at', null);
        }

        const [{ data: supRows, error: supErr }, { data: logRows, error: logErr }] =
          await Promise.all([
            invQuery,
            supabase
              .from('supplement_logs')
              .select('*')
              .eq('user_id', auth.userId)
              .is('deleted_at', null),
          ]);

        if (supErr || logErr) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Failed to fetch supplements: ${(supErr || logErr)?.message}`,
              },
            ],
          };
        }

        const inventory = (supRows || []).map(mapSupplementInventoryFromRow);
        const logs = (logRows || []).map(mapSupplementLogFromRow);
        const summary = calculateSupplementStockAndRoi(inventory, logs, todayIst);

        if (args.action === 'list_inventory') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    todayIst,
                    totalMonthlySpendInr: summary.totalMonthlySpendInr,
                    items: summary.items,
                    lowStockItems: summary.lowStockItems.map((i) => ({
                      id: i.supplement.id,
                      name: i.supplement.name,
                      daysRemaining: i.daysRemaining,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // get_roi_audit: optionally join gym expenses if finance scope granted
        const [{ data: workoutRows }, financeResults] = await Promise.all([
          supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', auth.userId)
            .is('deleted_at', null)
            .gte('date', addDays(todayIst, -30)),
          hasScope(auth, 'habitflow:finance:read')
            ? Promise.all([
                supabase
                  .from('finance_transactions')
                  .select('*')
                  .eq('user_id', auth.userId)
                  .is('deleted_at', null),
                supabase
                  .from('finance_categories')
                  .select('*')
                  .eq('user_id', auth.userId)
                  .is('deleted_at', null),
              ])
            : Promise.resolve([{ data: [] }, { data: [] }]),
        ]);

        const [txRes, catRes] = financeResults as [
          { data: any[] | null },
          { data: any[] | null },
        ];
        const workouts = (workoutRows || []).map(mapWorkoutSessionFromRow);
        const crossDomain = computeCrossDomainInsights({
          todayDate: todayIst,
          transactions: (txRes?.data || []).map(mapFinanceTransactionFromRow),
          categories: (catRes?.data || []).map(mapFinanceCategoryFromRow),
          workoutSessions: workouts,
          supplementInventory: inventory,
          supplementLogs: logs,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  todayIst,
                  gymSupplementRoi: crossDomain.gymSupplementRoi,
                  proteinBenchmarks: summary.proteinBenchmarks.slice(0, 6),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (!hasScope(auth, 'habitflow:write')) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }],
        };
      }

      const start = Date.now();
      try {
        if (args.action === 'delete_item' || args.action === 'restore_item') {
          if (!args.supplementId) {
            return { isError: true, content: [{ type: 'text', text: `Validation Error: supplementId is required for ${args.action}.` }] };
          }
          if (args.action === 'delete_item' && !args.confirm) {
            return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: delete_item requires confirm: true.' }] };
          }
          const { data: existing, error: fetchErr } = await supabase
            .from('supplement_inventory')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.supplementId)
            .single();
          if (fetchErr || !existing) {
            return { isError: true, content: [{ type: 'text', text: `Supplement not found: ${args.supplementId}` }] };
          }

          const patch =
            args.action === 'delete_item'
              ? { is_active: false, ...getSoftDeleteMetadata(existing) }
              : { is_active: true, deleted_at: null, ...getUpdateMetadata(existing) };

          const { data, error } = await supabase
            .from('supplement_inventory')
            .update(patch)
            .eq('user_id', auth.userId)
            .eq('id', args.supplementId)
            .select()
            .single();
          if (error) throw error;
          await logMcpToolInvocation(auth, { toolName: 'manage_supplements', action: args.action, input: args, status: 'ok', durationMs: Date.now() - start });
          return {
            content: [
              { type: 'text', text: JSON.stringify({ action: args.action === 'delete_item' ? 'item_deleted' : 'item_restored', item: mapSupplementInventoryFromRow(data) }, null, 2) },
            ],
          };
        }

        if (args.action === 'restock_item') {
          if (!args.supplementId) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: supplementId is required for restock_item.' }] };
          }
          const { data: existing, error: fetchErr } = await supabase
            .from('supplement_inventory')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.supplementId)
            .is('deleted_at', null)
            .single();
          if (fetchErr || !existing) {
            return { isError: true, content: [{ type: 'text', text: `Supplement not found: ${args.supplementId}` }] };
          }

          let linkedTxResult: { transaction: Record<string, any>; updatedAccounts: { id: string; newBalance: number }[] } | null = null;
          if (args.expenseAmount && args.expenseAmount > 0) {
            if (!args.accountId) {
              return { isError: true, content: [{ type: 'text', text: 'Validation Error: accountId is required when expenseAmount is provided.' }] };
            }
            if (!hasScope(auth, 'habitflow:finance:write')) {
              return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope for compound restock expense.' }] };
            }
            linkedTxResult = await createLinkedFinanceExpense(supabase, auth.userId, {
              title: `Restock: ${existing.name}`,
              merchantName: existing.brand || existing.name,
              amount: args.expenseAmount,
              accountId: args.accountId,
              categoryId: args.expenseCategoryId,
              preferredCategorySlugs: ['health-fitness', 'other'],
              subcategory: 'Supplements',
              date: args.date || todayIst,
              notes: args.notes ?? `Restocked ${existing.name}`,
              tags: ['supplement_restock', 'fitness'],
            });
          }

          const { data: supLogs } = await supabase
            .from('supplement_logs')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('supplement_id', existing.id)
            .is('deleted_at', null);
          const takenSum = (supLogs || []).reduce((s, l) => s + Math.max(0, Number(l.servings_taken || 0)), 0);

          const currentRem = Number(existing.remaining_servings ?? 0);
          const nextTotal =
            args.totalServings !== undefined
              ? Number(args.totalServings)
              : Number(existing.total_servings || 30) + Number(args.addedServings || 30);
          const targetRemaining =
            args.remainingServings !== undefined
              ? Math.max(0, Number(args.remainingServings))
              : Number((currentRem + Number(args.addedServings ?? args.totalServings ?? existing.total_servings ?? 30)).toFixed(2));
          const nextManualAdj = Number((targetRemaining + takenSum - nextTotal).toFixed(2));

          const { data: updated, error: updErr } = await supabase
            .from('supplement_inventory')
            .update({
              total_servings: nextTotal,
              remaining_servings: targetRemaining,
              manual_adjustment: nextManualAdj,
              cost_inr: args.costInr !== undefined ? args.costInr : args.expenseAmount ?? existing.cost_inr,
              last_restocked_at: args.date || todayIst,
              linked_transaction_id: linkedTxResult?.transaction.id ?? existing.linked_transaction_id ?? null,
              is_active: true,
              notes: args.notes !== undefined ? args.notes : existing.notes,
              ...getUpdateMetadata(existing),
            })
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();
          if (updErr) throw updErr;

          await logMcpToolInvocation(auth, { toolName: 'manage_supplements', action: 'restock_item', input: args, status: 'ok', durationMs: Date.now() - start });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    action: 'restocked',
                    item: mapSupplementInventoryFromRow(updated),
                    ...(linkedTxResult
                      ? {
                          linkedTransaction: linkedTxResult.transaction,
                          updatedAccounts: linkedTxResult.updatedAccounts,
                        }
                      : {}),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (args.action === 'update_log' || args.action === 'delete_log' || args.action === 'restore_log') {
          if (!args.logId) {
            return { isError: true, content: [{ type: 'text', text: `Validation Error: logId is required for ${args.action}.` }] };
          }
          if (args.action === 'delete_log' && !args.confirm) {
            return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: delete_log requires confirm: true.' }] };
          }
          const { data: existingLog, error: logErr } = await supabase
            .from('supplement_logs')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.logId)
            .single();
          if (logErr || !existingLog) {
            return { isError: true, content: [{ type: 'text', text: `Supplement log not found: ${args.logId}` }] };
          }

          let updatedLog: Record<string, any>;
          if (args.action === 'delete_log') {
            const { data, error } = await supabase
              .from('supplement_logs')
              .update(getSoftDeleteMetadata(existingLog))
              .eq('user_id', auth.userId)
              .eq('id', args.logId)
              .select()
              .single();
            if (error) throw error;
            updatedLog = data;
          } else if (args.action === 'restore_log') {
            const { data, error } = await supabase
              .from('supplement_logs')
              .update({ deleted_at: null, ...getUpdateMetadata(existingLog) })
              .eq('user_id', auth.userId)
              .eq('id', args.logId)
              .select()
              .single();
            if (error) throw error;
            updatedLog = data;
          } else {
            const updates: Record<string, unknown> = {};
            if (args.date !== undefined) updates.date = args.date;
            if (args.servingsTaken !== undefined) updates.servings_taken = args.servingsTaken;
            if (args.notes !== undefined) updates.notes = args.notes;
            const { data, error } = await supabase
              .from('supplement_logs')
              .update({ ...updates, ...getUpdateMetadata(existingLog) })
              .eq('user_id', auth.userId)
              .eq('id', args.logId)
              .select()
              .single();
            if (error) throw error;
            updatedLog = data;
          }

          const { data: parentSup } = await supabase
            .from('supplement_inventory')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', existingLog.supplement_id)
            .maybeSingle();

          const remainingServings = parentSup ? await recomputeInventoryRemaining(parentSup) : null;

          await logMcpToolInvocation(auth, { toolName: 'manage_supplements', action: args.action, input: args, status: 'ok', durationMs: Date.now() - start });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    action: args.action,
                    log: mapSupplementLogFromRow(updatedLog),
                    remainingServings,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (args.action === 'log_dose') {
          if (!args.supplementId) {
            return {
              isError: true,
              content: [
                { type: 'text', text: 'Validation Error: supplementId is required for log_dose.' },
              ],
            };
          }

          const { data: supRow, error: supFetchErr } = await supabase
            .from('supplement_inventory')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.supplementId)
            .is('deleted_at', null)
            .single();

          if (supFetchErr || !supRow) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Supplement not found: ${args.supplementId}` }],
            };
          }

          const mappedSup = mapSupplementInventoryFromRow(supRow);
          const doseServings = Math.max(
            0.1,
            Number(args.servingsTaken ?? mappedSup.dailyDosage ?? 1)
          );
          const dateIst = args.date || todayIst;

          const { data: newLogRow, error: logInsErr } = await supabase
            .from('supplement_logs')
            .insert({
              user_id: auth.userId,
              supplement_id: mappedSup.id,
              date: dateIst,
              servings_taken: doseServings,
              taken_at: new Date().toISOString(),
              notes: args.notes ?? null,
              ...getInsertMetadata(),
            })
            .select()
            .single();
          if (logInsErr) throw logInsErr;

          const { data: allSupLogs } = await supabase
            .from('supplement_logs')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('supplement_id', mappedSup.id)
            .is('deleted_at', null);

          const mappedLogs = (allSupLogs || []).map(mapSupplementLogFromRow);
          if (!mappedLogs.some((l) => l.id === newLogRow.id)) {
            mappedLogs.push(mapSupplementLogFromRow(newLogRow));
          }

          const nextRemaining = deriveSupplementRemainingServings(mappedSup, mappedLogs);
          await supabase
            .from('supplement_inventory')
            .update({
              remaining_servings: nextRemaining,
              ...getUpdateMetadata(supRow),
            })
            .eq('user_id', auth.userId)
            .eq('id', mappedSup.id);

          await logMcpToolInvocation(auth, {
            toolName: 'manage_supplements',
            action: 'log_dose',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    action: 'dose_logged',
                    log: mapSupplementLogFromRow(newLogRow),
                    remainingServings: nextRemaining,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // action === 'upsert_item'
        if (args.supplementId) {
          const { data: existing, error: fetchErr } = await supabase
            .from('supplement_inventory')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.supplementId)
            .single();

          if (fetchErr || !existing) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Supplement not found: ${args.supplementId}` }],
            };
          }

          const { data: supLogs } = await supabase
            .from('supplement_logs')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('supplement_id', args.supplementId)
            .is('deleted_at', null);

          const takenSum = (supLogs || []).reduce(
            (s, l) => s + Math.max(0, Number(l.servings_taken || 0)),
            0
          );
          const nextTotal =
            args.totalServings !== undefined
              ? args.totalServings
              : Number(existing.total_servings || 30);

          const updates: Record<string, unknown> = { deleted_at: null };
          if (args.name !== undefined) updates.name = args.name.trim();
          if (args.brand !== undefined) updates.brand = args.brand;
          if (args.category !== undefined) updates.category = args.category;
          if (args.unitLabel !== undefined) updates.unit_label = args.unitLabel;
          if (args.totalServings !== undefined) updates.total_servings = nextTotal;
          if (args.dailyDosage !== undefined) updates.daily_dosage = args.dailyDosage;
          if (args.costInr !== undefined) updates.cost_inr = args.costInr;
          if (args.proteinPerServingG !== undefined)
            updates.protein_per_serving_g = args.proteinPerServingG;
          if (args.anchorBlock !== undefined) updates.anchor_block = args.anchorBlock;
          if (args.lowStockThresholdDays !== undefined)
            updates.low_stock_threshold_days = args.lowStockThresholdDays;
          if (args.isActive !== undefined) updates.is_active = args.isActive;
          if (args.notes !== undefined) updates.notes = args.notes;

          if (args.remainingServings !== undefined) {
            const targetRem = Math.max(0, Number(args.remainingServings));
            updates.remaining_servings = targetRem;
            updates.manual_adjustment = Number((targetRem + takenSum - nextTotal).toFixed(2));
          }

          const { data, error } = await supabase
            .from('supplement_inventory')
            .update({ ...updates, ...getUpdateMetadata(existing) })
            .eq('user_id', auth.userId)
            .eq('id', args.supplementId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_supplements',
            action: 'upsert_item',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { action: 'updated', item: mapSupplementInventoryFromRow(data) },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (!args.name) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Validation Error: name is required.' }],
          };
        }

        const totalServings = Math.max(1, Number(args.totalServings ?? 30));
        const remainingServings =
          args.remainingServings !== undefined
            ? Math.max(0, Number(args.remainingServings))
            : totalServings;
        const manualAdjustment = Number((remainingServings - totalServings).toFixed(2));

        const { data, error } = await supabase
          .from('supplement_inventory')
          .insert({
            user_id: auth.userId,
            name: args.name.trim(),
            brand: args.brand ?? null,
            category: args.category || 'other',
            unit_label: args.unitLabel || 'scoop',
            total_servings: totalServings,
            remaining_servings: remainingServings,
            manual_adjustment: manualAdjustment,
            daily_dosage: args.dailyDosage ?? 1,
            cost_inr: args.costInr ?? 0,
            protein_per_serving_g: args.proteinPerServingG ?? null,
            anchor_block: args.anchorBlock ?? null,
            low_stock_threshold_days: args.lowStockThresholdDays ?? 7,
            last_restocked_at: todayIst,
            is_active: args.isActive !== false,
            notes: args.notes ?? null,
            ...getInsertMetadata(),
          })
          .select()
          .single();
        if (error) throw error;

        await logMcpToolInvocation(auth, {
          toolName: 'manage_supplements',
          action: 'upsert_item',
          input: args,
          status: 'ok',
          durationMs: Date.now() - start,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { action: 'created', item: mapSupplementInventoryFromRow(data) },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_supplements',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to manage supplements: ${err.message}` }],
        };
      }
    }
  );
}
