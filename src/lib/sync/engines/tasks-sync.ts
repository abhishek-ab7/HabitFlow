import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { upsertRowsWithColumnFallback } from './column-fallback';
import type { ISynchronizer } from '../types';

function mapTaskMetaToRemote(task: any) {
  return {
    parent_task_id: task.parentTaskId || null,
    depth: task.depth || 0,
    tags: task.tags || [],
    metadata: task.metadata || {},
    recurrence_rule: task.recurrenceRule || '',
    estimated_time: task.estimatedTime || 0,
    actual_time: task.actualTime || 0,
    is_urgent: task.isUrgent ?? false,
    is_important: task.isImportant ?? false,
  };
}

function mapTaskToRemoteRow(userId: string, task: any) {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description || null,
    notes: task.notes || null,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    goal_id: task.goal_id || null,
    ...mapTaskMetaToRemote(task),
    generation_counter: task.generationCounter || 1,
    created_at: task.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapRemoteTaskMeta(remote: any, existingMetadata?: any) {
  return {
    parentTaskId: remote.parent_task_id || null,
    depth: remote.depth || 0,
    tags: remote.tags || [],
    metadata: remote.metadata ?? existingMetadata ?? {},
    recurrenceRule: remote.recurrence_rule || '',
    estimatedTime: remote.estimated_time || 0,
    actualTime: remote.actual_time || 0,
    isUrgent: remote.is_urgent ?? false,
    isImportant: remote.is_important ?? false,
  };
}

function mapRemoteToLocalTask(remote: any, existingMetadata?: any, userIdOverride?: string) {
  return {
    id: remote.id,
    userId: userIdOverride ?? remote.user_id,
    title: remote.title,
    description: remote.description || null,
    notes: remote.notes || null,
    status: remote.status,
    priority: remote.priority || 'medium',
    due_date: remote.due_date,
    goal_id: remote.goal_id,
    ...mapRemoteTaskMeta(remote, existingMetadata),
    generationCounter: remote.generation_counter || 1,
    created_at: remote.created_at,
    updated_at: remote.updated_at || remote.created_at,
    isDirty: false,
  };
}

function resolveTaskSinceTimestamp(latestLocalTask: any[]): string {
  const lastTs = latestLocalTask.length > 0 ? latestLocalTask[latestLocalTask.length - 1].updated_at : null;
  if (lastTs && lastTs !== 'undefined') return lastTs;
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
}

export class TasksSyncEngine implements ISynchronizer {
  public domainName = 'tasks';
  private supabase = getSupabaseClient();

  private async pushDirtyTasks(userId: string): Promise<number> {
    const dirtyLocalTasks = await db.tasks
      .where('userId')
      .equals(userId)
      .filter((t: any) => t.isDirty === true || t.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalTasks.length; i += BATCH_SIZE) {
      const batch = dirtyLocalTasks.slice(i, i + BATCH_SIZE);
      const payload = batch.map((t) => mapTaskToRemoteRow(userId, t));

      const { error } = await upsertRowsWithColumnFallback(
        this.supabase,
        'tasks',
        payload,
        { onConflict: 'id' }
      );
      if (error) throw new Error(`[TasksSyncEngine Bulk Push Failure]: ${error.message}`);

      await db.transaction('rw', db.tasks, async () => {
        await Promise.all(batch.map((b) => db.tasks.update(b.id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    return pushedCount;
  }

  private async applyRemoteTasks(remoteData: any[]): Promise<number> {
    let pulledCount = 0;
    await db.transaction('rw', db.tasks, async () => {
      for (const remote of remoteData) {
        const local = await db.tasks.get(remote.id);
        const isStale = Boolean(local) && (remote.generation_counter || 0) <= (local?.generationCounter || 0);
        if (isStale) continue;
        await db.tasks.put(mapRemoteToLocalTask(remote, local?.metadata));
        pulledCount++;
      }
    });
    return pulledCount;
  }

  private async pullRemoteTasks(userId: string): Promise<number> {
    const latestLocalTask = await db.tasks.where('userId').equals(userId).sortBy('updated_at');
    const since = resolveTaskSinceTimestamp(latestLocalTask);

    const { data: remoteData, error: pullError } = await (this.supabase.from('tasks') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since);

    if (pullError) throw new Error(`[TasksSyncEngine Pull Failure]: ${pullError.message}`);
    if (!remoteData?.length) return 0;
    return this.applyRemoteTasks(remoteData);
  }

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    const pushed = await this.pushDirtyTasks(userId);
    const pulled = await this.pullRemoteTasks(userId);
    return { pushed, pulled, status: 'success' };
  }
}

export async function syncTasksWithRetry(engine: any) {
  const tasksSync = new TasksSyncEngine();
  return tasksSync.sync(engine.userId);
}

export async function pushTaskToRemote(engine: any, task: any) {
  const supabase = getSupabaseClient();
  const { error } = await upsertRowsWithColumnFallback(
    supabase,
    'tasks',
    mapTaskToRemoteRow(engine.userId, task)
  );
  if (error) {
    logger.warn('[TasksSyncEngine] pushTaskToRemote failed:', error.message);
  }
}

export async function updateLocalTask(engine: any, remote: any) {
  await db.tasks.put(mapRemoteToLocalTask(remote, undefined, engine.userId!));
}
