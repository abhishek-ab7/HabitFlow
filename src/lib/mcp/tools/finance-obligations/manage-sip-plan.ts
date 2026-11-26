 
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

const SIP_UPDATE_COLUMNS = [
  ['assetClass', 'asset_class'],
  ['monthlyAmount', 'monthly_amount'],
  ['sipDayOfMonth', 'sip_day_of_month'],
  ['totalInvested', 'total_invested'],
  ['currentValue', 'current_value'],
  ['expectedReturnAnnual', 'expected_return_annual'],
  ['startDate', 'start_date'],
  ['accountId', 'account_id'],
  ['categoryId', 'category_id'],
  ['isActive', 'is_active'],
  ['color', 'color'],
  ['notes', 'notes'],
] as const;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

async function createSipPlan(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.name || !args.monthlyAmount) {
    return { error: 'Validation Error: name and monthlyAmount are required for create.' };
  }

  const initialInvested = Number(orVal(args.totalInvested, 0));
  const { data, error } = await supabase
    .from('finance_sip_plans')
    .insert({
      user_id: userId,
      name: String(args.name).trim(),
      platform: args.platform?.trim() ?? 'Direct',
      asset_class: orVal(args.assetClass, 'equity'),
      monthly_amount: Number(args.monthlyAmount),
      sip_day_of_month: orVal(args.sipDayOfMonth, 10),
      start_date: orVal(args.startDate, getIstIsoDate()),
      total_invested: initialInvested,
      current_value: Number(orVal(args.currentValue, initialInvested)),
      expected_return_annual: Number(orVal(args.expectedReturnAnnual, 12)),
      account_id: orVal(args.accountId, null),
      category_id: orVal(args.categoryId, null),
      is_active: true,
      notes: orVal(args.notes, null),
      ...getInsertMetadata(),
    })
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', sip: data } };
}

async function logSipInstallment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  const accountIdToUse = args.accountId || existing.account_id;
  const instDate = args.date || getIstIsoDate();
  const instMonthKey = instDate.substring(0, 7);
  const instAmount = args.amount !== undefined ? Number(args.amount) : Number(existing.monthly_amount);

  const loggedTransaction = accountIdToUse
    ? await insertLinkedObligationTx({
        supabase,
        userId,
        accountId: accountIdToUse,
        categoryId: existing.category_id,
        fallbackSlugs: ['investments', 'other'],
        amount: instAmount,
        txFields: {
          title: `SIP: ${existing.name}`,
          merchant_name: existing.platform,
          type: 'investment',
          date: instDate,
          month_key: instMonthKey,
          linked_sip_id: existing.id,
          tags: ['sip_installment', existing.asset_class],
          notes: `Monthly SIP installment for ${existing.name}`,
        },
      })
    : null;

  const newTotalInvested = Math.round((Number(existing.total_invested || 0) + instAmount) * 100) / 100;
  const newCurrentValue = Math.round((Number(existing.current_value || 0) + instAmount) * 100) / 100;

  const { data: updatedSip } = await supabase
    .from('finance_sip_plans')
    .update({
      total_invested: newTotalInvested,
      current_value: newCurrentValue,
      last_invested_month_key: instMonthKey,
      ...getUpdateMetadata(existing),
    })
    .eq('id', args.sipId)
    .select()
    .single();

  return { payload: { action: 'installment_logged', sip: updatedSip, loggedTransaction } };
}

async function patchSipRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  sipId: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await supabase.from('finance_sip_plans').update(patch).eq('id', sipId).select().single();
  if (error) throw error;
  return data;
}

async function updateSipValuationOrFields(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  existing: Record<string, any>,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (args.action === 'update_valuation') {
    if (args.currentValue === undefined) {
      return { error: 'Validation Error: currentValue is required for update_valuation.' };
    }
    const sip = await patchSipRow(supabase, args.sipId, {
      current_value: Number(args.currentValue),
      ...getUpdateMetadata(existing),
    });
    return { payload: { action: 'valuation_updated', sip } };
  }

  const updates = pickDefinedColumns(args, SIP_UPDATE_COLUMNS);
  if (args.name !== undefined) updates.name = String(args.name).trim();
  if (args.platform !== undefined) updates.platform = String(args.platform).trim();

  const sip = await patchSipRow(supabase, args.sipId, { ...updates, ...getUpdateMetadata(existing) });
  return { payload: { action: 'updated', sip } };
}

