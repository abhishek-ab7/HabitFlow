import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate } from '../config';
import {
  getInsertMetadata,
  getUpdateMetadata,
  applyAccountBalanceDelta,
} from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';
import {
  computeCreditCardSummary,
  allocatePaymentToStatements,
  resolveTransactionCycle,
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
          account: card as any,
          transactions: (txs as any) || [],
          persistedStatements: (statements as any) || [],
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
        'Pay credit card bills (with waterfall statement allocation and account balance transfers), reconcile a statement cycle total, or update notes.',
      inputSchema: {
        action: z.enum(['pay_bill', 'reconcile_statement', 'update_notes']).describe('Action to execute'),
        cardAccountId: z.string().uuid().describe('Target Credit Card account UUID'),
        fromAccountId: z.string().uuid().optional().describe('Source Bank/UPI account UUID paying the bill (required for pay_bill)'),
        amount: z.number().positive().optional().describe('Payment amount in INR (required for pay_bill)'),
        statementId: z.string().optional().describe('Optional specific statement ID being paid'),
        cycleKey: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Statement cycle key (YYYY-MM) for reconcile'),
        billedTotal: z.number().min(0).optional().describe('Total amount billed from official bank statement'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Payment or reconcile date (defaults to IST today)'),
        notes: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
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
          const targetStatementId =
            args.statementId ||
            (openStatements && openStatements.length > 0 ? openStatements[0].id : null);
          const allocated = allocatePaymentToStatements((openStatements as any) || [], paymentAmount, targetStatementId);

          // 1. Create transfer payment transaction
          const meta = getInsertMetadata();
          const paymentTx = {
            user_id: auth.userId,
            title: `Payment: ${cardAccount.name}`,
            merchant_name: cardAccount.name,
            amount: paymentAmount,
            type: 'transfer',
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

          // 3. Update target statement paid_amount
          const updatedStatements = [];
          if (targetStatementId) {
            const { data: targetStmt } = await supabase
              .from('credit_card_statements')
              .select('*')
              .eq('user_id', auth.userId)
              .eq('id', targetStatementId)
              .single();

            if (targetStmt) {
              const newPaid = Math.round((Number(targetStmt.paid_amount || 0) + paymentAmount) * 100) / 100;
              const remaining = Math.max(0, Math.round((Number(targetStmt.total_due || 0) - newPaid) * 100) / 100);
              const status = remaining <= 0 ? 'paid' : 'partial';

              const stmtMeta = getUpdateMetadata(targetStmt);
              const { data: updated } = await supabase
                .from('credit_card_statements')
                .update({
                  paid_amount: newPaid,
                  remaining_due: remaining,
                  status,
                  paid_at: remaining <= 0 ? new Date().toISOString() : targetStmt.paid_at,
                  ...stmtMeta,
                })
                .eq('id', targetStatementId)
                .select()
                .single();

              if (updated) updatedStatements.push(updated);
            }
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

          const statementId = `${args.cardAccountId}_${args.cycleKey}`;
          const { data: existing } = await supabase
            .from('credit_card_statements')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', statementId)
            .maybeSingle();

          let savedStatement = null;

          if (existing) {
            const manualAdjustment =
              Math.round((Number(args.billedTotal) - Number(existing.calculated_amount || 0)) * 100) / 100;
            const remainingDue = Math.max(0, Number(args.billedTotal) - Number(existing.paid_amount || 0));
            const status = remainingDue <= 0 ? 'paid' : existing.paid_amount > 0 ? 'partial' : 'billed';

            const meta = getUpdateMetadata(existing);
            const { data, error } = await supabase
              .from('credit_card_statements')
              .update({
                total_due: Number(args.billedTotal),
                manual_adjustment: manualAdjustment,
                remaining_due: remainingDue,
                status,
                notes: args.notes || existing.notes,
                ...meta,
              })
              .eq('id', statementId)
              .select()
              .single();

            if (error) throw error;
            savedStatement = data;
          } else {
            const meta = getInsertMetadata(statementId);
            const { data, error } = await supabase
              .from('credit_card_statements')
              .insert({
                user_id: auth.userId,
                account_id: args.cardAccountId,
                cycle_key: args.cycleKey,
                period_start: `${args.cycleKey}-01`,
                period_end: `${args.cycleKey}-28`,
                due_date: `${args.cycleKey}-25`,
                calculated_amount: Number(args.billedTotal),
                manual_adjustment: 0,
                total_due: Number(args.billedTotal),
                carried_forward_amount: 0,
                paid_amount: 0,
                remaining_due: Number(args.billedTotal),
                status: 'billed',
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
