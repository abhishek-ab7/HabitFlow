import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getInsertMetadata, getUpdateMetadata } from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';

function mcpError(text: string) {
  return { isError: true, content: [{ type: 'text' as const, text }] };
}

function mcpJson(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

function buildTasksQuery(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string, args: any) {
  let query = supabase.from('tasks').select('*').eq('user_id', userId);
  const eqFilters: Array<[string, any]> = [
    ['status', args.status && args.status !== 'all' ? args.status : undefined],
    ['priority', args.priority],
    ['goal_id', args.goalId],
    ['parent_task_id', args.parentTaskId],
  ];
  for (const [col, val] of eqFilters) {
    if (val) query = query.eq(col, val);
  }
  if (args.dueBefore) query = query.lte('due_date', args.dueBefore);
  if (args.dueAfter) query = query.gte('due_date', args.dueAfter);
  if (args.search) {
    query = query.or(
      `title.ilike.%${args.search}%,description.ilike.%${args.search}%,notes.ilike.%${args.search}%`
    );
  }
  return query.order('created_at', { ascending: false });
}

function countSubtasks(tasks: any[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.parent_task_id) continue;
    counts.set(t.parent_task_id, (counts.get(t.parent_task_id) || 0) + 1);
  }
  return counts;
}

function formatTaskItem(t: any, subtaskCounts: Map<string, number>) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    notes: t.notes,
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date,
    goalId: t.goal_id,
    parentTaskId: t.parent_task_id,
    subtasksCount: subtaskCounts.get(t.id) || 0,
    tags: t.tags || [],
    isUrgent: t.is_urgent,
    isImportant: t.is_important,
    estimatedTime: t.estimated_time,
    actualTime: t.actual_time,
    recurrenceRule: t.recurrence_rule,
    metadata: t.metadata || {},
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

export async function handleGetTasks(args: any) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:read')) {
    return mcpError('Forbidden: Missing habitflow:read scope.');
  }

  const supabase = getSupabaseAdmin();
  const { data: tasks, error } = await buildTasksQuery(supabase, auth.userId, args);
  if (error) return mcpError(`Failed to fetch tasks: ${error.message}`);

  const filtered = args.tag
    ? (tasks || []).filter((t) => Array.isArray(t.tags) && t.tags.includes(args.tag))
    : tasks || [];

  const subtaskCounts = countSubtasks(filtered);
  const result = filtered.map((t) => formatTaskItem(t, subtaskCounts));
  return mcpJson({ count: result.length, tasks: result });
}

async function cascadeSubtaskStatus(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  rootTaskId: string;
  targetStatus: 'archived' | 'todo';
  onlyFromStatus?: string;
}): Promise<string[]> {
  const affected: string[] = [];
  let frontier: string[] = [params.rootTaskId];

  while (frontier.length > 0) {
    const { data: children } = await params.supabase
      .from('tasks')
      .select('id, status, generation_counter')
      .eq('user_id', params.userId)
      .in('parent_task_id', frontier);

    const nextFrontier: string[] = [];
    for (const sub of children || []) {
      if (affected.includes(sub.id)) continue;
      if (!params.onlyFromStatus || sub.status === params.onlyFromStatus) {
        const subMeta = getUpdateMetadata(sub);
        await params.supabase
          .from('tasks')
          .update({ status: params.targetStatus, ...subMeta })
          .eq('user_id', params.userId)
          .eq('id', sub.id);
        affected.push(sub.id);
      }
      nextFrontier.push(sub.id);
    }
    frontier = nextFrontier;
  }

  return affected;
}

function buildNewTaskPayload(userId: string, depth: number, args: any) {
  return {
    user_id: userId,
    title: args.title.trim(),
    description: args.description || null,
    notes: args.notes || null,
    status: args.status || 'todo',
    priority: args.priority || 'medium',
    due_date: args.dueDate || null,
    goal_id: args.goalId || null,
    parent_task_id: args.parentTaskId || null,
    depth,
    tags: args.tags || [],
    recurrence_rule: args.recurrenceRule || null,
    estimated_time: args.estimatedTime ?? 0,
    actual_time: args.actualTime ?? 0,
    is_urgent: args.isUrgent ?? false,
    is_important: args.isImportant ?? false,
    metadata: args.metadata || {},
    ...getInsertMetadata(),
  };
}

async function createTaskFromArgs(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: any
) {
  let depth = 0;
  if (args.parentTaskId) {
    const { data: parent } = await supabase
      .from('tasks')
      .select('depth')
      .eq('user_id', userId)
      .eq('id', args.parentTaskId)
      .single();
    depth = (parent?.depth || 0) + 1;
  }

  const newTask = buildNewTaskPayload(userId, depth, args);
  const { data, error } = await supabase.from('tasks').insert(newTask).select().single();
  if (error) throw error;
  return { action: 'created', task: data };
}

