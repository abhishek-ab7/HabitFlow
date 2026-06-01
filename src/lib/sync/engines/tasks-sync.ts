import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { ISynchronizer } from '../types';

export class TasksSyncEngine implements ISynchronizer {
  public domainName = 'tasks';
  private supabase = getSupabaseClient();

  public async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' }> {
    // 1. Bulk push dirty tasks
    const dirtyLocalTasks = await db.tasks
      .where('userId')
      .equals(userId)
      .filter((t: any) => t.isDirty === true || t.isDirty === 1)
      .toArray();

    let pushedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < dirtyLocalTasks.length; i += BATCH_SIZE) {
      const batch = dirtyLocalTasks.slice(i, i + BATCH_SIZE);
      const payload = batch.map((t) => ({
        id: t.id,
        user_id: userId,
        title: t.title,
        description: t.description || null,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        goal_id: t.goal_id || null,
        parent_task_id: t.parentTaskId || null,
        depth: t.depth || 0,
        tags: t.tags || [],
        recurrence_rule: t.recurrenceRule || '',
        estimated_time: t.estimatedTime || 0,
        actual_time: t.actualTime || 0,
        is_urgent: t.isUrgent ?? false,
        is_important: t.isImportant ?? false,
        generation_counter: t.generationCounter || 1,
        created_at: t.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await (this.supabase.from('tasks') as any)
        .upsert(payload, { onConflict: 'id' });

      if (error) throw new Error(`[TasksSyncEngine Bulk Push Failure]: ${error.message}`);

      await db.transaction('rw', db.tasks, async () => {
        const ids = batch.map((b) => b.id);
        await Promise.all(ids.map(id => db.tasks.update(id, { isDirty: false })));
      });
      pushedCount += batch.length;
    }

    // 2. Pull remote updates
    const latestLocalTask = await db.tasks.where('userId').equals(userId).sortBy('updated_at');
    let lastPushedTimestamp = latestLocalTask.length > 0 
      ? latestLocalTask[latestLocalTask.length - 1].updated_at 
      : null;
    if (!lastPushedTimestamp || lastPushedTimestamp === 'undefined') {
      lastPushedTimestamp = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: remoteData, error: pullError } = await (this.supabase
      .from('tasks') as any)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastPushedTimestamp);

    if (pullError) throw new Error(`[TasksSyncEngine Pull Failure]: ${pullError.message}`);

    let pulledCount = 0;
    if (remoteData && remoteData.length > 0) {
      await db.transaction('rw', db.tasks, async () => {
        for (const remote of remoteData) {
          const local = await db.tasks.get(remote.id);
          
          if (!local || (remote.generation_counter || 0) > (local.generationCounter || 0)) {
            await db.tasks.put({
              id: remote.id,
              userId: remote.user_id,
              title: remote.title,
              description: remote.description || null,
              status: remote.status,
              priority: remote.priority || 'medium',
              due_date: remote.due_date,
              goal_id: remote.goal_id,
              parentTaskId: remote.parent_task_id || null,
              depth: remote.depth || 0,
              tags: remote.tags || [],
              recurrenceRule: remote.recurrence_rule || '',
              estimatedTime: remote.estimated_time || 0,
              actualTime: remote.actual_time || 0,
              isUrgent: remote.is_urgent ?? false,
              isImportant: remote.is_important ?? false,
              generationCounter: remote.generation_counter || 1,
              created_at: remote.created_at,
              updated_at: remote.updated_at,
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
export async function syncTasksWithRetry(engine: any) {
  const tasksSync = new TasksSyncEngine();
  return tasksSync.sync(engine.userId);
}

export async function pushTaskToRemote(engine: any, task: any) {
  const supabase = getSupabaseClient();
  await (supabase.from('tasks') as any).upsert({
    id: task.id,
    user_id: engine.userId,
    title: task.title,
    description: task.description || null,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    goal_id: task.goal_id || null,
    parent_task_id: task.parentTaskId || null,
    depth: task.depth || 0,
    tags: task.tags || [],
    recurrence_rule: task.recurrenceRule || '',
    estimated_time: task.estimatedTime || 0,
    actual_time: task.actualTime || 0,
    is_urgent: task.isUrgent ?? false,
    is_important: task.isImportant ?? false,
    generation_counter: task.generationCounter || 1,
    created_at: task.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
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
    generationCounter: remote.generation_counter || 1,
    isDirty: false
  });
}
