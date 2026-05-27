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
