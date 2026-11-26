import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';

const ACCOUNT_UPDATE_COLUMNS = [
  ['type', 'type'],
  ['balance', 'balance'],
  ['creditLimit', 'credit_limit'],
  ['statementDay', 'statement_day'],
  ['dueDay', 'due_day'],
  ['gracePeriodDays', 'grace_period_days'],
  ['includeInNetWorth', 'include_in_net_worth'],
  ['currency', 'currency'],
  ['icon', 'icon'],
  ['color', 'color'],
  ['isDefault', 'is_default'],
] as const;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

async function listFinanceAccounts(userId: string, includeArchived?: boolean) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('finance_accounts').select('*').eq('user_id', userId);
  if (!includeArchived) query = query.is('deleted_at', null).eq('is_archived', false);
  const { data, error } = await query.order('name');
  if (error) return mcpError(`Failed to fetch accounts: ${error.message}`);
  return mcpJson({ count: (data || []).length, accounts: data });
}

function buildNewAccountRow(userId: string, args: Record<string, unknown>) {
  return {
    user_id: userId,
    name: String(args.name).trim(),
    type: args.type,
    balance: orVal(args.balance, 0),
    credit_limit: orVal(args.creditLimit, 0),
    billing_day: orVal(args.statementDay, null),
    statement_day: orVal(args.statementDay, null),
    due_day: orVal(args.dueDay, null),
    grace_period_days: orVal(args.gracePeriodDays, 20),
    include_in_net_worth: orVal(args.includeInNetWorth, true),
    currency: orVal(args.currency, 'INR'),
    icon: orVal(args.icon, 'Landmark'),
    color: orVal(args.color, '#10b981'),
    is_default: orVal(args.isDefault, false),
    is_archived: false,
    ...getInsertMetadata(),
  };
}

async function createFinanceAccount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.name || !args.type) {
    return { error: 'Validation Error: name and type are required for create.' };
  }
  const { data, error } = await supabase
    .from('finance_accounts')
    .insert(buildNewAccountRow(userId, args))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', account: data } };
}

async function patchFinanceAccount(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  accountId: string;
  patch: Record<string, unknown>;
}) {
  const { data, error } = await params.supabase
    .from('finance_accounts')
    .update(params.patch)
    .eq('user_id', params.userId)
    .eq('id', params.accountId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

type AccountMutationCtx = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, unknown>;
  args: Record<string, unknown>;
};

const ACCOUNT_MUTATION_HANDLERS: Record<
  string,
  (ctx: AccountMutationCtx) => Promise<{ error?: string; payload?: unknown }>
> = {
  archive: async ({ supabase, userId, existing, args }) => {
    if (!args.confirm) {
      return { error: 'Confirmation Required: Archiving this account requires confirm: true in tool arguments.' };
    }
    const account = await patchFinanceAccount({
      supabase,
      userId,
      accountId: String(args.accountId),
      patch: { is_archived: true, ...getSoftDeleteMetadata(existing) },
    });
    return { payload: { action: 'archived', account } };
  },
  restore: async ({ supabase, userId, existing, args }) => {
    const account = await patchFinanceAccount({
      supabase,
      userId,
      accountId: String(args.accountId),
      patch: { is_archived: false, deleted_at: null, ...getUpdateMetadata(existing) },
    });
    return { payload: { action: 'restored', account } };
  },
  reconcile_balance: async ({ supabase, userId, existing, args }) => {
    if (args.balance === undefined) {
      return { error: 'Validation Error: balance is required for reconcile_balance.' };
    }
    const previousBalance = Number(existing.balance || 0);
    const newBalance = Number(args.balance);
    const account = await patchFinanceAccount({
      supabase,
      userId,
      accountId: String(args.accountId),
      patch: { balance: newBalance, ...getUpdateMetadata(existing) },
    });
    return {
      payload: {
        action: 'reconciled',
        accountId: args.accountId,
        previousBalance,
        newBalance,
        account,
      },
    };
  },
  update: async ({ supabase, userId, existing, args }) => {
    const updates = pickDefinedColumns(args, ACCOUNT_UPDATE_COLUMNS);
    if (args.name !== undefined) updates.name = String(args.name).trim();
    if (args.statementDay !== undefined) updates.billing_day = args.statementDay;
    const account = await patchFinanceAccount({
      supabase,
      userId,
      accountId: String(args.accountId),
      patch: { ...updates, ...getUpdateMetadata(existing) },
    });
    return { payload: { action: 'updated', account } };
  },
};

async function mutateExistingAccount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.accountId) return { error: 'Validation Error: accountId is required.' };
  const handler = ACCOUNT_MUTATION_HANDLERS[String(args.action)];
  if (!handler) return { error: `Unknown action: ${args.action}` };

  const { data: existing, error: fetchErr } = await supabase
    .from('finance_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('id', String(args.accountId))
    .single();
  if (fetchErr || !existing) return { error: `Account not found: ${args.accountId}` };

  return handler({ supabase, userId, existing, args });
}

async function handleManageAccountWrite(auth: McpAuthContext, args: Record<string, unknown>) {
  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const outcome =
      args.action === 'create'
        ? await createFinanceAccount(supabase, auth.userId, args)
        : await mutateExistingAccount(supabase, auth.userId, args);
    if (outcome.error) return mcpError(outcome.error);

    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_finance_account',
      action: String(args.action),
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_finance_account',
      action: String(args.action),
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage account',
    });
  }
}

export function registerManageFinanceAccountTool(server: McpServer) {
  server.registerTool(
    'manage_finance_account',
    {
      title: 'Manage Finance Account',
      description:
        'List accounts, create new accounts, update details, reconcile current balance, archive (soft-delete), or restore an account.',
      inputSchema: {
        action: z
          .enum(['list', 'create', 'update', 'reconcile_balance', 'archive', 'restore'])
          .describe('Action to perform'),
        accountId: z.string().uuid().optional().describe('Account UUID (required for update, reconcile, archive, restore)'),
        name: z.string().min(1).max(100).optional().describe('Account name (e.g. HDFC Salary, SBI UPI, ICICI Coral CC)'),
        type: z
          .enum(['bank', 'upi', 'cash', 'wallet', 'credit_card', 'investment'])
          .optional()
          .describe('Account type'),
        balance: z.number().optional().describe('Account balance in INR'),
        creditLimit: z.number().optional().describe('Credit limit in INR (for credit card accounts)'),
        statementDay: z.number().int().min(1).max(31).optional().describe('Statement generation day (credit card)'),
        dueDay: z.number().int().min(1).max(31).optional().describe('Payment due day (credit card)'),
        gracePeriodDays: z.number().int().min(0).max(60).optional().describe('Grace period days (credit card)'),
        includeInNetWorth: z.boolean().optional().describe('Whether balance is factored into total net worth'),
        currency: z.string().optional().default('INR'),
        isDefault: z.boolean().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        includeArchived: z.boolean().optional().default(false).describe('Include archived/deleted accounts when listing'),
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
        return listFinanceAccounts(authRes.auth.userId, args.includeArchived);
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageAccountWrite(authRes.auth, args);
    }
  );
}
