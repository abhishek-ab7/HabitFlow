import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { ISynchronizer } from '../types';

export class RoutinesSyncEngine implements ISynchronizer {
  public domainName = 'routines';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    // 1. Bulk push dirty routines
    const dirtyLocalRoutines = await db.routines
      .where('userId')
      .equals(userId)
      .filter((r: any) => r.isDirty === true || r.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalRoutines.length; i += BATCH_SIZE) {
      const batch = dirtyLocalRoutines.slice(i, i + BATCH_SIZE);
      const payload = batch.map((r) => ({
        id: r.id,
        user_id: userId,
        title: r.title,
        description: r.description || null,
        trigger_type: r.triggerType || 'manual',
        trigger_value: r.triggerValue || null,
        is_active: r.isActive,
        order_index: r.orderIndex || 0,
        generation_counter: r.generationCounter || 1,
        created_at: r.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await (this.supabase
        .from('routines') as any)
        .upsert(payload, { onConflict: 'id' });

      if (error) throw new Error(`[RoutinesSyncEngine Bulk Push Failure]: ${error.message}`);

      await db.transaction('rw', db.routines, async () => {
        const ids = batch.map((b) => b.id);
        await Promise.all(ids.map(id => db.routines.update(id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    // 2. Pull remote updates
    const latestLocalRoutine = await db.routines.where('userId').equals(userId).sortBy('updatedAt');
    let lastPushedTimestamp = latestLocalRoutine.length > 0 
      ? latestLocalRoutine[latestLocalRoutine.length - 1].updatedAt 
      : null;
    if (!lastPushedTimestamp || lastPushedTimestamp === 'undefined') {
      lastPushedTimestamp = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: remoteData, error: pullError } = await (this.supabase
      .from('routines') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastPushedTimestamp);

    if (pullError) throw new Error(`[RoutinesSyncEngine Pull Failure]: ${pullError.message}`);

    let pulledCount = 0;
    if (remoteData && remoteData.length > 0) {
      await db.transaction('rw', db.routines, async () => {
        for (const remote of remoteData) {
          const local = await db.routines.get(remote.id);
          
          if (!local || (remote.generation_counter || 0) > (local.generationCounter || 0)) {
            await db.routines.put({
              id: remote.id,
              userId: remote.user_id,
              title: remote.title,
              description: remote.description || undefined,
              triggerType: remote.trigger_type || 'manual',
              triggerValue: remote.trigger_value || undefined,
              isActive: remote.is_active || false,
              orderIndex: remote.order_index || 0,
              generationCounter: remote.generation_counter || 1,
              createdAt: remote.created_at,
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

export class HabitRoutinesSyncEngine implements ISynchronizer {
  public domainName = 'habit_routines';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    // 1. Fetch habits and link dirty habit_routines
    const habits = await db.habits.where('userId').equals(userId).toArray();
    const habitIds = habits.map(h => h.id);
    
    const dirtyLocalLinks = habitIds.length > 0
      ? await db.habitRoutines
          .where('habitId')
          .anyOf(habitIds)
          .filter((l: any) => l.isDirty === true || l.isDirty === 1)
          .toArray()
      : [];

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalLinks.length; i += BATCH_SIZE) {
      const batch = dirtyLocalLinks.slice(i, i + BATCH_SIZE);
      const payload = batch.map((l) => ({
        id: l.id,
        habit_id: l.habitId,
        routine_id: l.routineId,
        order_index: l.orderIndex || 0,
        generation_counter: l.generationCounter || 1,
        created_at: l.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await (this.supabase
        .from('habit_routines') as any)
        .upsert(payload, { onConflict: 'habit_id,routine_id' });

      if (error) throw new Error(`[HabitRoutinesSyncEngine Bulk Push Failure]: ${error.message}`);

      await db.transaction('rw', db.habitRoutines, async () => {
        const ids = batch.map((b) => b.id);
        await Promise.all(ids.map(id => db.habitRoutines.update(id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    // 2. Pull remote updates
    const latestLocalLink = habitIds.length > 0 
      ? await db.habitRoutines.where('habitId').anyOf(habitIds).sortBy('updatedAt')
      : [];
    let lastPushedTimestamp = latestLocalLink.length > 0 
      ? latestLocalLink[latestLocalLink.length - 1].updatedAt 
      : null;
    if (!lastPushedTimestamp || lastPushedTimestamp === 'undefined') {
      lastPushedTimestamp = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: remoteData, error: pullError } = await (this.supabase
      .from('habit_routines') as any)
      .select('*')
      .gt('updated_at', lastPushedTimestamp);

    if (pullError) throw new Error(`[HabitRoutinesSyncEngine Pull Failure]: ${pullError.message}`);

    let pulledCount = 0;
    if (remoteData && remoteData.length > 0) {
      await db.transaction('rw', db.habitRoutines, async () => {
        for (const remote of remoteData) {
          const local = await db.habitRoutines.get(remote.id);
          
          if (!local || (remote.generation_counter || 0) > (local.generationCounter || 0)) {
            await db.habitRoutines.put({
              id: remote.id,
              habitId: remote.habit_id,
              routineId: remote.routine_id,
              orderIndex: remote.order_index || 0,
              generationCounter: remote.generation_counter || 1,
              createdAt: remote.created_at,
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

export class RoutineCompletionsSyncEngine implements ISynchronizer {
  public domainName = 'routine_completions';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    // 1. Bulk push dirty completions
    const dirtyLocalCompletions = await db.routineCompletions
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
        routine_id: c.routineId,
        date: c.date,
        completed: c.completed,
        completed_at: c.completedAt || null,
        notes: c.notes || null,
        generation_counter: c.generationCounter || 1,
        created_at: c.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await (this.supabase
        .from('routine_completions') as any)
        .upsert(payload, { onConflict: 'routine_id,date' });

      if (error) throw new Error(`[RoutineCompletionsSyncEngine Bulk Push Failure]: ${error.message}`);

      await db.transaction('rw', db.routineCompletions, async () => {
        const ids = batch.map((b) => b.id);
        await Promise.all(ids.map(id => db.routineCompletions.update(id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    // 2. Pull remote updates
    const latestLocalCompletion = await db.routineCompletions.where('userId').equals(userId).sortBy('updatedAt');
    let lastPushedTimestamp = latestLocalCompletion.length > 0 
      ? latestLocalCompletion[latestLocalCompletion.length - 1].updatedAt 
      : null;
    if (!lastPushedTimestamp || lastPushedTimestamp === 'undefined') {
      lastPushedTimestamp = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: remoteData, error: pullError } = await (this.supabase
      .from('routine_completions') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastPushedTimestamp);

    if (pullError) throw new Error(`[RoutineCompletionsSyncEngine Pull Failure]: ${pullError.message}`);

    let pulledCount = 0;
    if (remoteData && remoteData.length > 0) {
      await db.transaction('rw', db.routineCompletions, async () => {
        for (const remote of remoteData) {
          const local = await db.routineCompletions.get(remote.id);
          
          if (!local || (remote.generation_counter || 0) > (local.generationCounter || 0)) {
            await db.routineCompletions.put({
              id: remote.id,
              userId: remote.user_id,
              routineId: remote.routine_id,
              date: remote.date,
              completed: remote.completed,
              completedAt: remote.completed_at || undefined,
              notes: remote.notes || undefined,
              generationCounter: remote.generation_counter || 1,
              createdAt: remote.created_at,
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

// Keep legacy wrappers for backward compatibility
export async function syncRoutinesWithRetry(engine: any) {
  const routinesSync = new RoutinesSyncEngine();
  return routinesSync.sync(engine.userId);
}

export async function syncHabitRoutinesWithRetry(engine: any) {
  const habitRoutinesSync = new HabitRoutinesSyncEngine();
  return habitRoutinesSync.sync(engine.userId);
}

export async function syncRoutineCompletions(engine: any) {
  const routineCompletionsSync = new RoutineCompletionsSyncEngine();
  return routineCompletionsSync.sync(engine.userId);
}
