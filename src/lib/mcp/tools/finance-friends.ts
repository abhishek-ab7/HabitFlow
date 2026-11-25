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
  calculateReversedTransactionBalanceDeltas,
  resolveFallbackFinanceCategoryId,
} from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';
import { mapDebtRecordFromRow } from '../mappers';
import { calculateFriendLedgerGroups } from '@/lib/finance/shared-analytics';

export function registerFinanceFriendsTools(server: McpServer) {
  // 23. get_friend_ledgers
  server.registerTool(
    'get_friend_ledgers',
    {
      title: 'Get Friend Ledgers (Isolated Everyday Tab vs Long-Term Loans)',
      description:
        'Retrieves isolated friend debt ledgers. Everyday split tabs and formal long-term loans are tracked in strictly separate buckets.',
      inputSchema: {
        personName: z.string().optional().describe('Filter by friend name'),
        bucketType: z
          .enum(['everyday_split', 'long_term_loan', 'all'])
          .optional()
          .default('all')
          .describe('Filter by bucket type'),
        includeSettled: z.boolean().optional().default(false).describe('Include settled debts'),
        includeArchived: z.boolean().optional().default(false).describe('Include archived/soft-deleted debts'),
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
      let query = supabase.from('debt_records').select('*').eq('user_id', auth.userId);
      if (!args.includeArchived) {
        query = query.is('deleted_at', null);
      }

      if (!args.includeSettled) {
        query = query.neq('status', 'settled');
      }
      if (args.personName) {
        query = query.ilike('person_name', `%${args.personName.trim()}%`);
      }

      const { data: debts, error } = await query;
      if (error) {
        return { isError: true, content: [{ type: 'text', text: `Failed to fetch debt records: ${error.message}` }] };
      }

      const mappedDebts = (debts || []).map(mapDebtRecordFromRow);
      const allGroups = calculateFriendLedgerGroups(mappedDebts);

      const filteredGroups = allGroups.map((g) => {
        if (args.bucketType === 'everyday_split') {
          return {
            friendKey: g.friendKey,
            friendName: g.friendName,
            contactInfo: g.contactInfo,
            everydayRecords: g.everydayRecords,
            everydayNet: g.everydayNet,
            everydayBorrowedRemaining: g.everydayBorrowedRemaining,
            everydayLentRemaining: g.everydayLentRemaining,
          };
        }
        if (args.bucketType === 'long_term_loan') {
          return {
            friendKey: g.friendKey,
            friendName: g.friendName,
            contactInfo: g.contactInfo,
            longTermLoans: g.longTermLoans,
            longTermNetPosition: g.longTermNetPosition,
            longTermBorrowedRemaining: g.longTermBorrowedRemaining,
            longTermLentRemaining: g.longTermLentRemaining,
          };
        }
        return g;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ count: filteredGroups.length, friendLedgers: filteredGroups }, null, 2),
          },
        ],
      };
    }
  );

  // 24. manage_friend_debt
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
        // Payment recording fields
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
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list_payments') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }
        let query = supabase.from('debt_installments').select('*').eq('user_id', auth.userId);
        if (args.debtId) query = query.eq('debt_id', args.debtId);
        if (!args.includeDeleted) query = query.is('deleted_at', null);
        const { data, error } = await query.order('date', { ascending: false });
        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch installments: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, installments: data || [] }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }

      const start = Date.now();
      const dateIst = args.paymentDate || getIstIsoDate();

      const recomputeDebtFromInstallments = async (debtRow: Record<string, any>) => {
        const { data: activeInsts } = await supabase
          .from('debt_installments')
          .select('amount')
          .eq('user_id', auth.userId)
          .eq('debt_id', debtRow.id)
          .is('deleted_at', null);
        const totalRepaid = Math.round(
          (activeInsts || []).reduce((sum, i) => sum + Number(i.amount || 0), 0) * 100
        ) / 100;
        const remaining = Math.max(0, Math.round((Number(debtRow.principal_amount || 0) - totalRepaid) * 100) / 100);
        const nextStatus = debtRow.deleted_at ? 'archived' : remaining <= 0 ? 'settled' : 'active';
        const { data: updatedDebt } = await supabase
          .from('debt_records')
          .update({
            total_repaid_amount: totalRepaid,
            remaining_amount: remaining,
            status: nextStatus,
            ...getUpdateMetadata(debtRow),
          })
          .eq('user_id', auth.userId)
          .eq('id', debtRow.id)
          .select()
          .single();
        return updatedDebt;
      };

      try {
        if (args.action === 'create_entry') {
          if (!args.personName || !args.direction || !args.principalAmount) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Validation Error: personName, direction, and principalAmount are required for create_entry.',
                },
              ],
            };
          }

          const principal = Number(args.principalAmount);
          const meta = getInsertMetadata();
          const newDebt = {
            user_id: auth.userId,
            person_name: args.personName.trim(),
            contact_info: args.contactInfo ?? null,
            direction: args.direction,
            bucket_type: args.bucketType || 'everyday_split',
            title: args.title?.trim() || `${args.direction === 'lent' ? 'Lent to' : 'Borrowed from'} ${args.personName}`,
            principal_amount: principal,
            total_repaid_amount: 0,
            remaining_amount: principal,
            start_date: dateIst,
            target_settlement_date: args.targetSettlementDate || null,
            repayment_schedule: args.repaymentSchedule || 'flexible',
            planned_monthly_installment: args.plannedMonthlyInstallment ?? null,
            due_day_of_month: args.dueDayOfMonth ?? null,
            color: args.color || '#f59e0b',
            status: 'active',
            notes: args.notes || null,
            ...meta,
          };

          const { data, error } = await supabase.from('debt_records').insert(newDebt).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_friend_debt',
            action: 'create_entry',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'entry_created', debtRecord: data }, null, 2) }] };
        }

        if (args.action === 'settle_bucket') {
          if (!args.personName || !args.bucketType) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Validation Error: personName and bucketType are required for settle_bucket.',
                },
              ],
            };
          }
          if (!args.confirm) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Confirmation Required: Settling all active entries in '${args.bucketType}' for ${args.personName} requires confirm: true.`,
                },
              ],
            };
          }

          const { data: openEntries } = await supabase
            .from('debt_records')
            .select('*')
            .eq('user_id', auth.userId)
            .ilike('person_name', args.personName.trim())
            .eq('bucket_type', args.bucketType)
            .eq('status', 'active')
            .is('deleted_at', null);

          const settledEntries = [];
          for (const entry of openEntries || []) {
            const meta = getUpdateMetadata(entry);
            const { data } = await supabase
              .from('debt_records')
              .update({
                remaining_amount: 0,
                total_repaid_amount: entry.principal_amount,
                status: 'settled',
                notes: `${entry.notes || ''} [Settled bucket on ${dateIst}]`.trim(),
                ...meta,
              })
              .eq('id', entry.id)
              .select()
              .single();
            if (data) settledEntries.push(data);
          }

          await logMcpToolInvocation(auth, {
            toolName: 'manage_friend_debt',
            action: 'settle_bucket',
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
                    action: 'bucket_settled',
                    personName: args.personName,
                    bucketType: args.bucketType,
                    settledCount: settledEntries.length,
                    settledEntries,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (args.action === 'update_payment' || args.action === 'delete_payment' || args.action === 'restore_payment') {
          if (!args.installmentId) {
            return { isError: true, content: [{ type: 'text', text: `Validation Error: installmentId is required for ${args.action}.` }] };
          }
          const { data: inst, error: instErr } = await supabase
            .from('debt_installments')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.installmentId)
            .single();
          if (instErr || !inst) {
            return { isError: true, content: [{ type: 'text', text: `Installment not found: ${args.installmentId}` }] };
          }

          const { data: parentDebt } = await supabase
            .from('debt_records')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', inst.debt_id)
            .single();

          if (args.action === 'delete_payment') {
            if (!args.confirm) {
              return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: Deleting installment requires confirm: true.' }] };
            }
            const { data: deletedInst, error: delErr } = await supabase
              .from('debt_installments')
              .update(getSoftDeleteMetadata(inst))
              .eq('user_id', auth.userId)
              .eq('id', args.installmentId)
              .select()
              .single();
            if (delErr) throw delErr;

            // Reverse any linked transaction if present
            const { data: linkedTx } = await supabase
              .from('finance_transactions')
              .select('*')
              .eq('user_id', auth.userId)
              .eq('linked_debt_installment_id', inst.id)
              .is('deleted_at', null)
              .maybeSingle();
            if (linkedTx) {
              const rev = calculateReversedTransactionBalanceDeltas(linkedTx);
              await applyAccountBalanceDelta(supabase, auth.userId, rev);
              await supabase
                .from('finance_transactions')
                .update(getSoftDeleteMetadata(linkedTx))
                .eq('user_id', auth.userId)
                .eq('id', linkedTx.id);
            }

            const updatedDebt = parentDebt ? await recomputeDebtFromInstallments(parentDebt) : null;
            await logMcpToolInvocation(auth, { toolName: 'manage_friend_debt', action: 'delete_payment', input: args, status: 'ok', durationMs: Date.now() - start });
            return { content: [{ type: 'text', text: JSON.stringify({ action: 'payment_deleted', installment: deletedInst, debtRecord: updatedDebt }, null, 2) }] };
          }

          if (args.action === 'restore_payment') {
            const { data: restoredInst, error: resErr } = await supabase
              .from('debt_installments')
              .update({ deleted_at: null, ...getUpdateMetadata(inst) })
              .eq('user_id', auth.userId)
              .eq('id', args.installmentId)
              .select()
              .single();
            if (resErr) throw resErr;
            const updatedDebt = parentDebt ? await recomputeDebtFromInstallments(parentDebt) : null;
            await logMcpToolInvocation(auth, { toolName: 'manage_friend_debt', action: 'restore_payment', input: args, status: 'ok', durationMs: Date.now() - start });
            return { content: [{ type: 'text', text: JSON.stringify({ action: 'payment_restored', installment: restoredInst, debtRecord: updatedDebt }, null, 2) }] };
          }

          // action === 'update_payment'
          const updates: Record<string, any> = {};
          if (args.paymentAmount !== undefined) updates.amount = Number(args.paymentAmount);
          if (args.paymentDate !== undefined) {
            updates.date = args.paymentDate;
            updates.month_key = args.paymentDate.substring(0, 7);
          }
          if (args.paymentMethod !== undefined) updates.payment_method = args.paymentMethod;
          if (args.notes !== undefined) updates.note = args.notes;

          const { data: updatedInst, error: updErr } = await supabase
            .from('debt_installments')
            .update({ ...updates, ...getUpdateMetadata(inst) })
            .eq('user_id', auth.userId)
            .eq('id', args.installmentId)
            .select()
            .single();
          if (updErr) throw updErr;

          const updatedDebt = parentDebt ? await recomputeDebtFromInstallments(parentDebt) : null;
          await logMcpToolInvocation(auth, { toolName: 'manage_friend_debt', action: 'update_payment', input: args, status: 'ok', durationMs: Date.now() - start });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'payment_updated', installment: updatedInst, debtRecord: updatedDebt }, null, 2) }] };
        }

        if (!args.debtId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: debtId is required.' }] };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('debt_records')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.debtId)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `Debt record not found: ${args.debtId}` }] };
        }

        if (args.action === 'archive_entry') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Confirmation Required: Archiving debt entry requires confirm: true.' }],
            };
          }

          const meta = getSoftDeleteMetadata(existing);
          const { data, error } = await supabase
            .from('debt_records')
            .update({ status: 'archived', ...meta })
            .eq('id', args.debtId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_friend_debt',
            action: 'archive_entry',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'entry_archived', debtRecord: data }, null, 2) }] };
        }

        if (args.action === 'restore_entry') {
          const remaining = Number(existing.remaining_amount ?? existing.principal_amount ?? 0);
          const nextStatus = remaining <= 0 ? 'settled' : 'active';
          const { data, error } = await supabase
            .from('debt_records')
            .update({ deleted_at: null, status: nextStatus, ...getUpdateMetadata(existing) })
            .eq('user_id', auth.userId)
            .eq('id', args.debtId)
            .select()
            .single();
          if (error) throw error;
          await logMcpToolInvocation(auth, { toolName: 'manage_friend_debt', action: 'restore_entry', input: args, status: 'ok', durationMs: Date.now() - start });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'entry_restored', debtRecord: data }, null, 2) }] };
        }

        if (args.action === 'record_payment') {
          if (!args.paymentAmount) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Validation Error: paymentAmount is required for record_payment.' }],
            };
          }

          const paymentAmount = Number(args.paymentAmount);
          const currentRepaid = Number(existing.total_repaid_amount || 0);
          const newRepaid = Math.round((currentRepaid + paymentAmount) * 100) / 100;
          const newRemaining = Math.max(0, Math.round((Number(existing.principal_amount) - newRepaid) * 100) / 100);
          const newStatus = newRemaining <= 0 ? 'settled' : 'active';

          // 1. Insert installment record
          const instMeta = getInsertMetadata();
          const newInstallment = {
            user_id: auth.userId,
            debt_id: args.debtId,
            amount: paymentAmount,
            date: dateIst,
            month_key: dateIst.substring(0, 7),
            payment_method: args.paymentMethod || 'upi',
            note: args.notes || null,
            balance_after_payment: newRemaining,
            ...instMeta,
          };

          const { data: createdInst, error: instErr } = await supabase
            .from('debt_installments')
            .insert(newInstallment)
            .select()
            .single();

          if (instErr) throw instErr;

          // 2. Update debt record
          const debtMeta = getUpdateMetadata(existing);
          const { data: updatedDebt, error: updateErr } = await supabase
            .from('debt_records')
            .update({
              total_repaid_amount: newRepaid,
              remaining_amount: newRemaining,
              status: newStatus,
              ...debtMeta,
            })
            .eq('id', args.debtId)
            .select()
            .single();

          if (updateErr) throw updateErr;

          // 3. Optional linked transaction & account balance adjustment
          let linkedTx = null;
          if (args.linkedAccountId) {
            const isRepayingBorrowed = existing.direction === 'borrowed';
            const txType = isRepayingBorrowed ? 'expense' : 'income';
            const txCategoryId = await resolveFallbackFinanceCategoryId(supabase, auth.userId, ['emis-debt-repayment', 'other']);
            const txMeta = getInsertMetadata();

            const txPayload = {
              user_id: auth.userId,
              title: isRepayingBorrowed
                ? `Repayment to ${existing.person_name}`
                : `Received from ${existing.person_name}`,
              merchant_name: existing.person_name,
              amount: paymentAmount,
              type: txType,
              category_id: txCategoryId,
              account_id: args.linkedAccountId,
              date: dateIst,
              month_key: dateIst.substring(0, 7),
              linked_debt_id: args.debtId,
              linked_debt_installment_id: createdInst.id,
              notes: args.notes || `Friend debt repayment for "${existing.title}"`,
              tags: ['debt_payment', existing.bucket_type],
              ...txMeta,
            };

            const { data: tx } = await supabase.from('finance_transactions').insert(txPayload).select().single();
            linkedTx = tx;

            const delta = isRepayingBorrowed ? -paymentAmount : paymentAmount;
            await applyAccountBalanceDelta(supabase, auth.userId, [{ accountId: args.linkedAccountId, delta }]);
          }

          await logMcpToolInvocation(auth, {
            toolName: 'manage_friend_debt',
            action: 'record_payment',
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
                    action: 'payment_recorded',
                    debtRecord: updatedDebt,
                    installment: createdInst,
                    linkedTransaction: linkedTx,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (args.action === 'update_entry') {
          const updates: Record<string, any> = {};
          if (args.personName !== undefined) updates.person_name = args.personName.trim();
          if (args.contactInfo !== undefined) updates.contact_info = args.contactInfo;
          if (args.direction !== undefined) updates.direction = args.direction;
          if (args.title !== undefined) updates.title = args.title.trim();
          if (args.bucketType !== undefined) updates.bucket_type = args.bucketType;
          if (args.targetSettlementDate !== undefined) updates.target_settlement_date = args.targetSettlementDate;
          if (args.repaymentSchedule !== undefined) updates.repayment_schedule = args.repaymentSchedule;
          if (args.plannedMonthlyInstallment !== undefined) updates.planned_monthly_installment = args.plannedMonthlyInstallment;
          if (args.dueDayOfMonth !== undefined) updates.due_day_of_month = args.dueDayOfMonth;
          if (args.color !== undefined) updates.color = args.color;
          if (args.notes !== undefined) updates.notes = args.notes;
          if (args.principalAmount !== undefined) {
            const nextPrincipal = Number(args.principalAmount);
            const repaid = Number(existing.total_repaid_amount || 0);
            const nextRemaining = Math.max(0, Math.round((nextPrincipal - repaid) * 100) / 100);
            updates.principal_amount = nextPrincipal;
            updates.remaining_amount = nextRemaining;
            updates.status = nextRemaining <= 0 ? 'settled' : 'active';
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('debt_records')
            .update({ ...updates, ...meta })
            .eq('id', args.debtId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_friend_debt',
            action: 'update_entry',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'entry_updated', debtRecord: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_friend_debt',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage debt: ${err.message}` }] };
      }
    }
  );
}
