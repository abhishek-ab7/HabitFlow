import { db } from '@/lib/db';
import { resolveConflict } from '../conflict-resolution';
import { logger } from '@/lib/logger';
import type { Goal, Milestone } from '@/lib/types';

export async function syncGoalsWithRetry(engine: any) {
  return engine.withRetry(() => syncGoals(engine), 'Goals sync');
}

export async function syncGoals(engine: any) {
  if (!engine.userId) return;

  if (engine.goalSyncLock) {
    logger.warn('[SyncEngine] Goal sync already running, skipping');
    return;
  }

  engine.goalSyncLock = true;
  try {
    return await syncGoalsImpl(engine);
  } finally {
    engine.goalSyncLock = false;
  }
}

export async function syncGoalsImpl(engine: any) {
  if (!engine.userId) return;

  logger.info('[SyncEngine] 🔄 Syncing goals from Supabase...');

  const { data: remoteGoals, error } = await engine.supabase
    .from('goals')
    .select('*')
    .eq('user_id', engine.userId);

  if (error) throw error;

  const localGoals = await db.goals.where('userId').equals(engine.userId).toArray();

  const remoteById = new Map((remoteGoals || []).map((g: any) => [g.id, g]));
  const remoteByTitle = new Map(
    (remoteGoals || []).map((g: any) => [g.title.toLowerCase(), g])
  );
  const localById = new Map(localGoals.map(g => [g.id, g]));
  const processedRemoteIds = new Set<string>();

  for (const local of localGoals) {
    const remoteById_ = remoteById.get(local.id) as any;
    const remoteByTitle_ = remoteByTitle.get(local.title.toLowerCase()) as any;

    if (remoteById_) {
      processedRemoteIds.add(remoteById_.id);

      const resolution = resolveConflict(
        { ...local, updatedAt: local.updatedAt || local.createdAt },
        { ...remoteById_ },
        { completedStatuses: ['completed'] }
      );

      if (resolution.winner === 'local') {
        await pushGoalToRemote(engine, local);
        logger.info(`[SyncEngine] 🔄 Goal conflict (${local.title}): ${resolution.reason}`);
      } else if (resolution.winner === 'remote') {
        await updateLocalGoal(engine, remoteById_);
        logger.info(`[SyncEngine] 🔄 Goal conflict (${local.title}): ${resolution.reason}`);
      }
    } else if (remoteByTitle_ && remoteByTitle_.id !== local.id) {
      processedRemoteIds.add(remoteByTitle_.id);
      await mergeGoalToRemote(engine, local, remoteByTitle_);
    } else {
      const isNewLocal = !engine.lastSyncAt || new Date(local.updatedAt || local.createdAt || 0) >= engine.lastSyncAt;
      if (!isNewLocal) {
        logger.info(`[SyncEngine] Goal "${local.title}" was deleted on remote, deleting locally.`);
        await db.goals.delete(local.id);
        await db.milestones.where('goalId').equals(local.id).delete();
      } else {
        await pushGoalToRemote(engine, local);
        processedRemoteIds.add(local.id);
      }
    }
  }

  for (const remote of (remoteGoals || []) as any[]) {
    if (!processedRemoteIds.has(remote.id) && !localById.has(remote.id) && !remote.is_archived) {
      await updateLocalGoal(engine, remote);
    }
  }
}

export async function pushGoalToRemote(engine: any, goal: Goal) {
  if (!engine.userId) return;

  await engine.supabase.from('goals').upsert({
    id: goal.id,
    user_id: engine.userId,
    title: goal.title,
    description: goal.description || null,
    category: goal.areaOfLife,
    priority: goal.priority,
    status: goal.status,
    target_date: goal.deadline,
    progress: 0,
    is_focus: goal.isFocus,
    is_archived: goal.archived,
    updated_at: new Date().toISOString(),
  } as any);
}

export async function updateLocalGoal(engine: any, remote: any) {
  const localGoal: Goal = {
    id: remote.id,
    userId: engine.userId || remote.user_id,
    title: remote.title,
    description: remote.description || undefined,
    areaOfLife: remote.category,
    priority: remote.priority || 'medium',
    status: remote.status || 'not_started',
    deadline: remote.target_date,
    isFocus: remote.is_focus || false,
    archived: remote.is_archived || false,
    createdAt: remote.created_at,
    startDate: remote.created_at,
  };

  await db.goals.put(localGoal);
}

export async function mergeGoalToRemote(engine: any, local: Goal, remote: any) {
  logger.info(`[SyncEngine] Merging duplicate goal: "${local.title}" (local: ${local.id}, remote: ${remote.id})`);

  const milestones = await db.milestones
    .where('goalId')
    .equals(local.id)
    .toArray();

  for (const milestone of milestones) {
    await db.milestones.update(milestone.id, { goalId: remote.id });

    if (engine.userId) {
      await engine.supabase.from('milestones').upsert({
        id: milestone.id,
        user_id: engine.userId,
        goal_id: remote.id,
        title: milestone.title,
        is_completed: milestone.completed,
        completed_at: milestone.completedAt,
        order_index: milestone.order,
      } as any);
    }
  }

  await db.goals.delete(local.id);
  await updateLocalGoal(engine, remote);
}
