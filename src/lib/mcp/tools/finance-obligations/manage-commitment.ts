 
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { calculateCommitmentLedger } from '@/lib/finance/shared-analytics';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate, getIstMonthKey } from '../../config';
import { getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';
import { mapFinanceTransactionFromRow, mapMonthlyCommitmentFromRow } from '../../mappers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';
import {
  archiveObligationRow,
  insertLinkedObligationTx,
  listObligationRows,
  restoreObligationRow,
} from './obligation-helpers';

const COMMITMENT_UPDATE_COLUMNS = [
  ['monthlyTargetAmount', 'monthly_target_amount'],
  ['dueDayOfMonth', 'due_day_of_month'],
  ['autoRolloverOverpayment', 'auto_rollover_overpayment'],
  ['isActive', 'is_active'],
  ['icon', 'icon'],
  ['color', 'color'],
  ['notes', 'notes'],
] as const;

async function getCommitmentLedger(userId: string, args: Record<string, any>) {
  if (!args.commitmentId) {
    return mcpError('Validation Error: commitmentId is required for get_ledger.');
  }
  const supabase = getSupabaseAdmin();
  const { data: commitment, error: cErr } = await supabase
    .from('monthly_commitments')
    .select('*')
    .eq('user_id', userId)
    .eq('id', args.commitmentId)
    .single();
  if (cErr || !commitment) return mcpError(`Commitment not found: ${args.commitmentId}`);

  const { data: txs } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('linked_commitment_id', commitment.id)
    .is('deleted_at', null);

  const targetMonth = args.monthKey || getIstMonthKey();
  const ledger = calculateCommitmentLedger(
    mapMonthlyCommitmentFromRow(commitment),
    targetMonth,
    (txs || []).map(mapFinanceTransactionFromRow)
  );
  return mcpJson({ monthKey: targetMonth, ledger });
}

function hasRequiredCommitmentArgs(args: Record<string, any>): boolean {
  return Boolean(args.title) && Boolean(args.recipientName) && Boolean(args.monthlyTargetAmount);
}

function buildNewCommitmentRow(userId: string, args: Record<string, any>) {
  return {
    user_id: userId,
    title: String(args.title).trim(),
    recipient_name: String(args.recipientName).trim(),
    relationship: args.relationship?.trim() ?? 'Other',
    monthly_target_amount: Number(args.monthlyTargetAmount),
    due_day_of_month: args.dueDayOfMonth ?? 1,
    auto_rollover_overpayment: args.autoRolloverOverpayment ?? true,
    is_active: true,
    notes: args.notes ?? null,
    ...getInsertMetadata(),
  };
}

async function createCommitmentRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (!hasRequiredCommitmentArgs(args)) {
    return {
      error: 'Validation Error: title, recipientName, and monthlyTargetAmount are required for create.',
    };
  }

  const { data, error } = await supabase
    .from('monthly_commitments')
    .insert(buildNewCommitmentRow(userId, args))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', commitment: data } };
}

async function computeCommitmentMonthLedger(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  contribMonthKey: string
) {
  const { data: txs } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('linked_commitment_id', existing.id)
    .is('deleted_at', null);

  return calculateCommitmentLedger(
    mapMonthlyCommitmentFromRow(existing),
    contribMonthKey,
    (txs || []).map(mapFinanceTransactionFromRow)
  );
}

async function logCommitmentContribution(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  if (!args.contributionAmount || !args.accountId) {
    return {
      error: 'Validation Error: contributionAmount and accountId are required for log_contribution.',
    };
  }

  const amount = Number(args.contributionAmount);
  const contribDate = args.date || getIstIsoDate();
  const contribMonthKey = contribDate.substring(0, 7);

  const loggedTransaction = await insertLinkedObligationTx({
    supabase,
    userId,
    accountId: args.accountId,
    categoryId: existing.default_category_id,
    fallbackSlugs: ['family-support', 'other'],
    amount,
    txFields: {
      title: `Commitment: ${existing.title}`,
      merchant_name: existing.recipient_name,
      type: 'expense',
      date: contribDate,
      month_key: contribMonthKey,
      linked_commitment_id: existing.id,
      commitment_contribution_type: args.contributionType || 'direct_payment',
      tags: ['commitment_contribution'],
      notes: args.notes || `Fulfilled monthly commitment for ${existing.recipient_name}`,
    },
  });

  const monthLedger = await computeCommitmentMonthLedger(supabase, userId, existing, contribMonthKey);
  return { payload: { action: 'contribution_logged', loggedTransaction, monthLedger } };
}

