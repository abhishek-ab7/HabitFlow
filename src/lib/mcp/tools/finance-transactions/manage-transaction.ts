 
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
} from '../tool-helpers';
import { createTransactionRecord } from './create-transaction';
import {
  deleteTransactionRecord,
  resolveTransactionReview,
  restoreTransactionRecord,
  updateTransactionRecord,
} from './mutate-transaction';
import { splitTransactionWithFriend } from './split-transaction';

async function dispatchExistingTransactionAction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  if (args.action === 'delete') return deleteTransactionRecord(supabase, userId, existing, args);
  if (args.action === 'resolve_review') {
    return resolveTransactionReview(supabase, userId, existing, args.transactionId);
  }
  if (args.action === 'split_with_friend') {
    return splitTransactionWithFriend(supabase, userId, existing, args);
  }
  if (args.action === 'update') return updateTransactionRecord(supabase, userId, existing, args);
  return { error: `Unknown action: ${args.action}` };
}

async function dispatchTransactionAction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  auth: McpAuthContext,
  args: Record<string, any>
) {
  if (args.action === 'create') return createTransactionRecord(supabase, auth, args);
  if (!args.transactionId) return { error: 'Validation Error: transactionId is required.' };
  if (args.action === 'restore') return restoreTransactionRecord(supabase, auth.userId, args.transactionId);

  const { data: existing, error: fetchErr } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('id', args.transactionId)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !existing) return { error: `Transaction not found: ${args.transactionId}` };
  return dispatchExistingTransactionAction(supabase, auth.userId, existing, args);
}

async function handleManageTransaction(auth: McpAuthContext, args: Record<string, any>) {
  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const outcome = await dispatchTransactionAction(supabase, auth, args);
    if ('error' in outcome && outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_transaction',
      action: args.action,
      input: args,
      startMs,
      payload: 'payload' in outcome ? outcome.payload : null,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_transaction',
      action: args.action,
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage transaction',
    });
  }
}

export function registerManageTransactionTool(server: McpServer) {
  server.registerTool(
    'manage_transaction',
    {
      title: 'Manage Transaction',
      description:
        'Create, update, delete (soft-delete), restore, resolve review flag, or split an expense transaction with a friend. Automatically updates affected account balances and credit card cycles.',
      inputSchema: {
        action: z
          .enum(['create', 'update', 'delete', 'restore', 'split_with_friend', 'resolve_review'])
          .describe('Action to execute'),
        transactionId: z.string().uuid().optional().describe('Transaction UUID (required for update, delete, restore, split, resolve)'),
        title: z.string().min(1).max(255).optional().describe('Transaction title or description'),
        merchantName: z.string().optional().describe('Clean merchant/store name'),
        amount: z.number().positive().optional().describe('Transaction amount in INR'),
        type: z.enum(['expense', 'income', 'transfer', 'investment']).optional().describe('Transaction type'),
        categoryId: z.string().uuid().optional().describe('Category UUID'),
        subcategory: z.string().optional(),
        accountId: z.string().uuid().optional().describe('Source account UUID'),
        toAccountId: z.string().uuid().nullable().optional().describe('Destination account UUID for transfers'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Transaction date (YYYY-MM-DD, defaults to IST today)'),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isRecurring: z.boolean().optional(),
        recurrenceRule: z.string().nullable().optional(),
        needsReview: z.boolean().optional(),
        linkedCommitmentId: z.string().uuid().nullable().optional(),
        commitmentContributionType: z.enum(['direct_payment', 'offset_expense']).nullable().optional(),
        linkedDebtId: z.string().uuid().nullable().optional(),
        linkedEmiId: z.string().uuid().nullable().optional(),
        linkedSipId: z.string().uuid().nullable().optional(),
        isCreditCardPayment: z.boolean().optional(),
        paidStatementId: z.string().nullable().optional(),
        friendName: z.string().optional().describe('Friend name for split'),
        friendShareAmount: z.number().positive().optional().describe('Amount friend owes for their share'),
        friendBucketType: z.enum(['everyday_split', 'long_term_loan']).optional().default('everyday_split'),
        confirm: z.boolean().optional().describe('Confirmation flag required for destructive actions like delete'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageTransaction(authRes.auth, args);
    }
  );
}
