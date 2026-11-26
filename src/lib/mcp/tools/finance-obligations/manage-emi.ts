 
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import { getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';
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

const EMI_UPDATE_COLUMNS = [
  ['principalAmount', 'principal_amount'],
  ['interestRateAnnual', 'interest_rate_annual'],
  ['emiAmount', 'emi_amount'],
  ['tenureMonths', 'tenure_months'],
  ['paidMonths', 'paid_months'],
  ['startDate', 'start_date'],
  ['billingDayOfMonth', 'billing_day_of_month'],
  ['accountId', 'account_id'],
  ['categoryId', 'category_id'],
  ['status', 'status'],
  ['notes', 'notes'],
] as const;

function hasRequiredEmiArgs(args: Record<string, any>): boolean {
  return Boolean(args.loanName && args.principalAmount && args.emiAmount && args.tenureMonths);
}

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function buildNewEmiRow(userId: string, args: Record<string, any>) {
  return {
    user_id: userId,
    loan_name: String(args.loanName).trim(),
    lender_name: args.lenderName?.trim() ?? 'Lender',
    principal_amount: Number(args.principalAmount),
    interest_rate_annual: Number(orVal(args.interestRateAnnual, 0)),
    emi_amount: Number(args.emiAmount),
    tenure_months: Number(args.tenureMonths),
    paid_months: Number(orVal(args.paidMonths, 0)),
    start_date: orVal(args.startDate, getIstIsoDate()),
    billing_day_of_month: orVal(args.billingDayOfMonth, 5),
    category_id: orVal(args.categoryId, null),
    account_id: orVal(args.accountId, null),
    status: 'active',
    notes: orVal(args.notes, null),
    ...getInsertMetadata(),
  };
}

async function createEmiTracker(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (!hasRequiredEmiArgs(args)) {
    return {
      error: 'Validation Error: loanName, principalAmount, emiAmount, and tenureMonths are required for create.',
    };
  }

  const { data, error } = await supabase
    .from('emi_trackers')
    .insert(buildNewEmiRow(userId, args))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', emi: data } };
}

async function logEmiPayment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  const accountIdToUse = args.accountId || existing.account_id;
  const payDate = args.date || getIstIsoDate();
  const payMonthKey = payDate.substring(0, 7);
  const payAmount = args.amount !== undefined ? Number(args.amount) : Number(existing.emi_amount);

  const loggedTransaction = accountIdToUse
    ? await insertLinkedObligationTx({
        supabase,
        userId,
        accountId: accountIdToUse,
        categoryId: existing.category_id,
        fallbackSlugs: ['emis-debt-repayment', 'other'],
        amount: payAmount,
        txFields: {
          title: `EMI: ${existing.loan_name} (${existing.paid_months + 1}/${existing.tenure_months})`,
          merchant_name: existing.lender_name,
          type: 'expense',
          date: payDate,
          month_key: payMonthKey,
          linked_emi_id: existing.id,
          tags: ['emi_payment'],
          notes: `Monthly EMI installment for ${existing.loan_name}`,
        },
      })
    : null;

  const nextPaidMonths = existing.paid_months + 1;
  const status = nextPaidMonths >= existing.tenure_months ? 'completed' : 'active';
  const { data: updatedEmi } = await supabase
    .from('emi_trackers')
    .update({
      paid_months: nextPaidMonths,
      status,
      last_paid_month_key: payMonthKey,
      ...getUpdateMetadata(existing),
    })
    .eq('id', args.emiId)
    .select()
    .single();

  return { payload: { action: 'payment_logged', emi: updatedEmi, loggedTransaction } };
}

async function patchEmiRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  emiId: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await supabase.from('emi_trackers').update(patch).eq('id', emiId).select().single();
  if (error) throw error;
  return data;
}

async function forecloseOrUpdateEmi(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  existing: Record<string, any>,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (args.action === 'foreclose') {
    if (!args.confirm) return { error: 'Confirmation Required: Foreclosing an EMI requires confirm: true.' };
    const emi = await patchEmiRow(supabase, args.emiId, { status: 'foreclosed', ...getUpdateMetadata(existing) });
    return { payload: { action: 'foreclosed', emi } };
  }

  const updates = pickDefinedColumns(args, EMI_UPDATE_COLUMNS);
  if (args.loanName !== undefined) updates.loan_name = String(args.loanName).trim();
  if (args.lenderName !== undefined) updates.lender_name = String(args.lenderName).trim();

  const emi = await patchEmiRow(supabase, args.emiId, { ...updates, ...getUpdateMetadata(existing) });
  return { payload: { action: 'updated', emi } };
}