async function updateCommitmentFields(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  existing: Record<string, any>,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  const updates = pickDefinedColumns(args, COMMITMENT_UPDATE_COLUMNS);
  if (args.title !== undefined) updates.title = String(args.title).trim();
  if (args.recipientName !== undefined) updates.recipient_name = String(args.recipientName).trim();
  if (args.relationship !== undefined) updates.relationship = String(args.relationship).trim();

  const { data, error } = await supabase
    .from('monthly_commitments')
    .update({ ...updates, ...getUpdateMetadata(existing) })
    .eq('id', args.commitmentId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'updated', commitment: data } };
}

type CommitmentMutationCtx = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  args: Record<string, any>;
};

const COMMITMENT_MUTATION_HANDLERS: Record<
  string,
  (ctx: CommitmentMutationCtx) => Promise<{ error?: string; payload?: unknown }>
> = {
  archive: async ({ supabase, existing, args }) => {
    const res = await archiveObligationRow({
      supabase,
      table: 'monthly_commitments',
      id: args.commitmentId,
      existing,
      extraPatch: { is_active: false },
      confirm: args.confirm,
      confirmMessage: 'Confirmation Required: Archiving commitment requires confirm: true.',
    });
    return res.error ? { error: res.error } : { payload: { action: 'archived', commitment: res.data } };
  },
  restore: async ({ supabase, userId, existing, args }) => {
    const commitment = await restoreObligationRow({
      supabase,
      table: 'monthly_commitments',
      userId,
      id: args.commitmentId,
      existing,
      extraPatch: { is_active: true },
    });
    return { payload: { action: 'restored', commitment } };
  },
  log_contribution: ({ supabase, userId, existing, args }) =>
    logCommitmentContribution(supabase, userId, existing, args),
  update: ({ supabase, existing, args }) => updateCommitmentFields(supabase, existing, args),
};

async function mutateExistingCommitment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.commitmentId) return { error: 'Validation Error: commitmentId is required.' };
  const handler = COMMITMENT_MUTATION_HANDLERS[args.action];
  if (!handler) return { error: `Unknown action: ${args.action}` };

  const { data: existing, error: fetchErr } = await supabase
    .from('monthly_commitments')
    .select('*')
    .eq('user_id', userId)
    .eq('id', args.commitmentId)
    .single();
  if (fetchErr || !existing) return { error: `Commitment not found: ${args.commitmentId}` };

  return handler({ supabase, userId, existing, args });
}

async function handleManageCommitmentWrite(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const outcome =
      args.action === 'create'
        ? await createCommitmentRecord(supabase, auth.userId, args)
        : await mutateExistingCommitment(supabase, auth.userId, args);

    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_monthly_commitment',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_monthly_commitment',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage commitment',
    });
  }
}

export function registerManageMonthlyCommitmentTool(server: McpServer) {
  server.registerTool(
    'manage_monthly_commitment',
    {
      title: 'Manage Monthly Commitments (Family/Personal Allowances)',
      description:
        'List commitments, inspect monthly commitment ledger with rollover, create/update/archive/restore monthly obligations (parents allowance, house rent, etc.), or log contributions.',
      inputSchema: {
        action: z.enum(['list', 'get_ledger', 'create', 'update', 'log_contribution', 'archive', 'restore']).describe('Action to execute'),
        commitmentId: z.string().uuid().optional().describe('Commitment UUID'),
        title: z.string().min(1).max(100).optional().describe('Commitment title (e.g. Parents Support, Home Rent)'),
        recipientName: z.string().min(1).max(100).optional().describe('Recipient name (e.g. Mom & Dad, Landlord)'),
        relationship: z.string().optional().describe('Relationship (e.g. Parents, Family, Landlord)'),
        monthlyTargetAmount: z.number().positive().optional().describe('Monthly target allocation in INR'),
        dueDayOfMonth: z.number().int().min(1).max(31).optional(),
        autoRolloverOverpayment: z.boolean().optional().describe('Whether overpayment rolls over to reduce next month target'),
        contributionAmount: z.number().positive().optional().describe('Contribution amount in INR for log_contribution'),
        contributionType: z.enum(['direct_payment', 'offset_expense']).optional().default('direct_payment'),
        accountId: z.string().uuid().optional().describe('Account used for payment'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Contribution date override (defaults to IST today)'),
        monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Target month key (YYYY-MM) for get_ledger'),
        isActive: z.boolean().optional(),
        includeArchived: z.boolean().optional().default(false),
        icon: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for archive'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      if (args.action === 'list' || args.action === 'get_ledger') {
        const authRes = authorizeMcpTool('habitflow:finance:read');
        if (!authRes.ok) return authRes.response;
        if (args.action === 'get_ledger') return getCommitmentLedger(authRes.auth.userId, args);
        return listObligationRows({
          table: 'monthly_commitments',
          userId: authRes.auth.userId,
          includeArchived: args.includeArchived,
          orderCols: ['due_day_of_month'],
          resultKey: 'commitments',
          errorLabel: 'commitments',
        });
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageCommitmentWrite(authRes.auth, args);
    }
  );
}
