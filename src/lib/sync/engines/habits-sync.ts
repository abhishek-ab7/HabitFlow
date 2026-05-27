import { db } from '@/lib/db';
import { resolveConflict } from '../conflict-resolution';
import { logger } from '@/lib/logger';
import type { Habit, HabitCompletion } from '@/lib/types';

export async function syncHabitsWithRetry(engine: any) {
  return engine.withRetry(() => syncHabits(engine), 'Habits sync');
}

export async function syncHabits(engine: any) {
  if (!engine.userId) return;

  if (engine.habitSyncLock) {
    logger.warn('[SyncEngine] Habit sync already running, skipping');
    return;
  }

  engine.habitSyncLock = true;
  try {
    return await syncHabitsImpl(engine);
  } finally {
    engine.habitSyncLock = false;
  }
}

export async function syncHabitsImpl(engine: any) {
  if (!engine.userId) return;

  logger.info('[SyncEngine] 🔄 Starting habit sync...');

  // Pull ALL habits from Supabase
  const { data: remoteHabits, error } = await engine.supabase
    .from('habits')
    .select('*')
    .eq('user_id', engine.userId);

  if (error) throw error;

  const localHabits = await db.habits.where('userId').equals(engine.userId).toArray();

  logger.info(`[SyncEngine] 📊 Habit counts: Local=${localHabits.length}, Remote=${remoteHabits?.length || 0}`);

  const remoteById = new Map((remoteHabits || []).map((h: any) => [h.id, h]));
  const remoteByKey = new Map(
    (remoteHabits || []).map((h: any) => [`${h.name.toLowerCase()}-${h.category}`, h])
  );
  const localById = new Map(localHabits.map(h => [h.id, h]));

  const processedRemoteIds = new Set<string>();

  for (const local of localHabits) {
    const remoteById_ = remoteById.get(local.id) as any;
    const habitKey = `${local.name.toLowerCase()}-${local.category}`;
    const remoteByKey_ = remoteByKey.get(habitKey) as any;

    if (remoteById_) {
      processedRemoteIds.add(remoteById_.id);

      const resolution = resolveConflict(
        { ...local, updatedAt: local.updatedAt || local.createdAt },
        { ...remoteById_, updated_at: remoteById_.updated_at, created_at: remoteById_.created_at },
        {}
      );

      if (resolution.winner === 'local') {
        await pushHabitToRemote(engine, local);
        logger.info(`[SyncEngine] 🔄 Habit conflict (${local.name}): ${resolution.reason}`);
      } else if (resolution.winner === 'remote') {
        await updateLocalHabit(engine, remoteById_);
        logger.info(`[SyncEngine] 🔄 Habit conflict (${local.name}): ${resolution.reason}`);
      }
    } else if (remoteByKey_ && remoteByKey_.id !== local.id) {
      processedRemoteIds.add(remoteByKey_.id);
      await mergeHabitToRemote(engine, local, remoteByKey_);
    } else {
      await pushHabitToRemote(engine, local);
    }
  }

  for (const remote of (remoteHabits || []) as any[]) {
    if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
      await updateLocalHabit(engine, remote);
    }
  }

  await cleanupOldArchivedHabits(engine);
}

async function cleanupOldArchivedHabits(engine: any) {
  if (!engine.userId) return;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const oldArchivedHabits = await db.habits
      .where('archived')
      .equals(1)
      .and(h => {
        if (!h.archivedAt) return false;
        return new Date(h.archivedAt) < thirtyDaysAgo;
      })
      .toArray();

    if (oldArchivedHabits.length === 0) return;

    const habitIds = oldArchivedHabits.map(h => h.id);
    await db.habits.bulkDelete(habitIds);

    await engine.supabase
      .from('habits')
      .delete()
      .in('id', habitIds)
      .eq('user_id', engine.userId);

    await db.completions.where('habitId').anyOf(habitIds).delete();
    await engine.supabase
      .from('completions')
      .delete()
      .in('habit_id', habitIds)
      .eq('user_id', engine.userId);

    logger.info(`[SyncEngine] Cleaned up ${habitIds.length} old archived habits`);
  } catch (error) {
    logger.error('[SyncEngine] Error cleaning up old archived habits:', error);
  }
}

export async function pushHabitToRemote(engine: any, habit: Habit) {
  if (!engine.userId) return;

  const { error } = await engine.supabase.from('habits').upsert({
    id: habit.id,
    user_id: engine.userId,
    name: habit.name,
    description: null,
    icon: habit.icon || '✓',
    color: '#6366f1',
    category: habit.category,
    frequency: { type: 'daily', days: [0, 1, 2, 3, 4, 5, 6] },
    target_days: habit.targetDaysPerWeek,
    reminder_time: null,
    is_archived: habit.archived,
    order_index: habit.order,
    updated_at: habit.updatedAt || habit.createdAt,
    is_quantitative: habit.isQuantitative || false,
    target_value: habit.targetValue || 0,
    unit: habit.unit || '',
    difficulty: habit.difficulty || 'medium',
  } as any);

  if (error) throw error;
}

export async function updateLocalHabit(engine: any, remote: any) {
  const localHabit: Habit = {
    id: remote.id,
    userId: engine.userId || remote.user_id,
    name: remote.name,
    icon: remote.icon || '✓',
    category: remote.category,
    targetDaysPerWeek: remote.target_days || 7,
    archived: Boolean(remote.is_archived),
    archivedAt: remote.archived_at || undefined,
    updatedAt: remote.updated_at || remote.created_at,
    order: remote.order_index || 0,
    createdAt: remote.created_at,
    isQuantitative: Boolean(remote.is_quantitative),
    targetValue: remote.target_value || 0,
    unit: remote.unit || '',
    difficulty: remote.difficulty || 'medium',
  };

  await db.habits.put(localHabit);
}

