import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { upsertRowsWithColumnFallback } from './column-fallback';
import type { Habit } from '@/lib/types';
import type { ISynchronizer } from '../types';

export class HabitsSyncEngine implements ISynchronizer {
  public domainName = 'habits';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    // 1. Bulk push local changes
    const dirtyLocalHabits = await db.habits
      .where('userId')
      .equals(userId)
      .filter((habit: any) => habit.isDirty === true || habit.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalHabits.length; i += BATCH_SIZE) {
      const batch = dirtyLocalHabits.slice(i, i + BATCH_SIZE);
      const payload = batch.map((h) => ({
        id: h.id,
        user_id: userId,
        name: h.name,
        icon: h.icon || '✓',
        category: h.category,
        target_days: h.targetDaysPerWeek,
        frequency_type: h.frequencyType || (h.targetDaysPerWeek < 7 ? 'weekly_flexible' : 'daily'),
        scheduled_days: h.scheduledDays || null,
        interval_days: h.intervalDays || null,
        allow_bonus_completions: h.allowBonusCompletions ?? true,
        auto_track_rule: h.autoTrackRule || null,
        polarity: h.polarity || 'build',
        anchor_block: h.anchorBlock || null,
        metadata: h.metadata || null,
        is_archived: h.archived,
        order_index: h.order,
        is_quantitative: h.isQuantitative || false,
        target_value: h.targetValue || 0,
        unit: h.unit || '',
        generation_counter: h.generationCounter || 1,
        updated_at: new Date().toISOString()
      }));

      const { error } = await upsertRowsWithColumnFallback(
        this.supabase,
        'habits',
        payload,
        { onConflict: 'id' }
      );

      if (error) {
        // Fallback if remote schema has unresolvable schema cache errors on legacy V1 tables
        const legacyPayload = batch.map((h) => ({
          id: h.id,
          user_id: userId,
          name: h.name,
          icon: h.icon || '✓',
          category: h.category,
          target_days: h.targetDaysPerWeek,
          is_archived: h.archived,
          order_index: h.order,
          is_quantitative: h.isQuantitative || false,
          target_value: h.targetValue || 0,
          unit: h.unit || '',
          generation_counter: h.generationCounter || 1,
          updated_at: new Date().toISOString()
        }));
        const { error: fallbackError } = await (this.supabase.from('habits') as any)
          .upsert(legacyPayload, { onConflict: 'id' });
        if (fallbackError) {
          throw new Error(`[HabitsSyncEngine Bulk Push Failure]: ${fallbackError.message}`);
        }
      }

      await db.transaction('rw', db.habits, async () => {
        const ids = batch.map((b) => b.id);
        await Promise.all(ids.map(id => db.habits.update(id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    // 2. Pull remote updates
    const latestLocalHabit = await db.habits.where('userId').equals(userId).sortBy('updatedAt');
    let lastPushedTimestamp = latestLocalHabit.length > 0 
      ? latestLocalHabit[latestLocalHabit.length - 1].updatedAt 
      : null;
    if (!lastPushedTimestamp || lastPushedTimestamp === 'undefined') {
      lastPushedTimestamp = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: remoteData, error: pullError } = await (this.supabase
      .from('habits') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastPushedTimestamp);

    if (pullError) throw new Error(`[HabitsSyncEngine Pull Failure]: ${pullError.message}`);

    let pulledCount = 0;
    if (remoteData && remoteData.length > 0) {
      await db.transaction('rw', db.habits, async () => {
        for (const remote of remoteData) {
          const local = await db.habits.get(remote.id);
          
          if (!local || (remote.generation_counter || 0) > (local.generationCounter || 0)) {
            const targetDays = remote.target_days ?? 7;
            await db.habits.put({
              id: remote.id,
              userId: remote.user_id,
              name: remote.name,
              icon: remote.icon,
              category: remote.category,
              targetDaysPerWeek: targetDays,
              frequencyType:
                remote.frequency_type ||
                local?.frequencyType ||
                (targetDays < 7 ? 'weekly_flexible' : 'daily'),
              scheduledDays: Object.prototype.hasOwnProperty.call(remote, 'scheduled_days')
                ? (remote.scheduled_days ?? undefined)
                : local?.scheduledDays,
              intervalDays: Object.prototype.hasOwnProperty.call(remote, 'interval_days')
                ? (remote.interval_days ?? undefined)
                : local?.intervalDays,
              allowBonusCompletions:
                remote.allow_bonus_completions ?? local?.allowBonusCompletions ?? true,
              autoTrackRule: Object.prototype.hasOwnProperty.call(remote, 'auto_track_rule')
                ? (remote.auto_track_rule ?? undefined)
                : local?.autoTrackRule,
              polarity: Object.prototype.hasOwnProperty.call(remote, 'polarity')
                ? (remote.polarity ?? 'build')
                : (local?.polarity ?? 'build'),
              anchorBlock: Object.prototype.hasOwnProperty.call(remote, 'anchor_block')
                ? (remote.anchor_block ?? undefined)
                : local?.anchorBlock,
              metadata: Object.prototype.hasOwnProperty.call(remote, 'metadata')
                ? (remote.metadata ?? undefined)
                : local?.metadata,
              archived: remote.is_archived,
              order: remote.order_index,
              isQuantitative: remote.is_quantitative,
              targetValue: remote.target_value,
              unit: remote.unit,
              generationCounter: remote.generation_counter || 1,
              createdAt: remote.created_at || remote.updated_at || new Date().toISOString(),
              updatedAt: remote.updated_at,
              isDirty: false
            });
            pulledCount++;
          }
        }
      });
    }

    return { pushed: pushedCount, pulled: pulledCount, status: 'success' };
  }
}

export class CompletionsSyncEngine implements ISynchronizer {
  public domainName = 'completions';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    // 1. Bulk push dirty completions
    const dirtyLocalCompletions = await db.completions
      .where('userId')
      .equals(userId)
      .filter((c: any) => c.isDirty === true || c.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalCompletions.length; i += BATCH_SIZE) {
      const batch = dirtyLocalCompletions.slice(i, i + BATCH_SIZE);
      const payload = batch.map((c) => ({
        id: c.id,
        user_id: userId,
        habit_id: c.habitId,
        date: c.date,
        completed: c.completed,
        status: c.status || (c.skipped ? 'rest' : c.completed ? 'completed' : null),
        skipped: c.skipped ?? (c.status === 'rest'),
        rest_reason: c.restReason || null,
        notes: c.note || null,
        value: c.value || 0,
        generation_counter: c.generationCounter || 1,
        updated_at: new Date().toISOString()
      }));

      const { error } = await upsertRowsWithColumnFallback(
        this.supabase,
        'completions',
        payload,
        { onConflict: 'habit_id,date' }
      );

      if (error) {
        throw new Error(`[CompletionsSyncEngine Bulk Push Failure]: ${error.message}`);
      }

      await db.transaction('rw', db.completions, async () => {
        const ids = batch.map((b) => b.id);
        await Promise.all(ids.map(id => db.completions.update(id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    // 2. Pull remote updates
    const latestLocalCompletion = await db.completions.where('userId').equals(userId).sortBy('updatedAt');
    let lastPushedTimestamp = latestLocalCompletion.length > 0 
      ? latestLocalCompletion[latestLocalCompletion.length - 1].updatedAt 
      : null;
    if (!lastPushedTimestamp || lastPushedTimestamp === 'undefined') {
      lastPushedTimestamp = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: remoteData, error: pullError } = await (this.supabase
      .from('completions') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastPushedTimestamp);

    if (pullError) throw new Error(`[CompletionsSyncEngine Pull Failure]: ${pullError.message}`);

    let pulledCount = 0;
    if (remoteData && remoteData.length > 0) {
      await db.transaction('rw', db.completions, async () => {
        for (const remote of remoteData) {
          const local = await db.completions.get(remote.id);
          
          if (!local || (remote.generation_counter || 0) > (local.generationCounter || 0)) {
            const isRest =
              remote.status === 'rest' ||
              remote.skipped === true ||
              Boolean(remote.rest_reason) ||
              /^rest day\b/i.test(String(remote.notes || ''));
            await db.completions.put({
              id: remote.id,
              userId: remote.user_id,
              habitId: remote.habit_id,
              date: remote.date,
              completed: isRest ? false : remote.completed,
              status: remote.status || (isRest ? 'rest' : remote.completed ? 'completed' : undefined),
              skipped: isRest,
              restReason: Object.prototype.hasOwnProperty.call(remote, 'rest_reason')
                ? (remote.rest_reason ?? undefined)
                : local?.restReason || (isRest ? 'Low-Energy Day' : undefined),
              note: remote.notes || undefined,
              value: remote.value || 0,
              generationCounter: remote.generation_counter || 1,
              updatedAt: remote.updated_at,
              isDirty: false
            });
            pulledCount++;
          }
        }
      });
    }

    return { pushed: pushedCount, pulled: pulledCount, status: 'success' };
  }
}

// Keep legacy wrapper exports for existing components and tests
export async function syncHabitsWithRetry(engine: any) {
  const habitsSync = new HabitsSyncEngine();
  return habitsSync.sync(engine.userId);
}

export async function syncCompletionsWithRetry(engine: any) {
  const completionsSync = new CompletionsSyncEngine();
  return completionsSync.sync(engine.userId);
}

export async function pushHabitToRemote(engine: any, habit: Habit) {
  const supabase = getSupabaseClient();
  const payload = {
    id: habit.id,
    user_id: engine.userId,
    name: habit.name,
    icon: habit.icon || '✓',
    category: habit.category,
    target_days: habit.targetDaysPerWeek,
    frequency_type: habit.frequencyType || (habit.targetDaysPerWeek < 7 ? 'weekly_flexible' : 'daily'),
    scheduled_days: habit.scheduledDays || null,
    interval_days: habit.intervalDays || null,
    allow_bonus_completions: habit.allowBonusCompletions ?? true,
    auto_track_rule: habit.autoTrackRule || null,
    polarity: habit.polarity || 'build',
    anchor_block: habit.anchorBlock || null,
    metadata: habit.metadata || null,
    is_archived: habit.archived,
    order_index: habit.order,
    is_quantitative: habit.isQuantitative || false,
    target_value: habit.targetValue || 0,
    unit: habit.unit || '',
    generation_counter: habit.generationCounter || 1,
    updated_at: new Date().toISOString()
  };
  const { error } = await upsertRowsWithColumnFallback(supabase, 'habits', payload, {
    onConflict: 'id',
  });
  if (error) {
    logger.warn('[HabitsSyncEngine] pushHabitToRemote fallback:', error.message);
    await (supabase.from('habits') as any).upsert({
      id: habit.id,
      user_id: engine.userId,
      name: habit.name,
      icon: habit.icon || '✓',
      category: habit.category,
      target_days: habit.targetDaysPerWeek,
      is_archived: habit.archived,
      order_index: habit.order,
      is_quantitative: habit.isQuantitative || false,
      target_value: habit.targetValue || 0,
      unit: habit.unit || '',
      generation_counter: habit.generationCounter || 1,
      updated_at: new Date().toISOString()
    });
  }
}
