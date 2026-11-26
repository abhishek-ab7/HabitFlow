import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { Milestone } from '@/lib/types';
import type { ISynchronizer } from '../types';

function mapRemoteMilestone(remote: any) {
  return {
    id: remote.id,
    userId: remote.user_id,
    goalId: remote.goal_id,
    title: remote.title,
    completed: remote.is_completed || false,
    completedAt: remote.completed_at || undefined,
    order: remote.order_index || 0,
    generationCounter: remote.generation_counter || 1,
    createdAt: remote.created_at,
    updatedAt: remote.updated_at,
    isDirty: false,
  };
}

export class MilestonesSyncEngine implements ISynchronizer {
  public domainName = 'milestones';
  private supabase = getSupabaseClient();

  private async pushDirtyMilestones(userId: string): Promise<number> {
    const dirtyLocalMilestones = await db.milestones
      .where('userId')
      .equals(userId)
      .filter((m: any) => m.isDirty === true || m.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalMilestones.length; i += BATCH_SIZE) {
      const batch = dirtyLocalMilestones.slice(i, i + BATCH_SIZE);
      const payload = batch.map((m) => ({
        id: m.id,
        user_id: userId,
        goal_id: m.goalId,
        title: m.title,
        is_completed: m.completed,
        completed_at: m.completedAt || null,
        order_index: m.order,
        generation_counter: m.generationCounter || 1,
        created_at: m.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await (this.supabase.from('milestones') as any).upsert(payload, { onConflict: 'id' });
      if (error) throw new Error(`[MilestonesSyncEngine Bulk Push Failure]: ${error.message}`);

      await db.transaction('rw', db.milestones, async () => {
        await Promise.all(batch.map((b) => db.milestones.update(b.id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }
    return pushedCount;
  }

  private async applyRemoteMilestones(remoteData: any[]): Promise<number> {
    let pulledCount = 0;
    await db.transaction('rw', db.milestones, async () => {
      for (const remote of remoteData) {
        const local = await db.milestones.get(remote.id);
        const isNewer = !local || (remote.generation_counter || 0) > (local.generationCounter || 0);
        if (!isNewer) continue;
        await db.milestones.put(mapRemoteMilestone(remote));
        pulledCount++;
      }
    });
    return pulledCount;
  }

  private async pullRemoteMilestones(userId: string): Promise<number> {
    const latestLocalMilestone = await db.milestones.where('userId').equals(userId).sortBy('updatedAt');
    const rawTimestamp = latestLocalMilestone.at(-1)?.updatedAt;
    const lastPushedTimestamp =
      !rawTimestamp || rawTimestamp === 'undefined'
        ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        : rawTimestamp;

    const { data: remoteData, error: pullError } = await (this.supabase.from('milestones') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastPushedTimestamp);

    if (pullError) throw new Error(`[MilestonesSyncEngine Pull Failure]: ${pullError.message}`);
    if (!remoteData || remoteData.length === 0) return 0;
    return this.applyRemoteMilestones(remoteData);
  }

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    const pushed = await this.pushDirtyMilestones(userId);
    const pulled = await this.pullRemoteMilestones(userId);
    return { pushed, pulled, status: 'success' };
  }
}

// Keep legacy wrappers for backward compatibility
export async function syncMilestonesWithRetry(engine: any) {
  const milestonesSync = new MilestonesSyncEngine();
  return milestonesSync.sync(engine.userId);
}
