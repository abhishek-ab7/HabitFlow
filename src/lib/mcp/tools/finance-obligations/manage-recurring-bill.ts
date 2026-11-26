 
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import {
  getInsertMetadata,
  getUpdateMetadata,
  resolveFallbackFinanceCategoryId,
} from '../../sync-helpers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  pickDefinedColumns,
} from '../tool-helpers';
import {
  archiveObligationRow,
  insertLinkedObligationTx,
  listObligationRows,
  restoreObligationRow,
} from './obligation-helpers';

const BILL_UPDATE_COLUMNS = [
  ['cadence', 'cadence'],
  ['dueDayOfMonth', 'due_day_of_month'],
  ['categoryId', 'category_id'],
  ['accountId', 'account_id'],
  ['autoLog', 'auto_log'],
  ['isActive', 'is_active'],
  ['color', 'color'],
  ['icon', 'icon'],
] as const;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

async function createRecurringBill(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.name || !args.amount) {
    return { error: 'Validation Error: name and amount are required for create.' };
  }
  const fallbackCategoryId =
    args.categoryId ??
    (await resolveFallbackFinanceCategoryId(supabase, userId, ['bills-utilities', 'other']));

  const { data, error } = await supabase
    .from('finance_recurring_bills')
    .insert({
      user_id: userId,
      name: String(args.name).trim(),
      amount: Number(args.amount),
      previous_amount: Number(args.amount),
      cadence: orVal(args.cadence, 'monthly'),
      due_day_of_month: orVal(args.dueDayOfMonth, 1),
      category_id: fallbackCategoryId,
      account_id: orVal(args.accountId, null),
      auto_log: orVal(args.autoLog, false),
      is_active: orVal(args.isActive, true),
      color: orVal(args.color, null),
      icon: orVal(args.icon, null),
      ...getInsertMetadata(),
    })
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', bill: data } };
}

async function markBillPaid(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  const accountIdToUse = args.accountId || existing.account_id;
  const payDate = args.date || getIstIsoDate();
  const payMonthKey = payDate.substring(0, 7);
  const payAmount = args.amount !== undefined ? Number(args.amount) : Number(existing.amount);

  const loggedTransaction = accountIdToUse
    ? await insertLinkedObligationTx({
        supabase,
        userId,
        accountId: accountIdToUse,
        categoryId: existing.category_id,
        fallbackSlugs: ['bills-utilities', 'other'],
        amount: payAmount,
        txFields: {
          title: `Bill: ${existing.name}`,
          merchant_name: existing.name,
          type: 'expense',
          date: payDate,
          month_key: payMonthKey,
          is_recurring: true,
          tags: ['recurring_bill'],
          notes: `Paid recurring bill "${existing.name}"`,
        },
      })
    : null;

  const { data: updatedBill } = await supabase
    .from('finance_recurring_bills')
    .update({ last_paid_month_key: payMonthKey, ...getUpdateMetadata(existing) })
    .eq('id', args.billId)
    .select()
    .single();

  return { payload: { action: 'paid', bill: updatedBill, loggedTransaction } };
}

async function updateRecurringBillFields(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  existing: Record<string, any>,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  const updates = pickDefinedColumns(args, BILL_UPDATE_COLUMNS);
  if (args.name !== undefined) updates.name = String(args.name).trim();
  if (args.amount !== undefined) {
    updates.previous_amount = existing.amount;
    updates.amount = args.amount;
  }

  const { data, error } = await supabase
    .from('finance_recurring_bills')
    .update({ ...updates, ...getUpdateMetadata(existing) })
    .eq('id', args.billId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'updated', bill: data } };
}

type BillMutationCtx = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  args: Record<string, any>;
};

const BILL_MUTATION_HANDLERS: Record<
  string,
  (ctx: BillMutationCtx) => Promise<{ error?: string; payload?: unknown }>
> = {
  archive: async ({ supabase, existing, args }) => {
    const res = await archiveObligationRow({
      supabase,
      table: 'finance_recurring_bills',
      id: args.billId,
      existing,
      extraPatch: { is_active: false },
      confirm: args.confirm,
      confirmMessage: 'Confirmation Required: Archiving this bill requires confirm: true.',
    });
    return res.error ? { error: res.error } : { payload: { action: 'archived', bill: res.data } };
  },
  restore: async ({ supabase, userId, existing, args }) => {
    const bill = await restoreObligationRow({
      supabase,
      table: 'finance_recurring_bills',
      userId,
      id: args.billId,
      existing,
      extraPatch: { is_active: true },
    });
    return { payload: { action: 'restored', bill } };
  },
  mark_paid: ({ supabase, userId, existing, args }) => markBillPaid(supabase, userId, existing, args),
  update: ({ supabase, existing, args }) => updateRecurringBillFields(supabase, existing, args),
};

async function mutateExistingBill(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.billId) return { error: 'Validation Error: billId is required.' };
  const handler = BILL_MUTATION_HANDLERS[args.action];
  if (!handler) return { error: `Unknown action: ${args.action}` };

  const { data: existing, error: fetchErr } = await supabase
    .from('finance_recurring_bills')
    .select('*')
    .eq('user_id', userId)
    .eq('id', args.billId)
    .single();
  if (fetchErr || !existing) return { error: `Bill not found: ${args.billId}` };

  return handler({ supabase, userId, existing, args });
}

async function handleManageBillWrite(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const outcome =
      args.action === 'create'
        ? await createRecurringBill(supabase, auth.userId, args)
        : await mutateExistingBill(supabase, auth.userId, args);

    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_recurring_bill',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_recurring_bill',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage bill',
    });
  }
}

export function registerManageRecurringBillTool(server: McpServer) {
  server.registerTool(
    'manage_recurring_bill',
    {
      title: 'Manage Recurring Bills',
      description: 'List, create, update, mark as paid (creates expense + updates account balance), archive, or restore recurring utility/subscription bills.',
      inputSchema: {
        action: z.enum(['list', 'create', 'update', 'mark_paid', 'archive', 'restore']).describe('Action to execute'),
        billId: z.string().uuid().optional().describe('Bill UUID (required for update, mark_paid, archive, restore)'),
        name: z.string().min(1).max(100).optional().describe('Bill name (e.g. Electricity, Netflix, Wifi)'),
        amount: z.number().positive().optional().describe('Bill amount in INR'),
        cadence: z.enum(['monthly', 'quarterly', 'yearly']).optional().default('monthly'),
        dueDayOfMonth: z.number().int().min(1).max(31).optional().describe('Day of month payment is due'),
        categoryId: z.string().uuid().optional(),
        accountId: z.string().uuid().optional().describe('Account used for payment'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Payment date override for mark_paid (defaults to IST today)'),
        autoLog: z.boolean().optional(),
        isActive: z.boolean().optional(),
        includeArchived: z.boolean().optional().default(false).describe('Include archived/soft-deleted bills in list'),
        color: z.string().optional(),
        icon: z.string().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for destructive actions like archive'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      if (args.action === 'list') {
        const authRes = authorizeMcpTool('habitflow:finance:read');
        if (!authRes.ok) return authRes.response;
        return listObligationRows({
          table: 'finance_recurring_bills',
          userId: authRes.auth.userId,
          includeArchived: args.includeArchived,
          orderCols: ['due_day_of_month'],
          resultKey: 'bills',
          errorLabel: 'bills',
        });
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageBillWrite(authRes.auth, args);
    }
  );
}
