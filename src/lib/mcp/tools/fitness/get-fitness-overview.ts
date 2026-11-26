import { z } from 'zod';
import { addDays } from '@/lib/finance/credit-card-cycles';
import type { McpServer } from '@modelcontextprotocol/server';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import {
  mapFitnessDailyLogFromRow,
  mapFitnessProfileFromRow,
  mapMealLogFromRow,
  mapSupplementInventoryFromRow,
  mapSupplementLogFromRow,
  mapWorkoutSessionFromRow,
} from '../../mappers';
import {
  calculate7DayRollingWeight,
  calculateDailyFuelSummary,
  calculateSupplementStockAndRoi,
  calculateWeeklyWaistTrend,
} from '@/lib/fitness/shared-analytics';
import { authorizeMcpTool, mcpError, mcpJson } from '../tool-helpers';

type UserId = string;
type IsoDate = string;

async function fetchFitnessOverviewRows(userId: UserId, dateIst: IsoDate, lookbackStart: IsoDate) {
  const supabase = getSupabaseAdmin();
  return Promise.all([
    supabase.from('fitness_profiles').select('*').eq('user_id', userId).is('deleted_at', null).limit(1),
    supabase
      .from('fitness_daily_logs')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('date', addDays(dateIst, -45))
      .lte('date', dateIst)
      .order('date', { ascending: false }),
    supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('date', lookbackStart)
      .lte('date', dateIst)
      .order('logged_at', { ascending: false }),
    supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('date', lookbackStart)
      .lte('date', dateIst)
      .order('date', { ascending: false }),
    supabase.from('supplement_inventory').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('supplement_logs').select('*').eq('user_id', userId).is('deleted_at', null).gte('date', addDays(dateIst, -35)),
  ]);
}

function buildFitnessOverviewPayload(
  results: Array<{ data: Record<string, unknown>[] | null }>,
  dateIst: IsoDate
) {
  const profileRows = results[0].data ?? [];
  const profile = profileRows[0] ? mapFitnessProfileFromRow(profileRows[0]) : null;
  const dailyLogs = (results[1].data ?? []).map(mapFitnessDailyLogFromRow);
  const mealLogs = (results[2].data ?? []).map(mapMealLogFromRow);
  const workoutSessions = (results[3].data ?? []).map(mapWorkoutSessionFromRow);
  const supplements = (results[4].data ?? []).map(mapSupplementInventoryFromRow);
  const supplementLogs = (results[5].data ?? []).map(mapSupplementLogFromRow);

  const todayLog = dailyLogs.find((d) => d.date === dateIst);
  const dailyFuel = calculateDailyFuelSummary(mealLogs, todayLog, profile, dateIst);
  const rollingWeight = calculate7DayRollingWeight(dailyLogs);
  const waistTrend = calculateWeeklyWaistTrend(dailyLogs);
  const supplementRoi = calculateSupplementStockAndRoi(supplements, supplementLogs, dateIst);

  return {
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
  };
}

export function registerGetFitnessOverviewTool(server: McpServer) {
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
        days: z.number().int().min(7).max(60).optional().default(14).describe('Lookback days for weight/workout trends'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const authRes = authorizeMcpTool('habitflow:read');
      if (!authRes.ok) return authRes.response;

      const dateIst = args.date || getIstIsoDate();
      const lookbackStart = addDays(dateIst, -(args.days || 14) + 1);
      const results = await fetchFitnessOverviewRows(authRes.auth.userId, dateIst, lookbackStart);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) return mcpError(`Failed to fetch fitness overview: ${firstErr.message}`);

      return mcpJson(buildFitnessOverviewPayload(results, dateIst));
    }
  );
}
