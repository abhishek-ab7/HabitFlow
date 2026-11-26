import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';

type UserId = string;
type IsoDate = string;

const GYM_NAME_REGEX = /\b(workout|exercise|gym|training|lift|cardio|run|running|jog|cycling|swim|morning walk)\b/i;

function matchesGymName(name: unknown): boolean {
  return GYM_NAME_REGEX.test(String(name || ''));
}

function isGymHabitRow(h: Record<string, unknown>): boolean {
  if (h.polarity === 'quit') return false;
  if (h.auto_track_rule && h.auto_track_rule !== 'none') {
    return h.auto_track_rule === 'workout_logged';
  }
  return h.anchor_block === 'gym' || matchesGymName(h.name);
}

function isProtectedCompletedRow(existingComp: Record<string, unknown> | null): boolean {
  return Boolean(
    existingComp &&
      existingComp.completed === true &&
      existingComp.status !== 'rest' &&
      existingComp.status !== 'frozen'
  );
}

function resolveRestedNote(existingNotes: unknown, restNote: string) {
  const keepNotes = Boolean(existingNotes) && !/^Rest Day:/i.test(String(existingNotes));
  return keepNotes ? existingNotes : restNote;
}

async function updateExistingRestCompletion(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  existingComp: Record<string, unknown>,
  restReason: string,
  restNote: string
) {
  const { error } = await supabase
    .from('completions')
    .update({
      completed: false,
      skipped: true,
      status: 'rest',
      rest_reason: restReason,
      notes: resolveRestedNote(existingComp.notes, restNote),
      ...getUpdateMetadata(existingComp),
    })
    .eq('id', existingComp.id);
  if (error) throw error;
}

async function insertNewRestCompletion(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: UserId;
  habitId: string;
  dateIst: IsoDate;
  restReason: string;
  restNote: string;
}) {
  const { error } = await params.supabase.from('completions').insert({
    user_id: params.userId,
    habit_id: params.habitId,
    date: params.dateIst,
    completed: false,
    skipped: true,
    status: 'rest',
    rest_reason: params.restReason,
    notes: params.restNote,
    ...getInsertMetadata(),
  });
  if (error) throw error;
}

async function upsertGymRestCompletion(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: UserId;
  habitId: string;
  dateIst: IsoDate;
  restReason: string;
  restNote: string;
}) {
  const { supabase, userId, habitId, dateIst, restReason, restNote } = params;
  const { data: existingComp } = await supabase
    .from('completions')
    .select('*')
    .eq('user_id', userId)
    .eq('habit_id', habitId)
    .eq('date', dateIst)
    .maybeSingle();

  if (isProtectedCompletedRow(existingComp)) return false;

  if (existingComp) {
    await updateExistingRestCompletion(supabase, existingComp, restReason, restNote);
    return true;
  }

  await insertNewRestCompletion(params);
  return true;
}

async function fetchActiveHabitsForUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId
) {
  const { data } = await supabase
    .from('habits')
    .select('id, name, polarity, anchor_block, auto_track_rule')
    .eq('user_id', userId)
    .eq('is_archived', false);
  return data || [];
}

export async function autoRestGymHabitsForDay(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  dateIst: IsoDate,
  rawRestReason?: unknown
): Promise<string[]> {
  const allActiveHabits = await fetchActiveHabitsForUser(supabase, userId);
  const restReason = rawRestReason ? String(rawRestReason).trim() : 'Low-Energy Day';
  const restNote = `Rest Day: ${restReason}`;
  const autoRestedIds: string[] = [];

  for (const h of allActiveHabits.filter(isGymHabitRow)) {
    const rested = await upsertGymRestCompletion({
      supabase,
      userId,
      habitId: String(h.id),
      dateIst,
      restReason,
      restNote,
    });
    if (rested) autoRestedIds.push(String(h.id));
  }
  return autoRestedIds;
}

function isLowEnergyRestCompletion(comp: Record<string, unknown>, trackedIds: Set<string>): boolean {
  if (comp.completed) return false;
  const isRestLike = comp.status === 'rest' || comp.skipped === true || /^Rest Day:/i.test(String(comp.notes || ''));
  const isLowEnergySource =
    trackedIds.has(String(comp.habit_id)) ||
    comp.rest_reason === 'Low-Energy Day' ||
    comp.rest_reason === 'Low-Energy Mode';
  return isRestLike && isLowEnergySource;
}

async function revertSingleCompletionIfLowEnergy(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  comp: Record<string, unknown>,
  trackedIds: Set<string>
): Promise<string | null> {
  if (!isLowEnergyRestCompletion(comp, trackedIds)) return null;
  const nextNotes = /^Rest Day:\s*(Low-Energy|Recovery)/i.test(String(comp.notes || '')) ? null : comp.notes;
  const { error } = await supabase
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
  if (error) throw error;
  return String(comp.habit_id);
}

function extractTrackedRestedIds(existing: Record<string, unknown> | null): Set<string> {
  return new Set<string>(Array.isArray(existing?.rested_habit_ids) ? existing.rested_habit_ids.map(String) : []);
}

export async function revertLowEnergyRestHabits(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  dateIst: IsoDate,
  existing: Record<string, unknown> | null
): Promise<string[]> {
  const { data: dayComps } = await supabase
    .from('completions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', dateIst);

  const trackedIds = extractTrackedRestedIds(existing);
  const reverted: string[] = [];

  for (const comp of dayComps || []) {
    const revertedId = await revertSingleCompletionIfLowEnergy(supabase, comp, trackedIds);
    if (revertedId) reverted.push(revertedId);
  }
  return reverted;
}

function isPositiveNumber(val: unknown): val is number {
  return val !== null && val !== undefined && Number.isFinite(Number(val)) && Number(val) > 0;
}

async function fetchLatestWeighInDate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId
): Promise<string | null> {
  const { data: allWeightLogs } = await supabase
    .from('fitness_daily_logs')
    .select('date, weight_kg')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('date', { ascending: false });

  const latestWeighted = (allWeightLogs || []).find((r: Record<string, unknown>) => isPositiveNumber(r.weight_kg));
  return latestWeighted ? String(latestWeighted.date).slice(0, 10) : null;
}

async function updateProfileCurrentWeight(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  prof: Record<string, unknown>,
  weightKg: number
) {
  const startingPatch = prof.starting_weight_kg == null ? { starting_weight_kg: weightKg } : {};
  const { error } = await supabase
    .from('fitness_profiles')
    .update({ current_weight_kg: weightKg, ...startingPatch, ...getUpdateMetadata(prof) })
    .eq('user_id', userId)
    .eq('id', prof.id);
  if (error) throw error;
}

export async function syncProfileWeightIfLatest(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  dateIst: IsoDate,
  weightKg: unknown
): Promise<boolean> {
  if (!isPositiveNumber(weightKg) || typeof weightKg !== 'number') return false;
  const latestDate = await fetchLatestWeighInDate(supabase, userId);
  if (latestDate && dateIst < latestDate) return false;

  const { data: prof } = await supabase
    .from('fitness_profiles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!prof) return false;

  await updateProfileCurrentWeight(supabase, userId, prof, weightKg);
  return true;
}
