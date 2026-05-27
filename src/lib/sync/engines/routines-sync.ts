import { db } from '@/lib/db';
import { resolveConflict } from '../conflict-resolution';
import { logger } from '@/lib/logger';

export async function syncRoutinesWithRetry(engine: any) {
  return engine.withRetry(() => syncRoutines(engine), 'Routines sync');
}

export async function syncRoutines(engine: any) {
  if (!engine.userId) return;

  if (engine.routineSyncLock) {
    logger.warn('[SyncEngine] Routine sync already running, skipping');
    return;
  }

  engine.routineSyncLock = true;
  try {
    return await syncRoutinesImpl(engine);
  } finally {
    engine.routineSyncLock = false;
  }
}

export async function syncRoutinesImpl(engine: any) {
  if (!engine.userId) return;

  logger.info('[SyncEngine] 🔄 Starting routine sync...');

  const { data: remoteRoutines, error } = await engine.supabase
    .from('routines')
    .select('*')
    .eq('user_id', engine.userId);

  if (error) throw error;

  const localRoutines = await db.routines.where('userId').equals(engine.userId).toArray();

  logger.info(`[SyncEngine] 📊 Routine counts: Local=${localRoutines.length}, Remote=${remoteRoutines?.length || 0}`);

  const remoteById = new Map((remoteRoutines || []).map((r: any) => [r.id, r]));
  const localById = new Map(localRoutines.map(r => [r.id, r]));

  const processedRemoteIds = new Set<string>();

  for (const local of localRoutines) {
    const remote = remoteById.get(local.id) as any;

    if (remote) {
      processedRemoteIds.add(remote.id);

      const resolution = resolveConflict(
        { ...local, updatedAt: local.updatedAt || local.createdAt },
        { ...remote, updated_at: remote.updated_at },
        {}
      );

      if (resolution.winner === 'local') {
        await pushRoutineToRemote(engine, local);
      } else if (resolution.winner === 'remote') {
        await updateLocalRoutine(engine, remote);
      }
    } else {
      await pushRoutineToRemote(engine, local);
    }
  }

  for (const remote of (remoteRoutines || []) as any[]) {
    if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
      await updateLocalRoutine(engine, remote);
    }
  }
}

async function pushRoutineToRemote(engine: any, routine: any) {
  if (!engine.userId) return;

  const { error } = await engine.supabase.from('routines').upsert({
    id: routine.id,
    user_id: engine.userId,
    title: routine.title,
    description: routine.description,
    trigger_type: routine.triggerType || 'manual',
    trigger_value: routine.triggerValue || null,
    is_active: routine.isActive,
    order_index: routine.orderIndex || 0,
    created_at: routine.createdAt,
    updated_at: routine.updatedAt || routine.createdAt,
  } as any);

  if (error) throw error;
}

async function updateLocalRoutine(engine: any, remote: any) {
  await db.routines.put({
    id: remote.id,
    userId: engine.userId || remote.user_id,
    title: remote.title,
    description: remote.description,
    triggerType: remote.trigger_type,
    triggerValue: remote.trigger_value,
    isActive: remote.is_active,
    orderIndex: remote.order_index,
    createdAt: remote.created_at,
    updatedAt: remote.updated_at,
  });
}

// ===================
// HABIT ROUTINES SYNC
// ===================

export async function syncHabitRoutinesWithRetry(engine: any) {
  return engine.withRetry(() => syncHabitRoutines(engine), 'Habit-routines sync');
}

export async function syncHabitRoutines(engine: any) {
  if (!engine.userId) return;

  if (engine.habitRoutineSyncLock) {
    logger.warn('[SyncEngine] Habit-routines sync already running, skipping');
    return;
  }

  engine.habitRoutineSyncLock = true;
  try {
    return await syncHabitRoutinesImpl(engine);
  } finally {
    engine.habitRoutineSyncLock = false;
  }
}

