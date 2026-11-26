import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { upsertRowsWithColumnFallback } from './column-fallback';
import type { Goal } from '@/lib/types';
import type { ISynchronizer } from '../types';

function mapGoalToRemoteRow(userId: string, goal: Goal) {
  return {
    id: goal.id,
    user_id: userId,
    title: goal.title,
    description: goal.description || null,
    category: goal.areaOfLife,
    priority: goal.priority,
    status: goal.status,
    target_date: goal.deadline,
    is_focus: goal.isFocus,
    is_archived: goal.archived,
    financial_link: goal.financialLink || null,
    fitness_link: goal.fitnessLink || null,
    metadata: goal.metadata || null,
    generation_counter: goal.generationCounter || 1,
    updated_at: new Date().toISOString(),
  };
}

function pickOptionalRemoteField<T>(remote: any, key: string, fallback: T): T {
  return Object.prototype.hasOwnProperty.call(remote, key)
    ? (remote[key] ?? undefined)
    : fallback;
}

function mapGoalLinks(remote: any, local: Goal | undefined) {
  return {
    financialLink: pickOptionalRemoteField(remote, 'financial_link', local?.financialLink),
    fitnessLink: pickOptionalRemoteField(remote, 'fitness_link', local?.fitnessLink),
    metadata: pickOptionalRemoteField(remote, 'metadata', local?.metadata),
  };
}

function mapRemoteToLocalGoal(remote: any, local: Goal | undefined): Goal {
  const createdAt = remote.created_at || new Date().toISOString();
  return {
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
    ...mapGoalLinks(remote, local),
    generationCounter: remote.generation_counter || 1,
    updatedAt: remote.updated_at,
    startDate: createdAt,
    createdAt,
    isDirty: false,
  };
}

function resolveGoalSinceTimestamp(latestLocalGoal: Goal[]): string {
  const lastTs = latestLocalGoal.length > 0 ? latestLocalGoal[latestLocalGoal.length - 1].updatedAt : null;
  if (lastTs && lastTs !== 'undefined') return lastTs;
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
}

export class GoalsSyncEngine implements ISynchronizer {
  public domainName = 'goals';
  private supabase = getSupabaseClient();

  private async pushDirtyGoals(userId: string): Promise<number> {
    const dirtyLocalGoals = await db.goals
      .where('userId')
      .equals(userId)
      .filter((g: any) => g.isDirty === true || g.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalGoals.length; i += BATCH_SIZE) {
      const batch = dirtyLocalGoals.slice(i, i + BATCH_SIZE);
      const payload = batch.map((g) => mapGoalToRemoteRow(userId, g));

      const { error } = await upsertRowsWithColumnFallback(
        this.supabase,
        'goals',
        payload,
        { onConflict: 'id' }
      );
      if (error) throw new Error(`[GoalsSyncEngine Bulk Push Failure]: ${error.message}`);

      await db.transaction('rw', db.goals, async () => {
        await Promise.all(batch.map((b) => db.goals.update(b.id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    return pushedCount;
  }

  private async applyRemoteGoals(remoteData: any[]): Promise<number> {
    let pulledCount = 0;
    await db.transaction('rw', db.goals, async () => {
      for (const remote of remoteData) {
        const local = await db.goals.get(remote.id);
        const isStale = Boolean(local) && (remote.generation_counter || 0) <= (local?.generationCounter || 0);
        if (isStale) continue;
        await db.goals.put(mapRemoteToLocalGoal(remote, local));
        pulledCount++;
      }
    });
    return pulledCount;
  }

  private async pullRemoteGoals(userId: string): Promise<number> {
    const latestLocalGoal = await db.goals.where('userId').equals(userId).sortBy('updatedAt');
    const since = resolveGoalSinceTimestamp(latestLocalGoal);

    const { data: remoteData, error: pullError } = await (this.supabase.from('goals') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since);

    if (pullError) throw new Error(`[GoalsSyncEngine Pull Failure]: ${pullError.message}`);
    if (!remoteData?.length) return 0;
    return this.applyRemoteGoals(remoteData);
  }

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    const pushed = await this.pushDirtyGoals(userId);
    const pulled = await this.pullRemoteGoals(userId);
    return { pushed, pulled, status: 'success' };
  }
}

export async function syncGoalsWithRetry(engine: any) {
  const goalsSync = new GoalsSyncEngine();
  return goalsSync.sync(engine.userId);
}

export async function pushGoalToRemote(engine: any, goal: Goal) {
  const supabase = getSupabaseClient();
  const { error } = await upsertRowsWithColumnFallback(
    supabase,
    'goals',
    mapGoalToRemoteRow(engine.userId, goal)
  );
  if (error) {
    logger.warn('[GoalsSyncEngine] pushGoalToRemote failed:', error.message);
  }
}
