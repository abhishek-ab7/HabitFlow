import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { Goal } from '@/lib/types';
import type { ISynchronizer } from '../types';

export class GoalsSyncEngine implements ISynchronizer {
  public domainName = 'goals';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    // 1. Bulk push dirty goals
    const dirtyLocalGoals = await db.goals
      .where('userId')
      .equals(userId)
      .filter((g: any) => g.isDirty === true || g.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalGoals.length; i += BATCH_SIZE) {
      const batch = dirtyLocalGoals.slice(i, i + BATCH_SIZE);
      const payload = batch.map((g) => ({
        id: g.id,
        user_id: userId,
        title: g.title,
        description: g.description || null,
        category: g.areaOfLife,
        priority: g.priority,
        status: g.status,
        target_date: g.deadline,
        is_focus: g.isFocus,
        is_archived: g.archived,
        generation_counter: g.generationCounter || 1,
        updated_at: new Date().toISOString()
      }));

      const { error } = await (this.supabase.from('goals') as any)
        .upsert(payload, { onConflict: 'id' });

      if (error) throw new Error(`[GoalsSyncEngine Bulk Push Failure]: ${error.message}`);

      await db.transaction('rw', db.goals, async () => {
        const ids = batch.map((b) => b.id);
        await Promise.all(ids.map(id => db.goals.update(id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    // 2. Pull remote updates
    const latestLocalGoal = await db.goals.where('userId').equals(userId).sortBy('updatedAt');
    let lastPushedTimestamp = latestLocalGoal.length > 0 
      ? latestLocalGoal[latestLocalGoal.length - 1].updatedAt 
      : null;
    if (!lastPushedTimestamp || lastPushedTimestamp === 'undefined') {
      lastPushedTimestamp = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: remoteData, error: pullError } = await (this.supabase
      .from('goals') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastPushedTimestamp);

    if (pullError) throw new Error(`[GoalsSyncEngine Pull Failure]: ${pullError.message}`);

    let pulledCount = 0;
    if (remoteData && remoteData.length > 0) {
      await db.transaction('rw', db.goals, async () => {
        for (const remote of remoteData) {
          const local = await db.goals.get(remote.id);
          
          if (!local || (remote.generation_counter || 0) > (local.generationCounter || 0)) {
            await db.goals.put({
              id: remote.id,
              userId: remote.user_id,
              title: remote.title,
              description: remote.description || undefined,
              areaOfLife: remote.category,
              priority: remote.priority || 'medium',
              status: remote.status || 'not_started',
              deadline: remote.target_date,
              isFocus: remote.is_focus || false,
              archived: remote.is_archived || false,
              generationCounter: remote.generation_counter || 1,
              updatedAt: remote.updated_at,
              startDate: remote.created_at || new Date().toISOString(),
              createdAt: remote.created_at || new Date().toISOString(),
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
export async function syncGoalsWithRetry(engine: any) {
  const goalsSync = new GoalsSyncEngine();
  return goalsSync.sync(engine.userId);
}

export async function pushGoalToRemote(engine: any, goal: Goal) {
  const supabase = getSupabaseClient();
  await (supabase.from('goals') as any).upsert({
    id: goal.id,
    user_id: engine.userId,
    title: goal.title,
    description: goal.description || null,
    category: goal.areaOfLife,
    priority: goal.priority,
    status: goal.status,
    target_date: goal.deadline,
    is_focus: goal.isFocus,
    is_archived: goal.archived,
    generation_counter: goal.generationCounter || 1,
    updated_at: new Date().toISOString()
  });
}