const TASK_UPDATE_FIELD_MAP: Array<[string, string, (v: any) => any]> = [
  ['title', 'title', (v) => v.trim()],
  ['description', 'description', (v) => v],
  ['notes', 'notes', (v) => v],
  ['status', 'status', (v) => v],
  ['priority', 'priority', (v) => v],
  ['dueDate', 'due_date', (v) => v],
  ['goalId', 'goal_id', (v) => v],
  ['parentTaskId', 'parent_task_id', (v) => v],
  ['tags', 'tags', (v) => v],
  ['recurrenceRule', 'recurrence_rule', (v) => v],
  ['estimatedTime', 'estimated_time', (v) => v],
  ['actualTime', 'actual_time', (v) => v],
  ['isUrgent', 'is_urgent', (v) => v],
  ['isImportant', 'is_important', (v) => v],
  ['metadata', 'metadata', (v) => v],
];

function buildTaskUpdates(args: any): Record<string, any> {
  const updates: Record<string, any> = {};
  for (const [argKey, dbKey, transform] of TASK_UPDATE_FIELD_MAP) {
    if (args[argKey] !== undefined) {
      updates[dbKey] = transform(args[argKey]);
    }
  }
  return updates;
}

async function updateTaskRow(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  taskId: string;
  existing: any;
  patch: Record<string, any>;
}) {
  const { data, error } = await params.supabase
    .from('tasks')
    .update({ ...params.patch, ...getUpdateMetadata(params.existing) })
    .eq('user_id', params.userId)
    .eq('id', params.taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function applyTaskMutation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: any,
  args: any
) {
  if (args.action === 'archive') {
    const affectedSubtaskIds = await cascadeSubtaskStatus({
      supabase,
      userId,
      rootTaskId: args.taskId,
      targetStatus: 'archived',
    });
    const task = await updateTaskRow({ supabase, userId, taskId: args.taskId, existing, patch: { status: 'archived' } });
    return { action: 'archived', task, affectedSubtaskIds };
  }

  if (args.action === 'restore') {
    const restoredSubtaskIds = args.restoreSubtasks
      ? await cascadeSubtaskStatus({
          supabase,
          userId,
          rootTaskId: args.taskId,
          targetStatus: 'todo',
          onlyFromStatus: 'archived',
        })
      : [];
    const task = await updateTaskRow({ supabase, userId, taskId: args.taskId, existing, patch: { status: 'todo' } });
    return { action: 'restored', task, restoredSubtaskIds };
  }

  const isToggle = args.action === 'toggle_status';
  const patch = isToggle ? { status: existing.status === 'done' ? 'todo' : 'done' } : buildTaskUpdates(args);
  const task = await updateTaskRow({ supabase, userId, taskId: args.taskId, existing, patch });
  return { action: isToggle ? 'toggle_status' : 'updated', task };
}

async function runManageTaskAction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: any
) {
  if (args.action === 'create') {
    if (!args.title) return { error: 'Validation Error: title is required for create action.' };
    return { payload: await createTaskFromArgs(supabase, userId, args) };
  }
  if (!args.taskId) return { error: 'Validation Error: taskId is required.' };
  if (args.action === 'archive' && !args.confirm) {
    return { error: 'Confirmation Required: Archiving this task cascades to all its subtasks and requires confirm: true.' };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('id', args.taskId)
    .single();
  if (fetchErr || !existing) return { error: `Task not found: ${args.taskId}` };

  return { payload: await applyTaskMutation(supabase, userId, existing, args) };
}

export async function handleManageTask(args: any) {
  const auth = getMcpAuthContext();
  if (!hasScope(auth, 'habitflow:write')) return mcpError('Forbidden: Missing habitflow:write scope.');

  const start = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const result = await runManageTaskAction(supabase, auth.userId, args);
    if (result.error) return mcpError(result.error);

    await logMcpToolInvocation(auth, {
      toolName: 'manage_task',
      action: args.action,
      input: args,
      status: 'ok',
      durationMs: Date.now() - start,
    });
    return mcpJson(result.payload);
  } catch (err: any) {
    await logMcpToolInvocation(auth, {
      toolName: 'manage_task',
      action: args.action,
      input: args,
      status: 'error',
      errorMessage: err.message,
      durationMs: Date.now() - start,
    });
    return mcpError(`Failed to manage task: ${err.message}`);
  }
}
