import { db } from '@/lib/db';
import { resolveConflict } from '../conflict-resolution';
import { logger } from '@/lib/logger';
import type { Milestone } from '@/lib/types';

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

  // 1. Fetch remote goals to verify foreign key references
  const { data: remoteGoals, error: goalsError } = await engine.supabase
    .from('goals')
    .select('id')
    .eq('user_id', engine.userId);

  if (goalsError) throw goalsError;
  const remoteGoalIds = new Set((remoteGoals || []).map((g: any) => g.id));

  // 2. Fetch remote milestones
  const { data: remoteMilestones, error } = await engine.supabase
    .from('milestones')
    .select('*')
    .eq('user_id', engine.userId);

  if (error) throw error;

  // 3. Query local milestones belonging only to current user
  const localMilestones = await db.milestones.where('userId').equals(engine.userId).toArray();
  const remoteMap = new Map((remoteMilestones || []).map((m: any) => [m.id, m]));
  const localMap = new Map(localMilestones.map(m => [m.id, m]));

  const toInsertRemote: any[] = [];
  const toUpdateRemote: any[] = [];
  const toUpsertLocal: Milestone[] = [];

  for (const local of localMilestones) {
    const remote = remoteMap.get(local.id) as any;

    if (!remote) {
      const isNewLocal = !engine.lastSyncAt || new Date(local.updatedAt || local.createdAt || 0) >= engine.lastSyncAt;
      if (!isNewLocal) {
        logger.info(`[SyncEngine] Milestone "${local.title}" was deleted on remote, deleting locally.`);
        await db.milestones.delete(local.id);
      } else if (remoteGoalIds.has(local.goalId)) {
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
      } else {
        logger.warn(`[SyncEngine] Skipping milestone push: Goal ${local.goalId} not found on remote for milestone ${local.title}`);
      }
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
        if (remoteGoalIds.has(local.goalId)) {
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
        } else {
          logger.warn(`[SyncEngine] Skipping milestone push (conflict): Goal ${local.goalId} not found on remote for milestone ${local.title}`);
        }
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
