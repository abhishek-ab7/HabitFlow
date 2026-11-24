import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate } from '../config';
import {
  getInsertMetadata,
  getUpdateMetadata,
  getSoftDeleteMetadata,
  applyAccountBalanceDelta,
  calculateTransactionBalanceDeltas,
  calculateReversedTransactionBalanceDeltas,
} from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';
import { resolveTransactionCycle } from '@/lib/finance/credit-card-cycles';

export function registerFinanceTransactionsTools(server: McpServer) {
  // 19. get_transactions
  server.registerTool(
    'get_transactions',
    {
      title: 'Get Transactions',
      description:
        'Query financial transactions with multi-dimensional filtering (date ranges, month, type, category, account, tags, review flags, or text search).',
      inputSchema: {
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter on/after date (YYYY-MM-DD)'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter on/before date (YYYY-MM-DD)'),
        monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Filter by month key (YYYY-MM)'),
        type: z.enum(['expense', 'income', 'transfer', 'investment']).optional(),
        categoryId: z.string().uuid().optional(),
        accountId: z.string().uuid().optional(),
        search: z.string().optional().describe('Text search across title, merchant, and notes'),
        tag: z.string().optional(),
        needsReview: z.boolean().optional(),
        splitGroupId: z.string().uuid().optional(),
        statementCycleKey: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:finance:read')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
      }

      const supabase = getSupabaseAdmin();
      let query = supabase
        .from('finance_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', auth.userId)
        .is('deleted_at', null);

      if (args.startDate) query = query.gte('date', args.startDate);
      if (args.endDate) query = query.lte('date', args.endDate);
      if (args.monthKey) query = query.eq('month_key', args.monthKey);
      if (args.type) query = query.eq('type', args.type);
      if (args.categoryId) query = query.eq('category_id', args.categoryId);
      if (args.accountId) query = query.eq('account_id', args.accountId);
      if (args.needsReview !== undefined) query = query.eq('needs_review', args.needsReview);
      if (args.splitGroupId) query = query.eq('split_group_id', args.splitGroupId);
      if (args.statementCycleKey) query = query.eq('statement_cycle_key', args.statementCycleKey);
      if (args.search) {
        query = query.or(
          `title.ilike.%${args.search}%,merchant_name.ilike.%${args.search}%,notes.ilike.%${args.search}%`
        );
      }

      query = query
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(args.offset || 0, (args.offset || 0) + (args.limit || 50) - 1);

      const { data, count, error } = await query;
      if (error) {
        return { isError: true, content: [{ type: 'text', text: `Failed to fetch transactions: ${error.message}` }] };
      }

      let filtered = data || [];
      if (args.tag) {
        filtered = filtered.filter((t) => Array.isArray(t.tags) && t.tags.includes(args.tag));
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalCount: count ?? filtered.length,
                returnedCount: filtered.length,
                transactions: filtered,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 20. manage_transaction
  server.registerTool(
    'manage_transaction',
    {
      title: 'Manage Transaction',
      description:
        'Create, update, delete (soft-delete), resolve review flag, or split an expense transaction with a friend. Automatically updates affected account balances and credit card cycles.',
      inputSchema: {
        action: z
          .enum(['create', 'update', 'delete', 'split_with_friend', 'resolve_review'])
          .describe('Action to execute'),
        transactionId: z.string().uuid().optional().describe('Transaction UUID (required for update, delete, split, resolve)'),
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
        needsReview: z.boolean().optional(),
        linkedCommitmentId: z.string().uuid().nullable().optional(),
        commitmentContributionType: z.enum(['direct_payment', 'offset_expense']).nullable().optional(),
        // Split with friend fields
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
      const auth = getMcpAuthContext();
      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }

      const start = Date.now();
      const supabase = getSupabaseAdmin();

      try {
        if (args.action === 'create') {
          if (!args.title || args.amount === undefined || !args.type || !args.accountId) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Validation Error: title, amount, type, and accountId are required for create action.',
                },
              ],
            };
          }

          const txDate = args.date || getIstIsoDate();
          const monthKey = txDate.substring(0, 7);

          // Check if source account is a credit card to resolve cycle key
          let statementCycleKey: string | null = null;
          const { data: sourceAccount } = await supabase
            .from('finance_accounts')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.accountId)
            .single();

          if (sourceAccount && sourceAccount.type === 'credit_card') {
            const billingDay = sourceAccount.billing_day || sourceAccount.statement_day || 15;
            const dueDay = sourceAccount.due_day || 5;
            statementCycleKey = resolveTransactionCycle(txDate, billingDay, dueDay);
          }

          const meta = getInsertMetadata();
          const newTx = {
            user_id: auth.userId,
            title: args.title.trim(),
            merchant_name: args.merchantName || null,
            raw_merchant: args.merchantName || null,
            amount: Number(args.amount),
            type: args.type,
            category_id: args.categoryId || null,
            subcategory: args.subcategory || null,
            account_id: args.accountId,
            to_account_id: args.type === 'transfer' ? args.toAccountId || null : null,
            date: txDate,
            month_key: monthKey,
            notes: args.notes || null,
            tags: args.tags || [],
            is_recurring: args.isRecurring ?? false,
            needs_review: args.needsReview ?? false,
            linked_commitment_id: args.linkedCommitmentId || null,
            commitment_contribution_type: args.commitmentContributionType || null,
            statement_cycle_key: statementCycleKey,
            ...meta,
          };

          const { data, error } = await supabase.from('finance_transactions').insert(newTx).select().single();
          if (error) throw error;

          // Apply balance deltas to accounts
          const deltas = calculateTransactionBalanceDeltas({
            amount: newTx.amount,
            type: newTx.type,
            account_id: newTx.account_id,
            to_account_id: newTx.to_account_id,
          });
          const updatedAccounts = await applyAccountBalanceDelta(supabase, auth.userId, deltas);

          await logMcpToolInvocation(auth, {
            toolName: 'manage_transaction',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'created', transaction: data, updatedAccounts }, null, 2),
              },
            ],
          };
        }

        if (!args.transactionId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: transactionId is required.' }] };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('finance_transactions')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.transactionId)
          .is('deleted_at', null)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `Transaction not found: ${args.transactionId}` }] };
        }

        if (args.action === 'delete') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Confirmation Required: Deleting this transaction reverses its account balance changes and requires confirm: true.',
                },
              ],
            };
          }

          // Reverse account balance impact
          const reverseDeltas = calculateReversedTransactionBalanceDeltas({
            amount: existing.amount,
            type: existing.type,
            account_id: existing.account_id,
            to_account_id: existing.to_account_id,
          });
          const updatedAccounts = await applyAccountBalanceDelta(supabase, auth.userId, reverseDeltas);

          const meta = getSoftDeleteMetadata(existing);
          const { data, error } = await supabase
            .from('finance_transactions')
            .update({ ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.transactionId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_transaction',
            action: 'delete',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'deleted', transaction: data, updatedAccounts }, null, 2),
              },
            ],
          };
        }

        if (args.action === 'resolve_review') {
          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_transactions')
            .update({ needs_review: false, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.transactionId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_transaction',
            action: 'resolve_review',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'review_resolved', transaction: data }, null, 2) }] };
        }

        if (args.action === 'split_with_friend') {
          if (!args.friendName || !args.friendShareAmount) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Validation Error: friendName and friendShareAmount are required for split_with_friend.',
                },
              ],
            };
          }

          const originalAmount = Number(existing.amount);
          const friendShare = Number(args.friendShareAmount);
          if (friendShare >= originalAmount) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Friend share amount must be less than the total transaction amount.' }],
            };
          }

          const userShare = Math.round((originalAmount - friendShare) * 100) / 100;
          const splitGroupId = existing.split_group_id || crypto.randomUUID();

          // Update original transaction to user's share
          const meta = getUpdateMetadata(existing);
          const { data: updatedOriginal } = await supabase
            .from('finance_transactions')
            .update({
              amount: userShare,
              split_group_id: splitGroupId,
              notes: `${existing.notes || ''} [Split with ${args.friendName}: User share ₹${userShare}]`.trim(),
              ...meta,
            })
            .eq('id', existing.id)
            .select()
            .single();

          // Create a debt record for friend's share (lent to friend)
          const debtMeta = getInsertMetadata();
          const { data: debtRecord } = await supabase
            .from('debt_records')
            .insert({
              user_id: auth.userId,
              person_name: args.friendName.trim(),
              direction: 'lent',
              bucket_type: args.friendBucketType || 'everyday_split',
              title: `Split: ${existing.title}`,
              principal_amount: friendShare,
              total_repaid_amount: 0,
              remaining_amount: friendShare,
              start_date: existing.date,
              repayment_schedule: 'full_on_date',
              status: 'active',
              notes: `Split from transaction "${existing.title}"`,
              ...debtMeta,
            })
            .select()
            .single();

          await logMcpToolInvocation(auth, {
            toolName: 'manage_transaction',
            action: 'split_with_friend',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    action: 'split_completed',
                    userShare,
                    friendShare,
                    splitGroupId,
                    updatedTransaction: updatedOriginal,
                    createdDebtRecord: debtRecord,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (args.action === 'update') {
          const updates: Record<string, any> = {};
          if (args.title !== undefined) updates.title = args.title.trim();
          if (args.merchantName !== undefined) {
            updates.merchant_name = args.merchantName;
            updates.raw_merchant = args.merchantName;
          }
          if (args.categoryId !== undefined) updates.category_id = args.categoryId;
          if (args.subcategory !== undefined) updates.subcategory = args.subcategory;
          if (args.notes !== undefined) updates.notes = args.notes;
          if (args.tags !== undefined) updates.tags = args.tags;
          if (args.isRecurring !== undefined) updates.is_recurring = args.isRecurring;
          if (args.needsReview !== undefined) updates.needs_review = args.needsReview;
          if (args.linkedCommitmentId !== undefined) updates.linked_commitment_id = args.linkedCommitmentId;
          if (args.commitmentContributionType !== undefined) {
            updates.commitment_contribution_type = args.commitmentContributionType;
          }

          let updatedAccounts: any[] = [];
          const amountChanged = args.amount !== undefined && args.amount !== existing.amount;
          const accountChanged = args.accountId !== undefined && args.accountId !== existing.account_id;
          const typeChanged = args.type !== undefined && args.type !== existing.type;
          const toAccountChanged = args.toAccountId !== undefined && args.toAccountId !== existing.to_account_id;

          if (amountChanged || accountChanged || typeChanged || toAccountChanged) {
            // Reverse old balance
            const revDeltas = calculateReversedTransactionBalanceDeltas({
              amount: existing.amount,
              type: existing.type,
              account_id: existing.account_id,
              to_account_id: existing.to_account_id,
            });
            await applyAccountBalanceDelta(supabase, auth.userId, revDeltas);

            // Apply new balance
            const newAmount = args.amount !== undefined ? args.amount : existing.amount;
            const newType = args.type !== undefined ? args.type : existing.type;
            const newAccId = args.accountId !== undefined ? args.accountId : existing.account_id;
            const newToAccId = args.toAccountId !== undefined ? args.toAccountId : existing.to_account_id;

            const newDeltas = calculateTransactionBalanceDeltas({
              amount: newAmount,
              type: newType,
              account_id: newAccId,
              to_account_id: newToAccId,
            });
            updatedAccounts = await applyAccountBalanceDelta(supabase, auth.userId, newDeltas);

            if (args.amount !== undefined) updates.amount = args.amount;
            if (args.type !== undefined) updates.type = args.type;
            if (args.accountId !== undefined) updates.account_id = args.accountId;
            if (args.toAccountId !== undefined) updates.to_account_id = args.toAccountId;
          }

          if (args.date !== undefined) {
            updates.date = args.date;
            updates.month_key = args.date.substring(0, 7);
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_transactions')
            .update({ ...updates, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.transactionId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_transaction',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'updated', transaction: data, updatedAccounts }, null, 2),
              },
            ],
          };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_transaction',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage transaction: ${err.message}` }] };
      }
    }
  );
}
