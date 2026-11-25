import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate } from '../config';
import {
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

  // 30. log_daily_body_metrics (field-merged upsert without null clobber)
  server.registerTool(
    'log_daily_body_metrics',
    {
      title: 'Log Daily Body Metrics',
      description:
        'Field-merged upsert on (user_id, date) for fitness_daily_logs without clobbering unspecified columns. Updates weightKg, waistInches, waterMl/addWaterMl, steps, sleepHours, energyLevel, sorenessLevel, lowEnergyMode, junkFreeOverride, and notes.',
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
          .optional()
          .describe('IST date YYYY-MM-DD (defaults to today in IST)'),
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
        junkFreeOverride: z.boolean().optional(),
        restedHabitIds: z.array(z.string()).optional(),
        notes: z.string().nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:write')) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Forbidden: Missing habitflow:write scope.' }],
        };
      }

      const start = Date.now();
      const dateIst = args.date || getIstIsoDate();
      const supabase = getSupabaseAdmin();

      try {
        const { data: existing, error: fetchErr } = await supabase
          .from('fitness_daily_logs')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('date', dateIst)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

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
          if (args.restedHabitIds !== undefined) updates.rested_habit_ids = args.restedHabitIds;
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
            rested_habit_ids: args.restedHabitIds ?? [],
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

        // Sync current_weight_kg onto fitness_profiles if a profile exists
        if (typeof args.weightKg === 'number' && args.weightKg > 0) {
          const { data: prof } = await supabase
            .from('fitness_profiles')
            .select('*')
            .eq('user_id', auth.userId)
            .is('deleted_at', null)
            .maybeSingle();

          if (prof) {
            await supabase
              .from('fitness_profiles')
              .update({
                current_weight_kg: args.weightKg,
                ...getUpdateMetadata(prof),
              })
              .eq('user_id', auth.userId)
              .eq('id', prof.id);
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
          action: 'upsert',
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
        'List meals, log a meal entry, list/upsert Indian staple meal templates, or soft-delete a meal log (delete requires confirm: true).',
      inputSchema: {
        action: z
          .enum(['list', 'log', 'list_templates', 'upsert_template', 'delete'])
          .describe('Meal management action'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        mealId: z.string().uuid().optional().describe('Meal log UUID for delete'),
        templateId: z.string().uuid().optional().describe('Template UUID for upsert or template lookup'),
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

      if (args.action === 'list' || args.action === 'list_templates') {
        if (!hasScope(auth, 'habitflow:read')) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }],
          };
        }

        if (args.action === 'list_templates') {
          const { data, error } = await supabase
            .from('meal_templates')
            .select('*')
            .eq('user_id', auth.userId)
            .is('deleted_at', null)
            .order('order_index', { ascending: true });
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
        let query = supabase
          .from('meal_logs')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null);

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
        if (args.action === 'delete') {
          if (!args.mealId) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Validation Error: mealId is required.' }],
            };
          }
          if (!args.confirm) {
            return {
              isError: true,
              content: [
                { type: 'text', text: 'Confirmation Required: delete requires confirm: true.' },
              ],
            };
          }

          const { data: existing, error: fetchErr } = await supabase
            .from('meal_logs')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.mealId)
            .is('deleted_at', null)
            .single();

          if (fetchErr || !existing) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Meal log not found: ${args.mealId}` }],
            };
          }

          const { data, error } = await supabase
            .from('meal_logs')
            .update(getSoftDeleteMetadata(existing))
            .eq('user_id', auth.userId)
            .eq('id', args.mealId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_meals',
            action: 'delete',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'deleted', meal: mapMealLogFromRow(data) }, null, 2),
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
          is_junk: args.isJunk !== undefined ? args.isJunk : Boolean(templateRow?.is_junk),
          template_id: args.templateId ?? null,
          linked_transaction_id: args.linkedTransactionId ?? null,
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
              text: JSON.stringify({ action: 'logged', meal: mapMealLogFromRow(data) }, null, 2),
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
        'List workout sessions, log a gym/cardio session with exercises & sets JSONB, compute progressive overload hints, or soft-delete a session (confirm: true required).',
      inputSchema: {
        action: z
          .enum(['list', 'log', 'get_overload_hints', 'delete'])
          .describe('Workout action'),
        workoutId: z.string().uuid().optional().describe('Workout session UUID for delete'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
          .eq('user_id', auth.userId)
          .is('deleted_at', null);

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
        if (args.action === 'delete') {
          if (!args.workoutId) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Validation Error: workoutId is required.' }],
            };
          }
          if (!args.confirm) {
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
            .is('deleted_at', null)
            .single();

          if (fetchErr || !existing) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Workout session not found: ${args.workoutId}` }],
            };
          }

          const { data, error } = await supabase
            .from('workout_sessions')
            .update(getSoftDeleteMetadata(existing))
            .eq('user_id', auth.userId)
            .eq('id', args.workoutId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_workouts',
            action: 'delete',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { action: 'deleted', workout: mapWorkoutSessionFromRow(data) },
                  null,
                  2
                ),
              },
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
      title: 'Manage Supplements & ROI Audit',
      description:
        'List supplement inventory with derived runout dates, upsert inventory items (with proteinPerServingG & anchorBlock), log daily doses (recomputing remaining servings), or compute full Gym & Supplement ROI audit.',
      inputSchema: {
        action: z
          .enum(['list_inventory', 'upsert_item', 'log_dose', 'get_roi_audit'])
          .describe('Supplement action'),
        supplementId: z.string().uuid().optional(),
        name: z.string().min(1).max(120).optional(),
        brand: z.string().nullable().optional(),
        category: z
          .enum(['protein', 'creatine', 'vitamin', 'mineral', 'omega', 'pre_workout', 'other'])
          .optional(),
        unitLabel: z.string().optional(),
        totalServings: z.number().min(1).optional(),
        remainingServings: z.number().min(0).optional(),
        dailyDosage: z.number().min(0.1).optional(),
        costInr: z.number().min(0).optional(),
        proteinPerServingG: z.number().min(0).nullable().optional(),
        anchorBlock: z.enum(['morning', 'work', 'gym', 'night']).nullable().optional(),
        lowStockThresholdDays: z.number().int().min(1).max(60).optional(),
        isActive: z.boolean().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        servingsTaken: z.number().min(0.1).optional(),
        notes: z.string().nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();
      const todayIst = getIstIsoDate();

      if (args.action === 'list_inventory' || args.action === 'get_roi_audit') {
        if (!hasScope(auth, 'habitflow:read')) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Forbidden: Missing habitflow:read scope.' }],
          };
        }

        const [{ data: supRows, error: supErr }, { data: logRows, error: logErr }] =
          await Promise.all([
            supabase
              .from('supplement_inventory')
              .select('*')
              .eq('user_id', auth.userId)
              .is('deleted_at', null),
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
