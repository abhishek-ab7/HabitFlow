import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate } from '../config';
import {
  getInsertMetadata,
  getSoftDeleteMetadata,
  getUpdateMetadata,
  applyAccountBalanceDelta,
  resolveFallbackFinanceCategoryId,
} from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';
import {
  mapCreditCardStatementFromRow,
  mapFinanceAccountFromRow,
  mapFinanceTransactionFromRow,
} from '../mappers';
import {
  computeCreditCardSummary,
  allocatePaymentToStatements,
  getCycleWindowForMonth,
  resolveCardBillingConfig,
  resolveTransactionCycle,
  roundCurrency,
} from '@/lib/finance/credit-card-cycles';

export function registerFinanceCreditCardsTools(server: McpServer) {
  // 21. get_credit_card_cycles
  server.registerTool(
    'get_credit_card_cycles',
    {
      title: 'Get Credit Card Cycles & Statements',
      description:
        'Retrieves dual-cycle credit card summaries (unbilled current spends + open billed statements, total due, grace periods, next due dates, and utilization) across all or specific cards.',
      inputSchema: {
        accountId: z.string().uuid().optional().describe('Filter by specific credit card account UUID'),
        referenceDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
          .optional()
          .describe('Reference date (defaults to today in IST)'),
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

      const referenceDate = args.referenceDate || getIstIsoDate();
      const supabase = getSupabaseAdmin();

      let query = supabase
        .from('finance_accounts')
        .select('*')
        .eq('user_id', auth.userId)
        .eq('type', 'credit_card')
        .is('deleted_at', null);

      if (args.accountId) {
        query = query.eq('id', args.accountId);
      }

      const { data: cards, error } = await query;
      if (error) {
        return { isError: true, content: [{ type: 'text', text: `Failed to fetch cards: ${error.message}` }] };
      }

      const cardSummaries = [];

      for (const card of cards || []) {
        const [{ data: txs }, { data: statements }] = await Promise.all([
          supabase
            .from('finance_transactions')
            .select('*')
            .eq('user_id', auth.userId)
            .or(`account_id.eq.${card.id},to_account_id.eq.${card.id}`)
            .is('deleted_at', null),
          supabase
            .from('credit_card_statements')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('account_id', card.id)
            .is('deleted_at', null),
        ]);

        const summary = computeCreditCardSummary({
          account: mapFinanceAccountFromRow(card),
          transactions: (txs || []).map(mapFinanceTransactionFromRow),
          persistedStatements: (statements || []).map(mapCreditCardStatementFromRow),
          referenceDate,
        });

        cardSummaries.push(summary);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ referenceDateIst: referenceDate, count: cardSummaries.length, cards: cardSummaries }, null, 2),
          },
        ],
      };
    }
  );

  // 22. manage_credit_card_statement
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
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list_statements') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }
        let query = supabase.from('credit_card_statements').select('*').eq('user_id', auth.userId);
        if (args.cardAccountId) query = query.eq('account_id', args.cardAccountId);
        if (!args.includeDeleted) query = query.is('deleted_at', null);
        const { data, error } = await query.order('period_end', { ascending: false });
        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to list statements: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, statements: data || [] }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }
      if (!args.cardAccountId) {
        return { isError: true, content: [{ type: 'text', text: 'Validation Error: cardAccountId is required.' }] };
      }

      const start = Date.now();
      const dateIst = args.date || getIstIsoDate();

      try {
        // Verify card account
        const { data: cardAccount } = await supabase
          .from('finance_accounts')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.cardAccountId)
          .eq('type', 'credit_card')
          .single();

        if (!cardAccount) {
          return { isError: true, content: [{ type: 'text', text: `Credit card account not found: ${args.cardAccountId}` }] };
        }

        if (args.action === 'pay_bill') {
          if (!args.fromAccountId || !args.amount) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Validation Error: fromAccountId and amount are required for pay_bill.' }],
            };
          }

          // Fetch open statements
          const { data: openStatements } = await supabase
            .from('credit_card_statements')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('account_id', args.cardAccountId)
            .neq('status', 'paid')
            .is('deleted_at', null)
            .order('period_end', { ascending: true });

          const paymentAmount = Number(args.amount);
          const mappedStatements = (openStatements || []).map(mapCreditCardStatementFromRow);
          const targetStatementId =
            args.statementId ||
            (mappedStatements.length > 0 ? mappedStatements[0].id : null);
          const allocated = allocatePaymentToStatements(mappedStatements, paymentAmount, targetStatementId);

          // 1. Create transfer payment transaction
          const categoryId = await resolveFallbackFinanceCategoryId(supabase, auth.userId, ['credit-card-payment', 'emis-debt-repayment', 'other']);
          const meta = getInsertMetadata();
          const paymentTx = {
            user_id: auth.userId,
            title: `Payment: ${cardAccount.name}`,
            merchant_name: cardAccount.name,
            amount: paymentAmount,
            type: 'transfer',
            category_id: categoryId,
            account_id: args.fromAccountId,
            to_account_id: args.cardAccountId,
            date: dateIst,
            month_key: dateIst.substring(0, 7),
            is_credit_card_payment: true,
            paid_statement_id: targetStatementId,
            notes: args.notes || `Credit card bill payment of ₹${paymentAmount}`,
            tags: ['credit_card_payment'],
            ...meta,
          };

          const { data: createdTx, error: txErr } = await supabase
            .from('finance_transactions')
            .insert(paymentTx)
            .select()
            .single();

          if (txErr) throw txErr;

          // 2. Adjust balances: subtract from bank, reduce credit card debt (+balance on card)
          await applyAccountBalanceDelta(supabase, auth.userId, [
            { accountId: args.fromAccountId, delta: -paymentAmount },
            { accountId: args.cardAccountId, delta: paymentAmount },
          ]);

          // 3. Persist waterfall-allocated statement updates in Supabase
          const updatedStatements = [];
          for (let i = 0; i < allocated.updatedStatements.length; i++) {
            const orig = mappedStatements[i];
            const nextStmt = allocated.updatedStatements[i];
            const changed =
              orig.remainingDue !== nextStmt.remainingDue ||
              orig.paidAmount !== nextStmt.paidAmount ||
              orig.status !== nextStmt.status;
            if (!changed) continue;

            const rawRow = (openStatements || []).find((s) => s.id === nextStmt.id);
            const isDirectlyLinked =
              Boolean(targetStatementId) &&
              (nextStmt.id === targetStatementId || nextStmt.cycleKey === targetStatementId);

            const stmtMeta = getUpdateMetadata(rawRow);
            const { data: updated } = await supabase
              .from('credit_card_statements')
              .update({
                ...(isDirectlyLinked ? { paid_amount: nextStmt.paidAmount } : {}),
                remaining_due: nextStmt.remainingDue,
                status: nextStmt.status,
                paid_at: nextStmt.paidAt ?? rawRow?.paid_at ?? null,
                ...stmtMeta,
              })
              .eq('user_id', auth.userId)
              .eq('id', nextStmt.id)
              .select()
              .single();

            if (updated) updatedStatements.push(updated);
          }

          await logMcpToolInvocation(auth, {
            toolName: 'manage_credit_card_statement',
            action: 'pay_bill',
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
                    action: 'bill_paid',
                    paymentTransaction: createdTx,
                    targetStatementId,
                    waterfallAllocations: allocated,
                    updatedStatements,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (args.action === 'reconcile_statement') {
          if (!args.cycleKey || args.billedTotal === undefined) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Validation Error: cycleKey and billedTotal are required for reconcile_statement.',
                },
              ],
            };
          }

          const mappedCard = mapFinanceAccountFromRow(cardAccount);
          const { billingDay, dueDay, gracePeriodDays } = resolveCardBillingConfig(mappedCard);
          const [cYear, cMonth] = args.cycleKey.split('-').map(Number);
          const window = getCycleWindowForMonth(billingDay, dueDay, cYear, cMonth - 1, gracePeriodDays);

          const { data: cardTxsRows } = await supabase
            .from('finance_transactions')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('account_id', args.cardAccountId)
            .is('deleted_at', null);

          const mappedCardTxs = (cardTxsRows || [])
            .map(mapFinanceTransactionFromRow)
            .filter((t) => !t.isCreditCardPayment && t.type !== 'transfer');

          let calculatedAmount = 0;
          for (const tx of mappedCardTxs) {
            const txCycle = resolveTransactionCycle(tx.date, billingDay, dueDay, tx.statementCycleKey);
            if (txCycle === args.cycleKey) {
              if (tx.type === 'income') calculatedAmount = roundCurrency(calculatedAmount - tx.amount);
              else calculatedAmount = roundCurrency(calculatedAmount + tx.amount);
            }
          }

          const actualBilled = roundCurrency(Math.max(0, Number(args.billedTotal)));
          const statementId = `${args.cardAccountId}_${args.cycleKey}`;
          const { data: existing } = await supabase
            .from('credit_card_statements')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', statementId)
            .maybeSingle();

          let savedStatement = null;

          if (existing) {
            const manualAdjustment = roundCurrency(actualBilled - calculatedAmount);
            const carriedForward = Number(existing.carried_forward_amount || 0);
            const totalDue = roundCurrency(Math.max(0, calculatedAmount + manualAdjustment + carriedForward));
            const paidAmt = Number(existing.paid_amount || 0);
            const remainingDue = roundCurrency(Math.max(0, totalDue - paidAmt));
            const status = remainingDue <= 0 ? 'paid' : paidAmt > 0 ? 'partial' : 'billed';

            const meta = getUpdateMetadata(existing);
            const { data, error } = await supabase
              .from('credit_card_statements')
              .update({
                period_start: window.periodStart,
                period_end: window.periodEnd,
                due_date: window.dueDate,
                calculated_amount: calculatedAmount,
                total_due: totalDue,
                manual_adjustment: manualAdjustment,
                remaining_due: remainingDue,
                status,
                notes: args.notes !== undefined ? args.notes : existing.notes,
                ...meta,
              })
              .eq('user_id', auth.userId)
              .eq('id', statementId)
              .select()
              .single();

            if (error) throw error;
            savedStatement = data;
          } else {
            const manualAdjustment = roundCurrency(actualBilled - calculatedAmount);
            const meta = getInsertMetadata(statementId);
            const { data, error } = await supabase
              .from('credit_card_statements')
              .insert({
                user_id: auth.userId,
                account_id: args.cardAccountId,
                cycle_key: args.cycleKey,
                period_start: window.periodStart,
                period_end: window.periodEnd,
                due_date: window.dueDate,
                calculated_amount: calculatedAmount,
                manual_adjustment: manualAdjustment,
                total_due: actualBilled,
                carried_forward_amount: 0,
                paid_amount: 0,
                remaining_due: actualBilled,
                status: actualBilled === 0 ? 'paid' : 'billed',
                notes: args.notes || null,
                ...meta,
              })
              .select()
              .single();

            if (error) throw error;
            savedStatement = data;
          }

          await logMcpToolInvocation(auth, {
            toolName: 'manage_credit_card_statement',
            action: 'reconcile_statement',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'statement_reconciled', statement: savedStatement }, null, 2),
              },
            ],
          };
        }

        if (args.action === 'update_notes') {
          const targetId = args.statementId || (args.cycleKey ? `${args.cardAccountId}_${args.cycleKey}` : null);
          if (!targetId) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Validation Error: statementId or cycleKey is required for update_notes.',
                },
              ],
            };
          }

          const { data: existing, error: fetchErr } = await supabase
            .from('credit_card_statements')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('account_id', args.cardAccountId)
            .eq('id', targetId)
            .is('deleted_at', null)
            .single();

          if (fetchErr || !existing) {
            return { isError: true, content: [{ type: 'text', text: `Statement not found: ${targetId}` }] };
          }

          const meta = getUpdateMetadata(existing);
          const { data: updated, error: updErr } = await supabase
            .from('credit_card_statements')
            .update({
              notes: args.notes ?? null,
              ...meta,
            })
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();

          if (updErr) throw updErr;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_credit_card_statement',
            action: 'update_notes',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'notes_updated', statement: updated }, null, 2),
              },
            ],
          };
        }

        if (args.action === 'update' || args.action === 'delete' || args.action === 'restore') {
          const targetId = args.statementId || (args.cycleKey ? `${args.cardAccountId}_${args.cycleKey}` : null);
          if (!targetId) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Validation Error: statementId or cycleKey is required for ${args.action}.` }],
            };
          }

          const { data: existing, error: fetchErr } = await supabase
            .from('credit_card_statements')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('account_id', args.cardAccountId)
            .eq('id', targetId)
            .single();

          if (fetchErr || !existing) {
            return { isError: true, content: [{ type: 'text', text: `Statement not found: ${targetId}` }] };
          }

          if (args.action === 'delete') {
            if (!args.confirm) {
              return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: Deleting statement requires confirm: true.' }] };
            }
            const { data, error } = await supabase
              .from('credit_card_statements')
              .update(getSoftDeleteMetadata(existing))
              .eq('user_id', auth.userId)
              .eq('id', existing.id)
              .select()
              .single();
            if (error) throw error;
            await logMcpToolInvocation(auth, { toolName: 'manage_credit_card_statement', action: 'delete', input: args, status: 'ok', durationMs: Date.now() - start });
            return { content: [{ type: 'text', text: JSON.stringify({ action: 'deleted', statement: data }, null, 2) }] };
          }

          if (args.action === 'restore') {
            const { data, error } = await supabase
              .from('credit_card_statements')
              .update({ deleted_at: null, ...getUpdateMetadata(existing) })
              .eq('user_id', auth.userId)
              .eq('id', existing.id)
              .select()
              .single();
            if (error) throw error;
            await logMcpToolInvocation(auth, { toolName: 'manage_credit_card_statement', action: 'restore', input: args, status: 'ok', durationMs: Date.now() - start });
            return { content: [{ type: 'text', text: JSON.stringify({ action: 'restored', statement: data }, null, 2) }] };
          }

          // action === 'update'
          const updates: Record<string, any> = {};
          if (args.periodStart !== undefined) updates.period_start = args.periodStart;
          if (args.periodEnd !== undefined) updates.period_end = args.periodEnd;
          if (args.dueDate !== undefined) updates.due_date = args.dueDate;
          if (args.carriedForwardAmount !== undefined) updates.carried_forward_amount = args.carriedForwardAmount;
          if (args.paidAmount !== undefined) updates.paid_amount = args.paidAmount;
          if (args.remainingDue !== undefined) updates.remaining_due = args.remainingDue;
          if (args.manualAdjustment !== undefined) updates.manual_adjustment = args.manualAdjustment;
          if (args.status !== undefined) updates.status = args.status;
          if (args.notes !== undefined) updates.notes = args.notes;

          const { data: updated, error: updErr } = await supabase
            .from('credit_card_statements')
            .update({ ...updates, ...getUpdateMetadata(existing) })
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();
          if (updErr) throw updErr;

          await logMcpToolInvocation(auth, { toolName: 'manage_credit_card_statement', action: 'update', input: args, status: 'ok', durationMs: Date.now() - start });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', statement: updated }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_credit_card_statement',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage statement: ${err.message}` }] };
      }
    }
  );
}
