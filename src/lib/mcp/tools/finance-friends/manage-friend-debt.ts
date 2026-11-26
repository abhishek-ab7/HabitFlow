 
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
} from '../tool-helpers';
import {
  archiveDebtEntry,
  createDebtEntry,
  restoreDebtEntry,
  settleDebtBucket,
  updateDebtEntry,
} from './debt-entries';
import { mutateInstallmentRecord, recordDebtPayment } from './debt-payments';

const INSTALLMENT_ACTIONS = new Set(['update_payment', 'delete_payment', 'restore_payment']);

async function listDebtPayments(userId: string, args: Record<string, any>) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('debt_installments').select('*').eq('user_id', userId);
  if (args.debtId) query = query.eq('debt_id', args.debtId);
  if (!args.includeDeleted) query = query.is('deleted_at', null);
  const { data, error } = await query.order('date', { ascending: false });
  if (error) return mcpError(`Failed to fetch installments: ${error.message}`);
  return mcpJson({ count: (data || []).length, installments: data || [] });
}

async function dispatchDebtActionById(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  args: Record<string, any>,
  dateIst: string
) {
  if (!args.debtId) return { error: 'Validation Error: debtId is required.' };
  const { data: existing, error: fetchErr } = await supabase
    .from('debt_records')
    .select('*')
    .eq('user_id', userId)
    .eq('id', args.debtId)
    .single();
  if (fetchErr || !existing) return { error: `Debt record not found: ${args.debtId}` };

  switch (args.action) {
    case 'archive_entry':
      return archiveDebtEntry(supabase, existing, args);
    case 'restore_entry':
      return restoreDebtEntry(supabase, userId, existing, args.debtId);
    case 'record_payment':
      return recordDebtPayment({ supabase, userId, existing, args, dateIst });
    case 'update_entry':
      return updateDebtEntry(supabase, existing, args);
    default:
      return { error: `Unknown action: ${args.action}` };
  }
}

async function handleManageFriendDebt(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const dateIst = args.paymentDate || getIstIsoDate();
  const supabase = getSupabaseAdmin();

  try {
    let outcome: { error?: string; payload?: unknown };
    if (args.action === 'create_entry') {
      outcome = await createDebtEntry(supabase, auth.userId, args, dateIst);
    } else if (args.action === 'settle_bucket') {
      outcome = await settleDebtBucket(supabase, auth.userId, args, dateIst);
    } else if (INSTALLMENT_ACTIONS.has(args.action)) {
      outcome = await mutateInstallmentRecord(supabase, auth.userId, args);
    } else {
      outcome = await dispatchDebtActionById(supabase, auth.userId, args, dateIst);
    }

    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_friend_debt',
      action: args.action,
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_friend_debt',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage debt',
    });
  }
}

export function registerManageFriendDebtTool(server: McpServer) {
  server.registerTool(
    'manage_friend_debt',
    {
      title: 'Manage Friend Debt & Installments',
      description:
        'Create/update/archive/restore friend debt entries in isolated buckets (Everyday Tab vs Long-Term Loan), settle buckets, and full CRUD on debt installments (list_payments, record_payment, update_payment, delete_payment, restore_payment).',
      inputSchema: {
        action: z
          .enum([
            'create_entry',
            'update_entry',
            'record_payment',
            'settle_bucket',
            'archive_entry',
            'restore_entry',
            'list_payments',
            'update_payment',
            'delete_payment',
            'restore_payment',
          ])
          .describe('Action to execute'),
        debtId: z.string().uuid().optional().describe('Debt record UUID'),
        installmentId: z.string().uuid().optional().describe('Installment UUID (required for update_payment, delete_payment, restore_payment)'),
        personName: z.string().min(1).max(100).optional().describe('Friend name'),
        contactInfo: z.string().nullable().optional().describe('Friend phone/UPI/contact note'),
        direction: z.enum(['borrowed', 'lent']).optional().describe('Debt direction (borrowed from friend, or lent to friend)'),
        bucketType: z
          .enum(['everyday_split', 'long_term_loan'])
          .optional()
          .describe('Isolated bucket: everyday split tab or long-term loan'),
        title: z.string().min(1).max(255).optional().describe('Description/reason for debt'),
        principalAmount: z.number().positive().optional().describe('Principal amount in INR'),
        repaymentSchedule: z.enum(['full_on_date', 'monthly_partial', 'flexible']).optional(),
        targetSettlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        plannedMonthlyInstallment: z.number().min(0).nullable().optional(),
        dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
        color: z.string().optional(),
        includeDeleted: z.boolean().optional().default(false).describe('Include soft-deleted installments in list_payments'),
        paymentAmount: z.number().positive().optional().describe('Repayment amount in INR'),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Payment date (YYYY-MM-DD, defaults to IST today)'),
        linkedAccountId: z.string().uuid().optional().describe('Bank/UPI account UUID if payment flowed through an account'),
        paymentMethod: z.string().optional().default('upi'),
        notes: z.string().nullable().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for destructive actions like settle_bucket, archive_entry, delete_payment'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      if (args.action === 'list_payments') {
        const authRes = authorizeMcpTool('habitflow:finance:read');
        if (!authRes.ok) return authRes.response;
        return listDebtPayments(authRes.auth.userId, args);
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageFriendDebt(authRes.auth, args);
    }
  );
}
