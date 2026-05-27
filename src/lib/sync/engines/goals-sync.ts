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
    } else if (!local.archived) {
      await pushGoalToRemote(engine, local);
      processedRemoteIds.add(local.id);
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

// ===================
// MILESTONES SYNC
// ===================

export async function syncMilestonesWithRetry(engine: any) {
  return engine.withRetry(() => syncMilestones(engine), 'Milestones sync');
}

export async function syncMilestones(engine: any) {
  if (!engine.userId) return;

  if (engine.milestoneSyncLock) {
    logger.warn('[SyncEngine] Milestone sync already running, skipping');
    return;
  }

  engine.milestoneSyncLock = true;
  try {
    return await syncMilestonesImpl(engine);
  } finally {
    engine.milestoneSyncLock = false;
  }
}

export async function syncMilestonesImpl(engine: any) {
  if (!engine.userId) return;

  const { data: remoteMilestones, error } = await engine.supabase
    .from('milestones')
    .select('*')
    .eq('user_id', engine.userId);

  if (error) throw error;

  const localMilestones = await db.milestones.toArray();
  const remoteMap = new Map((remoteMilestones || []).map((m: any) => [m.id, m]));
  const localMap = new Map(localMilestones.map(m => [m.id, m]));

  const toInsertRemote: any[] = [];
  const toUpdateRemote: any[] = [];
  const toUpsertLocal: Milestone[] = [];

  for (const local of localMilestones) {
    const remote = remoteMap.get(local.id) as any;

    if (!remote) {
      toInsertRemote.push({
        id: local.id,
        user_id: engine.userId,
        goal_id: local.goalId,
        title: local.title,
        is_completed: local.completed,
        completed_at: local.completedAt || null,
        order_index: local.order,
        created_at: local.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (local.completed !== remote.is_completed || local.title !== remote.title) {
      const resolution = resolveConflict(
        { ...local, updatedAt: local.updatedAt || local.createdAt },
        {
          ...remote,
          completed: remote.is_completed,
          updated_at: remote.updated_at,
          created_at: remote.created_at
        },
        { preferCompleted: true }
      );

      if (resolution.winner === 'local') {
        toUpdateRemote.push({
          id: remote.id,
          user_id: engine.userId,
          goal_id: local.goalId,
          title: local.title,
          is_completed: local.completed,
          completed_at: local.completedAt || null,
          order_index: local.order,
          updated_at: new Date().toISOString(),
        });
        logger.info(`[SyncEngine] 🔄 Milestone conflict (${local.title}): ${resolution.reason}`);
      } else if (resolution.winner === 'remote') {
        toUpsertLocal.push({
          id: remote.id,
          userId: engine.userId || remote.user_id,
          goalId: remote.goal_id,
          title: remote.title,
          completed: remote.is_completed || false,
          completedAt: remote.completed_at || undefined,
          order: remote.order_index || 0,
          updatedAt: remote.updated_at,
          createdAt: remote.created_at,
        });
        logger.info(`[SyncEngine] 🔄 Milestone conflict (${local.title}): ${resolution.reason}`);
      }
    }
  }

  if (toInsertRemote.length > 0) {
    await engine.batchUpsert('milestones', toInsertRemote);
    logger.info(`[SyncEngine] ✅ Pushed ${toInsertRemote.length} new milestones to remote`);
  }

  if (toUpdateRemote.length > 0) {
    await engine.batchUpsert('milestones', toUpdateRemote);
    logger.info(`[SyncEngine] ✅ Updated ${toUpdateRemote.length} milestones on remote (conflict resolution)`);
  }

  for (const remote of (remoteMilestones || []) as any[]) {
    if (!localMap.has(remote.id)) {
      toUpsertLocal.push({
        id: remote.id,
        userId: engine.userId || remote.user_id,
        goalId: remote.goal_id,
        title: remote.title,
        completed: remote.is_completed || false,
        completedAt: remote.completed_at || undefined,
        order: remote.order_index || 0,
        updatedAt: remote.updated_at,
        createdAt: remote.created_at,
      });
    }
  }

  if (toUpsertLocal.length > 0) {
    const dedupedMilestones = engine.deduplicateByKey(
      toUpsertLocal,
      (m: any) => m.id
    );

    await db.transaction('rw', db.milestones, async () => {
      for (const milestone of dedupedMilestones) {
        const existing = await db.milestones.get(milestone.id);

        if (existing) {
          const shouldUpdate = (milestone.updatedAt || milestone.createdAt || '') >
            (existing.updatedAt || existing.createdAt || '');
          if (shouldUpdate) {
            await db.milestones.update(milestone.id, milestone);
          }
        } else {
          await db.milestones.add(milestone);
        }
      }
    });

    logger.info(`[SyncEngine] ✅ Pulled ${dedupedMilestones.length} milestones (deduped from ${toUpsertLocal.length})`);
  }
}
