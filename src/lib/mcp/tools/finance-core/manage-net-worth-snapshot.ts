import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate, getIstMonthKey } from '../../config';
import { getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import {
  mapDebtRecordFromRow,
  mapEmiTrackerFromRow,
  mapFinanceAccountFromRow,
  mapFinanceSipPlanFromRow,
} from '../../mappers';
import { calculateNetWorthSummary } from '@/lib/finance/shared-analytics';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';

const SNAPSHOT_UPDATE_COLUMNS = [
  ['snapshotDate', 'snapshot_date'],
  ['totalAssets', 'total_assets'],
  ['totalLiabilities', 'total_liabilities'],
  ['netWorth', 'net_worth'],
  ['liquidAssets', 'liquid_assets'],
  ['investmentAssets', 'investment_assets'],
  ['creditCardLiabilities', 'credit_card_liabilities'],
  ['emiRemainingPrincipal', 'emi_remaining_principal'],
  ['friendReceivables', 'friend_receivables'],
  ['friendPayables', 'friend_payables'],
] as const;

type UserId = string;
type MonthKey = string;

async function listNetWorthSnapshots(userId: UserId, args: { includeDeleted?: boolean; months?: number }) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('finance_net_worth_snapshots').select('*').eq('user_id', userId);
  if (!args.includeDeleted) query = query.is('deleted_at', null);
  const { data, error } = await query.order('month_key', { ascending: false }).limit(args.months || 6);
  if (error) return mcpError(`Failed to fetch net worth history: ${error.message}`);
  return mcpJson({ count: (data || []).length, snapshots: data });
}

function buildNetWorthRowFields(nw: ReturnType<typeof calculateNetWorthSummary>, snapshotDate: string) {
  return {
    snapshot_date: snapshotDate,
    total_assets: nw.totalAssets,
    total_liabilities: nw.totalLiabilities,
    net_worth: nw.netWorth,
    liquid_assets: nw.liquidAssets,
    investment_assets: nw.investmentAssets,
    credit_card_liabilities: nw.creditCardLiabilities,
    emi_remaining_principal: nw.emiRemainingPrincipal,
    friend_receivables: nw.friendReceivables,
    friend_payables: nw.friendPayables,
  };
}

async function upsertSnapshotRow(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: UserId;
  monthKey: MonthKey;
  existing: Record<string, unknown> | null;
  nwFields: Record<string, unknown>;
}) {
  const { supabase, userId, monthKey, existing, nwFields } = params;
  const { data, error } = existing
    ? await supabase
        .from('finance_net_worth_snapshots')
        .update({ ...nwFields, deleted_at: null, ...getUpdateMetadata(existing) })
        .eq('id', existing.id)
        .select()
        .single()
    : await supabase
        .from('finance_net_worth_snapshots')
        .insert({ user_id: userId, month_key: monthKey, ...nwFields, ...getInsertMetadata() })
        .select()
        .single();
  if (error) throw error;
  return data;
}