export async function syncHabitRoutinesImpl(engine: any) {
  if (!engine.userId) return;

  logger.info('[SyncEngine] 🔄 Starting habit-routines junction sync...');

  // Note: habit_routines table doesn't have a user_id column.
  // RLS scopes selecting from this table to the authenticated user's own habits,
  // so we select all available records from habit_routines (which Postgres filters for us).
  const { data: remoteLinks, error } = await engine.supabase
    .from('habit_routines')
    .select('*');

  if (error) throw error;

  // Retrieve user habits to filter local habitRoutines links
  const habits = await db.habits.where('userId').equals(engine.userId).toArray();
  const habitIds = habits.map(h => h.id);
  const localLinks = habitIds.length > 0
    ? await db.habitRoutines.where('habitId').anyOf(habitIds).toArray()
    : [];

  logger.info(`[SyncEngine] 📊 Habit-routines junction count: Local=${localLinks.length}, Remote=${remoteLinks?.length || 0}`);

  const remoteById = new Map((remoteLinks || []).map((l: any) => [l.id, l]));
  const localById = new Map(localLinks.map(l => [l.id, l]));

  const processedRemoteIds = new Set<string>();

  for (const local of localLinks) {
    const remote = remoteById.get(local.id) as any;

    if (remote) {
      processedRemoteIds.add(remote.id);

      const resolution = resolveConflict(
        { ...local, updatedAt: local.updatedAt || local.createdAt },
        { ...remote, updated_at: remote.updated_at },
        {}
      );

      if (resolution.winner === 'local') {
        await pushHabitRoutineToRemote(engine, local);
      } else if (resolution.winner === 'remote') {
        await updateLocalHabitRoutine(engine, remote);
      }
    } else {
      await pushHabitRoutineToRemote(engine, local);
    }
  }

  for (const remote of (remoteLinks || []) as any[]) {
    // Make sure the remote link's habit belongs to the user before adding it locally
    if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id) && habitIds.includes(remote.habit_id)) {
      await updateLocalHabitRoutine(engine, remote);
    }
  }
}

async function pushHabitRoutineToRemote(engine: any, link: any) {
  if (!engine.userId) return;

  // Note: user_id is omitted as habit_routines has no user_id column
  const { error } = await engine.supabase.from('habit_routines').upsert({
    id: link.id,
    habit_id: link.habitId,
    routine_id: link.routineId,
    order_index: link.orderIndex || 0,
    created_at: link.createdAt,
    updated_at: link.updatedAt || link.createdAt,
  } as any);

  if (error) throw error;
}

async function updateLocalHabitRoutine(engine: any, remote: any) {
  await db.habitRoutines.put({
    id: remote.id,
    habitId: remote.habit_id,
    routineId: remote.routine_id,
    orderIndex: remote.order_index,
    createdAt: remote.created_at,
    updatedAt: remote.updated_at,
  });
}

// ==================
// ROUTINE COMPLETIONS SYNC
// ==================

export async function syncRoutineCompletions(engine: any) {
  if (!engine.userId) return;

  logger.info('[SyncEngine] 🔄 Starting routine completions sync...');

  const { data: remoteCompletions, error } = await engine.supabase
    .from('routine_completions')
    .select('*')
    .eq('user_id', engine.userId);

  if (error) throw error;

  const localCompletions = await db.routineCompletions.where('userId').equals(engine.userId).toArray();
  const remoteById = new Map((remoteCompletions || []).map((c: any) => [c.id, c]));
  const localById = new Map(localCompletions.map(c => [c.id, c]));

  const toInsertRemote: any[] = [];
  for (const local of localCompletions) {
    if (!remoteById.has(local.id)) {
      toInsertRemote.push({
        id: local.id,
        user_id: engine.userId,
        routine_id: local.routineId,
        date: local.date,
        completed: local.completed,
        completed_at: local.completedAt,
        notes: local.notes,
        created_at: local.createdAt,
        updated_at: local.updatedAt,
      });
    } else {
      const remote = remoteById.get(local.id) as any;
      const resolution = resolveConflict(
        { ...local, updatedAt: local.updatedAt },
        { ...remote, updated_at: remote.updated_at },
        { preferCompleted: true }
      );

      if (resolution.winner === 'local') {
        await pushRoutineCompletionToRemote(engine, local);
      } else if (resolution.winner === 'remote') {
        await updateLocalRoutineCompletion(engine, remote);
      }
    }
  }

  if (toInsertRemote.length > 0) {
    await engine.batchUpsert('routine_completions', toInsertRemote);
  }

  for (const remote of (remoteCompletions || []) as any[]) {
    if (!localById.has(remote.id)) {
      await updateLocalRoutineCompletion(engine, remote);
    }
  }
}

async function pushRoutineCompletionToRemote(engine: any, completion: any) {
  if (!engine.userId) return;

  await engine.supabase.from('routine_completions').upsert({
    id: completion.id,
    user_id: engine.userId,
    routine_id: completion.routineId,
    date: completion.date,
    completed: completion.completed,
    completed_at: completion.completedAt,
    notes: completion.notes,
    created_at: completion.createdAt,
    updated_at: completion.updatedAt,
  } as any);
}

async function updateLocalRoutineCompletion(engine: any, remote: any) {
  await db.routineCompletions.put({
    id: remote.id,
    userId: engine.userId!,
    routineId: remote.routine_id,
    date: remote.date,
    completed: remote.completed,
    completedAt: remote.completed_at,
    notes: remote.notes,
    createdAt: remote.created_at,
    updatedAt: remote.updated_at,
  });
}