type SipMutationCtx = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  args: Record<string, any>;
};

const SIP_MUTATION_HANDLERS: Record<
  string,
  (ctx: SipMutationCtx) => Promise<{ error?: string; payload?: unknown }>
> = {
  archive: async ({ supabase, existing, args }) => {
    const res = await archiveObligationRow({
      supabase,
      table: 'finance_sip_plans',
      id: args.sipId,
      existing,
      extraPatch: { is_active: false },
      confirm: args.confirm,
      confirmMessage: 'Confirmation Required: Archiving this SIP plan requires confirm: true.',
    });
    return res.error ? { error: res.error } : { payload: { action: 'archived', sip: res.data } };
  },
  restore: async ({ supabase, userId, existing, args }) => {
    const sip = await restoreObligationRow({
      supabase,
      table: 'finance_sip_plans',
      userId,
      id: args.sipId,
      existing,
      extraPatch: { is_active: true },
    });
    return { payload: { action: 'restored', sip } };
  },
  log_installment: ({ supabase, userId, existing, args }) => logSipInstallment(supabase, userId, existing, args),
  update_valuation: ({ supabase, existing, args }) => updateSipValuationOrFields(supabase, existing, args),
  update: ({ supabase, existing, args }) => updateSipValuationOrFields(supabase, existing, args),
};

async function mutateExistingSip(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.sipId) return { error: 'Validation Error: sipId is required.' };
  const handler = SIP_MUTATION_HANDLERS[args.action];
  if (!handler) return { error: `Unknown action: ${args.action}` };

  const { data: existing, error: fetchErr } = await supabase
    .from('finance_sip_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('id', args.sipId)
    .single();
  if (fetchErr || !existing) return { error: `SIP plan not found: ${args.sipId}` };

  return handler({ supabase, userId, existing, args });
}

async function handleManageSipWrite(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const outcome =
      args.action === 'create'
        ? await createSipPlan(supabase, auth.userId, args)
        : await mutateExistingSip(supabase, auth.userId, args);

    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_sip_plan',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_sip_plan',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage SIP',
    });
  }
}

export function registerManageSipPlanTool(server: McpServer) {
  server.registerTool(
    'manage_sip_plan',
    {
      title: 'Manage SIP Investment Plans',
      description:
        'List SIP plans, create/update/archive/restore monthly SIP investments, log installments (creates investment transaction + updates total invested), or update latest portfolio valuation.',
      inputSchema: {
        action: z
          .enum(['list', 'create', 'update', 'log_installment', 'update_valuation', 'archive', 'restore'])
          .describe('Action to execute'),
        sipId: z.string().uuid().optional().describe('SIP Plan UUID'),
        name: z.string().min(1).max(100).optional().describe('SIP fund/asset name (e.g. Parag Parikh Flexi Cap)'),
        platform: z.string().optional().describe('Platform name (e.g. Zerodha Coin, Groww, INDmoney)'),
        assetClass: z.enum(['equity', 'debt', 'hybrid', 'gold', 'crypto', 'other']).optional(),
        monthlyAmount: z.number().positive().optional().describe('Monthly SIP installment amount in INR'),
        amount: z.number().positive().optional().describe('Installment amount override for log_installment'),
        sipDayOfMonth: z.number().int().min(1).max(31).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Installment date override for log_installment'),
        totalInvested: z.number().min(0).optional(),
        currentValue: z.number().min(0).optional().describe('Current portfolio valuation in INR'),
        expectedReturnAnnual: z.number().min(0).optional().describe('Expected CAGR annual return percentage'),
        accountId: z.string().uuid().optional().describe('Source bank/investment account UUID'),
        categoryId: z.string().uuid().optional(),
        isActive: z.boolean().optional(),
        includeArchived: z.boolean().optional().default(false),
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
      if (args.action === 'list') {
        const authRes = authorizeMcpTool('habitflow:finance:read');
        if (!authRes.ok) return authRes.response;
        return listObligationRows({
          table: 'finance_sip_plans',
          userId: authRes.auth.userId,
          includeArchived: args.includeArchived,
          orderCols: ['sip_day_of_month'],
          resultKey: 'sipPlans',
          errorLabel: 'SIP plans',
        });
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageSipWrite(authRes.auth, args);
    }
  );
}