export async function mergeHabitToRemote(engine: any, local: Habit, remote: any) {
  logger.info(`[SyncEngine] Merging duplicate habit: "${local.name}" (local: ${local.id}, remote: ${remote.id})`);

  const completions = await db.completions
    .where('habitId')
    .equals(local.id)
    .toArray();

  for (const completion of completions) {
    const existing = await db.completions
      .where('[habitId+date]')
      .equals([remote.id, completion.date])
      .first();

    if (!existing) {
      await db.completions.update(completion.id, { habitId: remote.id });

      if (engine.userId) {
        await engine.supabase.from('completions').upsert({
          id: completion.id,
          user_id: engine.userId,
          habit_id: remote.id,
          date: completion.date,
          completed: completion.completed,
          notes: completion.note || null,
          value: completion.value || 0,
        } as any);
      }
    } else {
      await db.completions.delete(completion.id);
    }
  }

  await db.habits.delete(local.id);
  await updateLocalHabit(engine, remote);
}

// ===================
// COMPLETIONS SYNC
// ===================

export async function syncCompletionsWithRetry(engine: any) {
  return engine.withRetry(() => syncCompletions(engine), 'Completions sync');
}

export async function syncCompletions(engine: any) {
  if (!engine.userId) return;

  if (engine.completionSyncLock) {
    logger.warn('[SyncEngine] Completion sync already running, skipping');
    return;
  }

  engine.completionSyncLock = true;
  try {
    return await syncCompletionsImpl(engine);
  } finally {
    engine.completionSyncLock = false;
  }
}

export async function syncCompletionsImpl(engine: any) {
  if (!engine.userId) return;

  logger.info('[SyncEngine] 🔄 Starting completions sync...');

  const startDate = engine.getStartDate();

  const { data: remoteCompletions, error } = await engine.supabase
    .from('completions')
    .select('*')
    .eq('user_id', engine.userId)
    .gte('date', startDate);

  if (error) throw error;

  const localCompletions = await db.completions
    .where('date')
    .aboveOrEqual(startDate)
    .toArray();

  logger.info(`[SyncEngine] 📊 Completion counts: Local=${localCompletions.length}, Remote=${remoteCompletions?.length || 0}`);

  const remoteById = new Map((remoteCompletions || []).map((c: any) => [c.id, c]));
  const remoteByKey = new Map(
    (remoteCompletions || []).map((c: any) => [`${c.habit_id}-${c.date}`, c])
  );
  const localById = new Map(localCompletions.map(c => [c.id, c]));

  const processedRemoteIds = new Set<string>();

  for (const local of localCompletions) {
    const remoteById_ = remoteById.get(local.id) as any;
    const completionKey = `${local.habitId}-${local.date}`;
    const remoteByKey_ = remoteByKey.get(completionKey) as any;

    if (remoteById_) {
      processedRemoteIds.add(remoteById_.id);

      const resolution = resolveConflict(
        { ...local, updatedAt: local.createdAt },
        { ...remoteById_, updated_at: remoteById_.created_at },
        { preferCompleted: true }
      );

      if (resolution.winner === 'local') {
        await pushCompletionToRemote(engine, local);
      } else if (resolution.winner === 'remote') {
        await updateLocalCompletion(engine, remoteById_);
      }
    } else if (remoteByKey_ && remoteByKey_.id !== local.id) {
      processedRemoteIds.add(remoteByKey_.id);
      await mergeCompletionToRemote(engine, local, remoteByKey_);
    } else {
      await pushCompletionToRemote(engine, local);
    }
  }

  for (const remote of (remoteCompletions || []) as any[]) {
    if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
      await updateLocalCompletion(engine, remote);
    }
  }
}

async function pushCompletionToRemote(engine: any, completion: HabitCompletion) {
  if (!engine.userId) return;

  const { error } = await engine.supabase.from('completions').upsert({
    id: completion.id,
    user_id: engine.userId,
    habit_id: completion.habitId,
    date: completion.date,
    completed: completion.completed,
    notes: completion.note || null,
    value: completion.value || 0,
  } as any);

  if (error) throw error;
}

async function updateLocalCompletion(engine: any, remote: any) {
  const localCompletion: HabitCompletion = {
    id: remote.id,
    userId: engine.userId!,
    habitId: remote.habit_id,
    date: remote.date,
    completed: Boolean(remote.completed),
    note: remote.notes || undefined,
    value: remote.value || 0,
  };

  await db.completions.put(localCompletion);
}

async function mergeCompletionToRemote(engine: any, local: HabitCompletion, remote: any) {
  logger.info(`[SyncEngine] Merging duplicate completion: local ${local.id}, remote ${remote.id}`);
  await db.completions.delete(local.id);
  await updateLocalCompletion(engine, remote);
}

// ===================
// ROUTINES SYNC
// ===================

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

  const { data: remoteLinks, error } = await engine.supabase
    .from('habit_routines')
    .select('*')
    .eq('user_id', engine.userId);

  if (error) throw error;

  const localLinks = await db.habitRoutines.where('userId').equals(engine.userId).toArray();

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
    if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id)) {
      await updateLocalHabitRoutine(engine, remote);
    }
  }
}

async function pushHabitRoutineToRemote(engine: any, link: any) {
  if (!engine.userId) return;

  const { error } = await engine.supabase.from('habit_routines').upsert({
    id: link.id,
    user_id: engine.userId,
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