async function captureNetWorthSnapshot(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  monthKey: MonthKey,
  snapshotDate: string
): Promise<{ payload: unknown }> {
  const [{ data: accounts }, { data: sips }, { data: debts }, { data: emis }] = await Promise.all([
    supabase.from('finance_accounts').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('finance_sip_plans').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('debt_records').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('emi_trackers').select('*').eq('user_id', userId).is('deleted_at', null),
  ]);

  const nw = calculateNetWorthSummary({
    accounts: (accounts || []).map(mapFinanceAccountFromRow),
    sipPlans: (sips || []).map(mapFinanceSipPlanFromRow),
    debtRecords: (debts || []).map(mapDebtRecordFromRow),
    emiTrackers: (emis || []).map(mapEmiTrackerFromRow),
  });

  const { data: existing } = await supabase
    .from('finance_net_worth_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .maybeSingle();

  const snapshot = await upsertSnapshotRow({
    supabase,
    userId,
    monthKey,
    existing,
    nwFields: buildNetWorthRowFields(nw, snapshotDate),
  });
  return { payload: { action: 'captured', snapshot } };
}

function buildSnapshotMutationPatch(existing: Record<string, unknown>, args: Record<string, unknown>) {
  if (args.action === 'delete') return { actionLabel: 'deleted', patch: getSoftDeleteMetadata(existing) };
  if (args.action === 'restore') {
    return { actionLabel: 'restored', patch: { deleted_at: null, ...getUpdateMetadata(existing) } };
  }
  return {
    actionLabel: 'updated',
    patch: { ...pickDefinedColumns(args, SNAPSHOT_UPDATE_COLUMNS), ...getUpdateMetadata(existing) },
  };
}

async function fetchTargetSnapshot(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  monthKey: MonthKey,
  snapshotId?: unknown
) {
  const baseQuery = supabase.from('finance_net_worth_snapshots').select('*').eq('user_id', userId);
  const query = snapshotId ? baseQuery.eq('id', String(snapshotId)) : baseQuery.eq('month_key', monthKey);
  const { data: existing, error: fetchErr } = await query.maybeSingle();
  if (fetchErr) throw fetchErr;
  return existing;
}

async function updateSnapshotRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  snapshotId: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('finance_net_worth_snapshots')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', snapshotId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function mutateNetWorthSnapshot(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  monthKey: MonthKey,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (args.action === 'delete' && !args.confirm) {
    return { error: 'Confirmation Required: Deleting snapshot requires confirm: true.' };
  }

  const existing = await fetchTargetSnapshot(supabase, userId, monthKey, args.snapshotId);
  if (!existing) return { error: `Net worth snapshot not found for ${args.snapshotId || monthKey}` };

  const { actionLabel, patch } = buildSnapshotMutationPatch(existing, args);
  const snapshot = await updateSnapshotRow(supabase, userId, existing.id, patch);
  return { payload: { action: actionLabel, snapshot } };
}

async function handleManageSnapshotWrite(auth: McpAuthContext, args: Record<string, unknown>) {
  const startMs = Date.now();
  const monthKey = String(args.monthKey || getIstMonthKey());
  const supabase = getSupabaseAdmin();

  try {
    const outcome: { error?: string; payload?: unknown } =
      args.action === 'capture'
        ? await captureNetWorthSnapshot(supabase, auth.userId, monthKey, String(args.snapshotDate || getIstIsoDate()))
        : await mutateNetWorthSnapshot(supabase, auth.userId, monthKey, args);
    if (outcome.error) return mcpError(outcome.error);

    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_net_worth_snapshot',
      action: String(args.action),
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_net_worth_snapshot',
      action: String(args.action),
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage net worth snapshot',
    });
  }
}

export function registerManageNetWorthSnapshotTool(server: McpServer) {
  server.registerTool(
    'manage_net_worth_snapshot',
    {
      title: 'Manage Net Worth Snapshots',
      description:
        'List historical monthly net worth snapshots, capture a fresh snapshot for any month, manually update a snapshot, soft-delete, or restore a snapshot.',
      inputSchema: {
        action: z.enum(['list', 'capture', 'update', 'delete', 'restore']).describe('Action to perform'),
        snapshotId: z.string().uuid().optional().describe('Optional snapshot UUID for update/delete/restore'),
        months: z.number().int().min(1).max(24).optional().default(6).describe('Number of historical months for list'),
        includeDeleted: z.boolean().optional().default(false),
        monthKey: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM').optional().describe('Month key (defaults to current month in IST)'),
        snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Override snapshot date (YYYY-MM-DD)'),
        totalAssets: z.number().optional(),
        totalLiabilities: z.number().optional(),
        netWorth: z.number().optional(),
        liquidAssets: z.number().optional(),
        investmentAssets: z.number().optional(),
        creditCardLiabilities: z.number().optional(),
        emiRemainingPrincipal: z.number().optional(),
        friendReceivables: z.number().optional(),
        friendPayables: z.number().optional(),
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
      if (args.action === 'list') {
        const authRes = authorizeMcpTool('habitflow:finance:read');
        if (!authRes.ok) return authRes.response;
        return listNetWorthSnapshots(authRes.auth.userId, args);
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageSnapshotWrite(authRes.auth, args);
    }
  );
}