type EmiMutationCtx = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  args: Record<string, any>;
};

const EMI_MUTATION_HANDLERS: Record<
  string,
  (ctx: EmiMutationCtx) => Promise<{ error?: string; payload?: unknown }>
> = {
  archive: async ({ supabase, existing, args }) => {
    const res = await archiveObligationRow({
      supabase,
      table: 'emi_trackers',
      id: args.emiId,
      existing,
      extraPatch: { status: 'archived' },
      confirm: args.confirm,
      confirmMessage: 'Confirmation Required: Archiving an EMI requires confirm: true.',
    });
    return res.error ? { error: res.error } : { payload: { action: 'archived', emi: res.data } };
  },
  restore: async ({ supabase, userId, existing, args }) => {
    const nextStatus = existing.paid_months >= existing.tenure_months ? 'completed' : 'active';
    const emi = await restoreObligationRow({
      supabase,
      table: 'emi_trackers',
      userId,
      id: args.emiId,
      existing,
      extraPatch: { status: nextStatus },
    });
    return { payload: { action: 'restored', emi } };
  },
  log_payment: ({ supabase, userId, existing, args }) => logEmiPayment(supabase, userId, existing, args),
  foreclose: ({ supabase, existing, args }) => forecloseOrUpdateEmi(supabase, existing, args),
  update: ({ supabase, existing, args }) => forecloseOrUpdateEmi(supabase, existing, args),
};

async function mutateExistingEmi(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.emiId) return { error: 'Validation Error: emiId is required.' };
  const handler = EMI_MUTATION_HANDLERS[args.action];
  if (!handler) return { error: `Unknown action: ${args.action}` };

  const { data: existing, error: fetchErr } = await supabase
    .from('emi_trackers')
    .select('*')
    .eq('user_id', userId)
    .eq('id', args.emiId)
    .single();
  if (fetchErr || !existing) return { error: `EMI tracker not found: ${args.emiId}` };

  return handler({ supabase, userId, existing, args });
}

async function handleManageEmiWrite(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const outcome =
      args.action === 'create'
        ? await createEmiTracker(supabase, auth.userId, args)
        : await mutateExistingEmi(supabase, auth.userId, args);

    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_emi',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_emi',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage EMI',
    });
  }
}

export function registerManageEmiTool(server: McpServer) {
  server.registerTool(
    'manage_emi',
    {
      title: 'Manage EMI Trackers',
      description:
        'List loan EMIs, create/update loan trackers, log monthly installments (creates expense + advances paid months), foreclose, archive (soft-delete), or restore an EMI.',
      inputSchema: {
        action: z.enum(['list', 'create', 'update', 'log_payment', 'foreclose', 'archive', 'restore']).describe('Action to execute'),
        emiId: z.string().uuid().optional().describe('EMI Tracker UUID'),
        loanName: z.string().min(1).max(100).optional().describe('Loan name (e.g. Home Loan, Car Loan, MacBook EMI)'),
        lenderName: z.string().optional().describe('Bank or Lender (e.g. HDFC Bank, Bajaj Finserv)'),
        principalAmount: z.number().positive().optional().describe('Total original loan amount'),
        interestRateAnnual: z.number().min(0).optional().describe('Annual interest percentage (e.g. 8.5)'),
        emiAmount: z.number().positive().optional().describe('Monthly EMI installment amount'),
        amount: z.number().positive().optional().describe('Override installment payment amount for log_payment'),
        tenureMonths: z.number().int().positive().optional().describe('Total tenure in months'),
        paidMonths: z.number().int().min(0).optional().describe('Months already paid'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Payment date override for log_payment (defaults to IST today)'),
        billingDayOfMonth: z.number().int().min(1).max(31).optional(),
        accountId: z.string().uuid().optional().describe('Account EMI is auto-debited from'),
        categoryId: z.string().uuid().optional(),
        status: z.enum(['active', 'completed', 'foreclosed', 'archived']).optional(),
        includeArchived: z.boolean().optional().default(false),
        notes: z.string().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for foreclose or archive'),
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
          table: 'emi_trackers',
          userId: authRes.auth.userId,
          includeArchived: args.includeArchived,
          orderCols: ['status', 'billing_day_of_month'],
          resultKey: 'emis',
          errorLabel: 'EMIs',
        });
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageEmiWrite(authRes.auth, args);
    }
  );
}
