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
  resolveFallbackFinanceCategoryId,
} from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';
import { resolveTransactionCycle } from '@/lib/finance/credit-card-cycles';
import {
  mapFinanceCategoryFromRow,
  mapFinanceTransactionFromRow,
  mapMealLogFromRow,
  mapSupplementInventoryFromRow,
} from '../mappers';
import { classifyCategoryBridgeKind } from '@/lib/fitness/finance-bridge';
import { matchExpenseToSupplement } from '@/lib/fitness/supplement-meal-bridge';
import { findBestTransactionMealMatch } from '@/lib/fitness/meal-finance-matcher';

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
        includeDeleted: z.boolean().optional().default(false).describe('Include soft-deleted transactions'),
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
        .eq('user_id', auth.userId);
      if (!args.includeDeleted) {
        query = query.is('deleted_at', null);
      }

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

          const categoryId =
            args.categoryId ||
            (await resolveFallbackFinanceCategoryId(supabase, auth.userId, ['other', 'miscellaneous', 'food-dining']));

          const meta = getInsertMetadata();
          const newTx = {
            user_id: auth.userId,
            title: args.title.trim(),
            merchant_name: args.merchantName || null,
            raw_merchant: args.merchantName || null,
            amount: Number(args.amount),
            type: args.type,
            category_id: categoryId,
            subcategory: args.subcategory || null,
            account_id: args.accountId,
            to_account_id: args.type === 'transfer' ? args.toAccountId || null : null,
            date: txDate,
            month_key: monthKey,
            notes: args.notes || null,
            tags: args.tags || [],
            is_recurring: args.isRecurring ?? false,
            recurrence_rule: args.recurrenceRule || null,
            needs_review: args.needsReview ?? false,
            linked_commitment_id: args.linkedCommitmentId || null,
            commitment_contribution_type: args.commitmentContributionType || null,
            linked_debt_id: args.linkedDebtId || null,
            linked_emi_id: args.linkedEmiId || null,
            linked_sip_id: args.linkedSipId || null,
            is_credit_card_payment: args.isCreditCardPayment ?? false,
            paid_statement_id: args.paidStatementId || null,
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

          let autoSyncedSupplementCost: {
            supplementId: string;
            name: string;
            costInr: number;
          } | null = null;
          let autoLinkedMeal: { id: string; name: string; date: string } | null = null;

          if (args.type === 'expense' && hasScope(auth, 'habitflow:write')) {
            const { data: catRow } = await supabase
              .from('finance_categories')
              .select('*')
              .eq('user_id', auth.userId)
              .eq('id', categoryId)
              .maybeSingle();

            const mappedCat = catRow ? mapFinanceCategoryFromRow(catRow) : null;
            const bridgeKind = classifyCategoryBridgeKind(mappedCat);

            if (bridgeKind === 'health_supplements') {
              const { data: supRows } = await supabase
                .from('supplement_inventory')
                .select('*')
                .eq('user_id', auth.userId)
                .is('deleted_at', null);

              const mappedSups = (supRows || []).map(mapSupplementInventoryFromRow);
              const matchedSup = matchExpenseToSupplement(
                {
                  title: newTx.title,
                  merchantName: newTx.merchant_name,
                  notes: newTx.notes,
                },
                mappedSups
              );
              if (matchedSup && Number(matchedSup.costInr || 0) === 0) {
                const rawSup = (supRows || []).find((r: any) => r.id === matchedSup.id);
                const { error: supCostErr } = await supabase
                  .from('supplement_inventory')
                  .update({
                    cost_inr: Number(args.amount),
                    linked_transaction_id: data.id,
                    ...getUpdateMetadata(rawSup),
                  })
                  .eq('user_id', auth.userId)
                  .eq('id', matchedSup.id);
                if (!supCostErr) {
                  autoSyncedSupplementCost = {
                    supplementId: matchedSup.id,
                    name: matchedSup.name,
                    costInr: Number(args.amount),
                  };
                }
              }
            } else if (bridgeKind === 'food_dining' || bridgeKind === 'junk') {
              const { data: dayMeals } = await supabase
                .from('meal_logs')
                .select('*')
                .eq('user_id', auth.userId)
                .eq('date', txDate)
                .is('deleted_at', null);

              const mappedDayMeals = (dayMeals || []).map(mapMealLogFromRow);
              const mappedTx = mapFinanceTransactionFromRow(data);
              const mealMatch = findBestTransactionMealMatch(
                mappedTx,
                mappedDayMeals,
                mappedCat ? [mappedCat] : []
              );
              if (mealMatch && mealMatch.confidence === 'high') {
                const rawMeal = (dayMeals || []).find((m: any) => m.id === mealMatch.meal.id);
                const { error: linkErr } = await supabase
                  .from('meal_logs')
                  .update({
                    linked_transaction_id: data.id,
                    ...getUpdateMetadata(rawMeal),
                  })
                  .eq('user_id', auth.userId)
                  .eq('id', mealMatch.meal.id);
                if (!linkErr) {
                  autoLinkedMeal = {
                    id: mealMatch.meal.id,
                    name: mealMatch.meal.name,
                    date: mealMatch.meal.date,
                  };
                }
              }
            }
          }

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
                text: JSON.stringify(
                  {
                    action: 'created',
                    transaction: data,
                    updatedAccounts,
                    ...(autoSyncedSupplementCost ? { autoSyncedSupplementCost } : {}),
                    ...(autoLinkedMeal ? { autoLinkedMeal } : {}),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (!args.transactionId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: transactionId is required.' }] };
        }

        if (args.action === 'restore') {
          const { data: deletedTx, error: delFetchErr } = await supabase
            .from('finance_transactions')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.transactionId)
            .maybeSingle();

          if (delFetchErr || !deletedTx) {
            return { isError: true, content: [{ type: 'text', text: `Transaction not found: ${args.transactionId}` }] };
          }
          if (!deletedTx.deleted_at) {
            return { content: [{ type: 'text', text: JSON.stringify({ action: 'already_active', transaction: deletedTx }, null, 2) }] };
          }

          const restoreDeltas = calculateTransactionBalanceDeltas({
            amount: deletedTx.amount,
            type: deletedTx.type,
            account_id: deletedTx.account_id,
            to_account_id: deletedTx.to_account_id,
          });
          const updatedAccounts = await applyAccountBalanceDelta(supabase, auth.userId, restoreDeltas);

          const meta = getUpdateMetadata(deletedTx);
          const { data, error } = await supabase
            .from('finance_transactions')
            .update({ deleted_at: null, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.transactionId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_transaction',
            action: 'restore',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'restored', transaction: data, updatedAccounts }, null, 2),
              },
            ],
          };
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

          const cleanFriendName = args.friendName.trim();
          const friendLower = cleanFriendName.toLowerCase();
          const bucketType = args.friendBucketType || 'everyday_split';
          const userShare = Math.round((originalAmount - friendShare) * 100) / 100;
          const splitGroupId = existing.split_group_id || crypto.randomUUID();
          const existingTags = Array.isArray(existing.tags) ? existing.tags : [];

          const { data: userCategories } = await supabase
            .from('finance_categories')
            .select('id, slug, name')
            .eq('user_id', auth.userId)
            .is('deleted_at', null);

          const debtCat =
            (userCategories || []).find((c) => c.slug === 'emis-debt-repayment') ||
            (userCategories || []).find(
              (c) =>
                String(c.name || '').toLowerCase().includes('debt') ||
                String(c.name || '').toLowerCase().includes('emi')
            );
          const debtCatId = debtCat?.id || existing.category_id;

          // 1. Update original transaction to user's share
          const meta = getUpdateMetadata(existing);
          const { data: updatedOriginal } = await supabase
            .from('finance_transactions')
            .update({
              amount: userShare,
              split_group_id: splitGroupId,
              tags: Array.from(new Set([...existingTags, 'split', friendLower])),
              notes: `${existing.notes ? existing.notes + ' · ' : ''}Split with ${cleanFriendName} (Your share: ₹${userShare}, ${cleanFriendName} owes: ₹${friendShare})`.trim(),
              ...meta,
            })
            .eq('id', existing.id)
            .select()
            .single();

          // 2. Insert the 2nd Friend Split expense leg on the same account/cycle without changing account balance
          const friendLegMeta = getInsertMetadata();
          const { data: friendTransaction } = await supabase
            .from('finance_transactions')
            .insert({
              user_id: auth.userId,
              title: `${cleanFriendName}'s Share: ${existing.title}`,
              merchant_name: existing.merchant_name || null,
              raw_merchant: existing.raw_merchant || null,
              amount: friendShare,
              type: 'expense',
              category_id: debtCatId,
              subcategory: 'Friend Split',
              account_id: existing.account_id,
              date: existing.date,
              month_key: existing.month_key || String(existing.date).slice(0, 7),
              notes: `Friend split portion for ${cleanFriendName} · ${existing.title}`,
              tags: Array.from(new Set([...existingTags, 'split', friendLower, 'friend-share'])),
              is_recurring: false,
              needs_review: false,
              split_group_id: splitGroupId,
              statement_cycle_key: existing.statement_cycle_key ?? null,
              is_credit_card_payment: false,
              ...friendLegMeta,
            })
            .select()
            .single();

          // 3. Top up an existing active lent debt record for this friend/bucket, or create a new one
          const { data: existingDebts } = await supabase
            .from('debt_records')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('bucket_type', bucketType)
            .eq('direction', 'lent')
            .eq('status', 'active')
            .is('deleted_at', null);

          const matchingDebt = (existingDebts || []).find(
            (d) => String(d.person_name || '').trim().toLowerCase() === friendLower
          );

          let debtRecord = null;
          if (matchingDebt) {
            const nextPrincipal = Math.round((Number(matchingDebt.principal_amount || 0) + friendShare) * 100) / 100;
            const nextRemaining = Math.round((Number(matchingDebt.remaining_amount || 0) + friendShare) * 100) / 100;
            const debtUpdateMeta = getUpdateMetadata(matchingDebt);
            const { data: toppedUp } = await supabase
              .from('debt_records')
              .update({
                principal_amount: nextPrincipal,
                remaining_amount: nextRemaining,
                notes: matchingDebt.notes
                  ? `${matchingDebt.notes}\nSplit: ${existing.title} (+₹${friendShare})`
                  : `Split: ${existing.title} (+₹${friendShare})`,
                ...debtUpdateMeta,
              })
              .eq('id', matchingDebt.id)
              .select()
              .single();
            debtRecord = toppedUp;
          } else {
            const debtMeta = getInsertMetadata();
            const { data: createdDebt } = await supabase
              .from('debt_records')
              .insert({
                user_id: auth.userId,
                person_name: cleanFriendName,
                direction: 'lent',
                bucket_type: bucketType,
                title: `Everyday Split: ${existing.title}`,
                principal_amount: friendShare,
                total_repaid_amount: 0,
                remaining_amount: friendShare,
                start_date: existing.date,
                repayment_schedule: 'flexible',
                status: 'active',
                notes: `Split from transaction "${existing.title}" on ${existing.date}`,
                ...debtMeta,
              })
              .select()
              .single();
            debtRecord = createdDebt;
          }

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
                    friendTransaction,
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
          if (args.recurrenceRule !== undefined) updates.recurrence_rule = args.recurrenceRule;
          if (args.needsReview !== undefined) updates.needs_review = args.needsReview;
          if (args.linkedCommitmentId !== undefined) updates.linked_commitment_id = args.linkedCommitmentId;
          if (args.commitmentContributionType !== undefined) {
            updates.commitment_contribution_type = args.commitmentContributionType;
          }
          if (args.linkedDebtId !== undefined) updates.linked_debt_id = args.linkedDebtId;
          if (args.linkedEmiId !== undefined) updates.linked_emi_id = args.linkedEmiId;
          if (args.linkedSipId !== undefined) updates.linked_sip_id = args.linkedSipId;
          if (args.isCreditCardPayment !== undefined) updates.is_credit_card_payment = args.isCreditCardPayment;
          if (args.paidStatementId !== undefined) updates.paid_statement_id = args.paidStatementId;

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

          if (args.date !== undefined || accountChanged) {
            const targetAccId = args.accountId ?? existing.account_id;
            const targetDate = args.date ?? existing.date;
            const { data: targetAcc } = await supabase
              .from('finance_accounts')
              .select('type, billing_day, statement_day, due_day')
              .eq('user_id', auth.userId)
              .eq('id', targetAccId)
              .maybeSingle();

            if (targetAcc?.type === 'credit_card') {
              const billingDay = targetAcc.billing_day || targetAcc.statement_day || 15;
              const dueDay = targetAcc.due_day || 5;
              updates.statement_cycle_key = resolveTransactionCycle(targetDate, billingDay, dueDay);
            } else {
              updates.statement_cycle_key = null;
            }
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
