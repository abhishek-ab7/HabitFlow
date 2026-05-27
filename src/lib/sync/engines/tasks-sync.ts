import { db } from '@/lib/db';
import { resolveConflict } from '../conflict-resolution';
import { logger } from '@/lib/logger';

export async function syncTasksWithRetry(engine: any) {
  return engine.withRetry(() => syncTasks(engine), 'Tasks sync');
}

export async function syncTasks(engine: any) {
  if (!engine.userId) return;

  if (engine.taskSyncLock) {
    logger.warn('[SyncEngine] Task sync already running, skipping');
    return;
  }

  engine.taskSyncLock = true;
  try {
    return await syncTasksImpl(engine);
  } finally {
    engine.taskSyncLock = false;
  }
}

export async function syncTasksImpl(engine: any) {
  if (!engine.userId) return;

  logger.info('[SyncEngine] 🔄 Syncing tasks from Supabase...');

  // 1. Fetch remote goals to verify task.goal_id foreign key references
  const { data: remoteGoals, error: goalsError } = await engine.supabase
    .from('goals')
    .select('id')
    .eq('user_id', engine.userId);
  if (goalsError) throw goalsError;
  const remoteGoalIds = new Set((remoteGoals || []).map((g: any) => g.id));

  // 2. Fetch remote tasks
  const { data: remoteTasks, error } = await engine.supabase
    .from('tasks')
    .select('*')
    .eq('user_id', engine.userId);

  if (error) throw error;

  const localTasks = await db.tasks.where('userId').equals(engine.userId).toArray();
  const remoteById = new Map((remoteTasks || []).map((t: any) => [t.id, t]));
  const localById = new Map(localTasks.map(t => [t.id, t]));

  const sortedLocalTasks = [...localTasks].sort((a, b) => (a.depth || 0) - (b.depth || 0));
  const remoteTaskIds = new Set((remoteTasks || []).map((t: any) => t.id));
  const localTaskIds = new Set(localTasks.map(t => t.id));

  const toInsertRemote: any[] = [];
  for (const local of sortedLocalTasks) {
    const remote = remoteById.get(local.id) as any;

    const syncedGoalId = local.goal_id && remoteGoalIds.has(local.goal_id) ? local.goal_id : null;
    const hasParent = local.parentTaskId && (localTaskIds.has(local.parentTaskId) || remoteTaskIds.has(local.parentTaskId));
    const syncedParentId = hasParent ? local.parentTaskId : null;
    const syncedDepth = hasParent ? local.depth || 0 : 0;

    if (!remote) {
      const isNewLocal = !engine.lastSyncAt || new Date(local.updated_at || local.created_at || 0) >= engine.lastSyncAt;
      if (!isNewLocal) {
        logger.info(`[SyncEngine] Task "${local.title}" was deleted on remote, deleting locally.`);
        await db.tasks.delete(local.id);
      } else {
        toInsertRemote.push({
          id: local.id,
          user_id: engine.userId,
          title: local.title,
          description: local.description,
          status: local.status,
          priority: local.priority,
          due_date: local.due_date,
          goal_id: syncedGoalId,
          parent_task_id: syncedParentId,
          depth: syncedDepth,
          tags: local.tags,
          created_at: local.created_at,
          updated_at: local.updated_at,
        });
      }
    } else {
      const resolution = resolveConflict(
        { ...local, updatedAt: local.updated_at },
        { ...remote, updated_at: remote.updated_at, created_at: remote.created_at },
        { completedStatuses: ['done'] }
      );

      if (resolution.winner === 'local') {
        await engine.supabase.from('tasks').upsert({
          id: local.id,
          user_id: engine.userId,
          title: local.title,
          description: local.description,
          status: local.status,
          priority: local.priority,
          due_date: local.due_date,
          goal_id: syncedGoalId,
          parent_task_id: syncedParentId,
          depth: syncedDepth,
          tags: local.tags,
          created_at: local.created_at,
          updated_at: local.updated_at,
          recurrence_rule: local.recurrenceRule || '',
          estimated_time: local.estimatedTime || 0,
          actual_time: local.actualTime || 0,
          is_urgent: local.isUrgent ?? false,
          is_important: local.isImportant ?? false,
        } as any);
        logger.info(`[SyncEngine] 🔄 Task conflict (${local.title}): ${resolution.reason}`);
      } else if (resolution.winner === 'remote') {
        await updateLocalTask(engine, remote);
        logger.info(`[SyncEngine] 🔄 Task conflict (${local.title}): ${resolution.reason}`);
      }
    }
  }

  if (toInsertRemote.length > 0) {
    await engine.batchUpsert('tasks', toInsertRemote);
  }

  const toUpsertLocal: any[] = [];
  for (const remote of (remoteTasks || []) as any[]) {
    if (!localById.has(remote.id)) {
      toUpsertLocal.push(remote);
    }
  }

  if (toUpsertLocal.length > 0) {
    for (const remote of toUpsertLocal) {
      await updateLocalTask(engine, remote);
    }
  }
}

export async function pushTaskToRemote(engine: any, task: any) {
  if (!engine.userId) return;

  // Verify goal_id exists on remote before pushing
  let syncedGoalId = task.goal_id || null;
  if (syncedGoalId) {
    const { data: remoteGoals } = await engine.supabase
      .from('goals')
      .select('id')
      .eq('user_id', engine.userId);
    const remoteGoalIds = new Set((remoteGoals || []).map((g: any) => g.id));
    if (!remoteGoalIds.has(syncedGoalId)) {
      syncedGoalId = null;
    }
  }

  // Verify parent_task_id exists on remote before pushing
  let syncedParentId = task.parentTaskId || null;
  let syncedDepth = task.depth || 0;
  if (syncedParentId) {
    const { data: remoteTasks } = await engine.supabase
      .from('tasks')
      .select('id')
      .eq('user_id', engine.userId);
    const remoteTaskIds = new Set((remoteTasks || []).map((t: any) => t.id));
    if (!remoteTaskIds.has(syncedParentId)) {
      syncedParentId = null;
      syncedDepth = 0;
    }
  }

  await engine.supabase.from('tasks').upsert({
    id: task.id,
    user_id: engine.userId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    goal_id: syncedGoalId,
    parent_task_id: syncedParentId,
    depth: syncedDepth,
    tags: task.tags,
    created_at: task.created_at,
    updated_at: task.updated_at,
    recurrence_rule: task.recurrenceRule || '',
    estimated_time: task.estimatedTime || 0,
    actual_time: task.actualTime || 0,
    is_urgent: task.isUrgent ?? false,
    is_important: task.isImportant ?? false,
  } as any);
}

export async function updateLocalTask(engine: any, remote: any) {
  await db.tasks.put({
    id: remote.id,
    userId: engine.userId!,
    title: remote.title,
    description: remote.description,
    status: remote.status,
    priority: remote.priority,
    due_date: remote.due_date,
    goal_id: remote.goal_id,
    parentTaskId: remote.parent_task_id || null,
    depth: remote.depth || 0,
    tags: remote.tags || [],
    metadata: {},
    created_at: remote.created_at,
    updated_at: remote.updated_at || remote.created_at,
    recurrenceRule: remote.recurrence_rule || '',
    estimatedTime: remote.estimated_time || 0,
    actualTime: remote.actual_time || 0,
    isUrgent: remote.is_urgent ?? false,
    isImportant: remote.is_important ?? false,
  });
}
