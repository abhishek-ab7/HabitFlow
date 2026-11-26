import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import { getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';
import { executePayCardBill } from './pay-bill';
import { executeReconcileStatement } from './reconcile-statement';

const STATEMENT_UPDATE_COLUMNS = [
  ['periodStart', 'period_start'],
  ['periodEnd', 'period_end'],
  ['dueDate', 'due_date'],
  ['carriedForwardAmount', 'carried_forward_amount'],
  ['paidAmount', 'paid_amount'],
  ['remainingDue', 'remaining_due'],
  ['manualAdjustment', 'manual_adjustment'],
  ['status', 'status'],
  ['notes', 'notes'],
] as const;

async function listStatements(userId: string, args: Record<string, any>) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('credit_card_statements').select('*').eq('user_id', userId);
  if (args.cardAccountId) query = query.eq('account_id', args.cardAccountId);
  if (!args.includeDeleted) query = query.is('deleted_at', null);
  const { data, error } = await query.order('period_end', { ascending: false });
  if (error) return mcpError(`Failed to list statements: ${error.message}`);
  return mcpJson({ count: (data || []).length, statements: data || [] });
}

function resolveTargetStatementId(args: Record<string, any>): string | null {
  if (args.statementId) return args.statementId;
  return args.cycleKey ? `${args.cardAccountId}_${args.cycleKey}` : null;
}

async function fetchStatementByTarget(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>,
  activeOnly = false
) {
  const targetId = resolveTargetStatementId(args);
  if (!targetId) {
    return { error: `Validation Error: statementId or cycleKey is required for ${args.action}.` };
  }

  let query = supabase
    .from('credit_card_statements')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', args.cardAccountId)
    .eq('id', targetId);
  if (activeOnly) query = query.is('deleted_at', null);

  const { data: existing, error: fetchErr } = await query.single();
  if (fetchErr || !existing) return { error: `Statement not found: ${targetId}` };
  return { existing };
}

async function patchStatementRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  statementId: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('credit_card_statements')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', statementId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

const STATEMENT_PATCH_BUILDERS: Record<
  string,
  (existing: Record<string, any>, args: Record<string, any>) => { actionLabel: string; patch: Record<string, unknown> }
> = {
  update_notes: (existing, args) => ({
    actionLabel: 'notes_updated',
    patch: { notes: args.notes ?? null, ...getUpdateMetadata(existing) },
  }),
  delete: (existing) => ({ actionLabel: 'deleted', patch: getSoftDeleteMetadata(existing) }),
  restore: (existing) => ({ actionLabel: 'restored', patch: { deleted_at: null, ...getUpdateMetadata(existing) } }),
};

function buildStatementPatchForAction(existing: Record<string, any>, args: Record<string, any>) {
  const builder = STATEMENT_PATCH_BUILDERS[args.action];
  if (builder) return builder(existing, args);
  const updates = pickDefinedColumns(args, STATEMENT_UPDATE_COLUMNS);
  return { actionLabel: 'updated', patch: { ...updates, ...getUpdateMetadata(existing) } };
}

async function mutateExistingStatement(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
) {
  const found = await fetchStatementByTarget(supabase, userId, args, args.action === 'update_notes');
  if (found.error || !found.existing) return { error: found.error };
  if (args.action === 'delete' && !args.confirm) {
    return { error: 'Confirmation Required: Deleting statement requires confirm: true.' };
  }

  const { actionLabel, patch } = buildStatementPatchForAction(found.existing, args);
  const statement = await patchStatementRow(supabase, userId, found.existing.id, patch);
  return { payload: { action: actionLabel, statement } };
}

async function dispatchStatementAction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  cardAccount: Record<string, any>,
  args: Record<string, any>
) {
  if (args.action === 'pay_bill') {
    const dateIst = args.date || getIstIsoDate();
    return executePayCardBill({ supabase, userId, cardAccount, args, dateIst });
  }
  if (args.action === 'reconcile_statement') {
    return executeReconcileStatement({ supabase, userId, cardAccount, args });
  }
  return mutateExistingStatement(supabase, userId, args);
}

async function handleStatementWrite(auth: McpAuthContext, args: Record<string, any>) {
  if (!args.cardAccountId) return mcpError('Validation Error: cardAccountId is required.');

  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const { data: cardAccount } = await supabase
      .from('finance_accounts')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('id', args.cardAccountId)
      .eq('type', 'credit_card')
      .single();

    if (!cardAccount) return mcpError(`Credit card account not found: ${args.cardAccountId}`);

    const outcome = await dispatchStatementAction(supabase, auth.userId, cardAccount, args);
    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_credit_card_statement',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_credit_card_statement',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage statement',
    });
  }
}

export function registerManageCreditCardStatementTool(server: McpServer) {
  server.registerTool(
    'manage_credit_card_statement',
    {
      title: 'Manage Credit Card Statement & Bill Payment',
      description:
        'List persisted statements, pay credit card bills (with waterfall statement allocation and account balance transfers), reconcile a statement cycle total, update statement fields/notes, soft-delete, or restore.',
      inputSchema: {
        action: z
          .enum(['list_statements', 'pay_bill', 'reconcile_statement', 'update', 'update_notes', 'delete', 'restore'])
          .describe('Action to execute'),
        cardAccountId: z.string().uuid().optional().describe('Target Credit Card account UUID (required for all actions except list_statements across all cards)'),
        fromAccountId: z.string().uuid().optional().describe('Source Bank/UPI account UUID paying the bill (required for pay_bill)'),
        amount: z.number().positive().optional().describe('Payment amount in INR (required for pay_bill)'),
        statementId: z.string().optional().describe('Specific statement ID (e.g. "<accountId>_YYYY-MM")'),
        cycleKey: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Statement cycle key (YYYY-MM)'),
        billedTotal: z.number().min(0).optional().describe('Total amount billed from official bank statement'),
        periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        carriedForwardAmount: z.number().min(0).optional(),
        paidAmount: z.number().min(0).optional(),
        remainingDue: z.number().min(0).optional(),
        manualAdjustment: z.number().optional(),
        status: z.enum(['billed', 'partial', 'paid', 'overdue']).optional(),
        includeDeleted: z.boolean().optional().default(false),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Payment or reconcile date (defaults to IST today)'),
        notes: z.string().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for delete'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      if (args.action === 'list_statements') {
        const authRes = authorizeMcpTool('habitflow:finance:read');
        if (!authRes.ok) return authRes.response;
        return listStatements(authRes.auth.userId, args);
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleStatementWrite(authRes.auth, args);
    }
  );
}
