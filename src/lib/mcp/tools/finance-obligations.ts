import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate, getIstMonthKey } from '../config';
import {
  getInsertMetadata,
  getUpdateMetadata,
  getSoftDeleteMetadata,
  applyAccountBalanceDelta,
} from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';
import { mapFinanceTransactionFromRow, mapMonthlyCommitmentFromRow } from '../mappers';
import { calculateCommitmentLedger } from '@/lib/finance/shared-analytics';

export function registerFinanceObligationsTools(server: McpServer) {
  // 25. manage_recurring_bill
  server.registerTool(
    'manage_recurring_bill',
    {
      title: 'Manage Recurring Bills',
      description: 'List, create, update, mark as paid (creates expense + updates account balance), or archive recurring utility/subscription bills.',
      inputSchema: {
        action: z.enum(['list', 'create', 'update', 'mark_paid', 'archive']).describe('Action to execute'),
        billId: z.string().uuid().optional().describe('Bill UUID (required for update, mark_paid, archive)'),
        name: z.string().min(1).max(100).optional().describe('Bill name (e.g. Electricity, Netflix, Wifi)'),
        amount: z.number().positive().optional().describe('Bill amount in INR'),
        cadence: z.enum(['monthly', 'quarterly', 'yearly']).optional().default('monthly'),
        dueDayOfMonth: z.number().int().min(1).max(31).optional().describe('Day of month payment is due'),
        categoryId: z.string().uuid().optional(),
        accountId: z.string().uuid().optional().describe('Account used for payment'),
        autoLog: z.boolean().optional(),
        isActive: z.boolean().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
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
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }
        const { data, error } = await supabase
          .from('finance_recurring_bills')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null)
          .order('due_day_of_month');

        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch bills: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, bills: data }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }

      const start = Date.now();
      const dateIst = getIstIsoDate();
      const monthKey = getIstMonthKey();

      try {
        if (args.action === 'create') {
          if (!args.name || !args.amount) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: name and amount are required for create.' }] };
          }

          const meta = getInsertMetadata();
          const newBill = {
            user_id: auth.userId,
            name: args.name.trim(),
            amount: Number(args.amount),
            previous_amount: Number(args.amount),
            cadence: args.cadence || 'monthly',
            due_day_of_month: args.dueDayOfMonth || 1,
            category_id: args.categoryId || null,
            account_id: args.accountId || null,
            auto_log: args.autoLog ?? false,
            is_active: args.isActive ?? true,
            color: args.color || null,
            icon: args.icon || null,
            ...meta,
          };

          const { data, error } = await supabase.from('finance_recurring_bills').insert(newBill).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_recurring_bill',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'created', bill: data }, null, 2) }] };
        }

        if (!args.billId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: billId is required.' }] };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('finance_recurring_bills')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.billId)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `Bill not found: ${args.billId}` }] };
        }

        if (args.action === 'archive') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Confirmation Required: Archiving this bill requires confirm: true.' }],
            };
          }

          const meta = getSoftDeleteMetadata(existing);
          const { data, error } = await supabase
            .from('finance_recurring_bills')
            .update({ is_active: false, ...meta })
            .eq('id', args.billId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_recurring_bill',
            action: 'archive',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'archived', bill: data }, null, 2) }] };
        }

        if (args.action === 'mark_paid') {
          const accountIdToUse = args.accountId || existing.account_id;
          let createdTx = null;

          if (accountIdToUse) {
            const txMeta = getInsertMetadata();
            const txPayload = {
              user_id: auth.userId,
              title: `Bill: ${existing.name}`,
              merchant_name: existing.name,
              amount: existing.amount,
              type: 'expense',
              category_id: existing.category_id,
              account_id: accountIdToUse,
              date: dateIst,
              month_key: monthKey,
              is_recurring: true,
              tags: ['recurring_bill'],
              notes: `Paid recurring bill "${existing.name}"`,
              ...txMeta,
            };

            const { data: tx } = await supabase.from('finance_transactions').insert(txPayload).select().single();
            createdTx = tx;

            await applyAccountBalanceDelta(supabase, auth.userId, [
              { accountId: accountIdToUse, delta: -existing.amount },
            ]);
          }

          const meta = getUpdateMetadata(existing);
          const { data: updatedBill } = await supabase
            .from('finance_recurring_bills')
            .update({ last_paid_month_key: monthKey, ...meta })
            .eq('id', args.billId)
            .select()
            .single();

          await logMcpToolInvocation(auth, {
            toolName: 'manage_recurring_bill',
            action: 'mark_paid',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'paid', bill: updatedBill, loggedTransaction: createdTx }, null, 2),
              },
            ],
          };
        }

        if (args.action === 'update') {
          const updates: Record<string, any> = {};
          if (args.name !== undefined) updates.name = args.name.trim();
          if (args.amount !== undefined) {
            updates.previous_amount = existing.amount;
            updates.amount = args.amount;
          }
          if (args.cadence !== undefined) updates.cadence = args.cadence;
          if (args.dueDayOfMonth !== undefined) updates.due_day_of_month = args.dueDayOfMonth;
          if (args.categoryId !== undefined) updates.category_id = args.categoryId;
          if (args.accountId !== undefined) updates.account_id = args.accountId;
          if (args.autoLog !== undefined) updates.auto_log = args.autoLog;
          if (args.isActive !== undefined) updates.is_active = args.isActive;

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_recurring_bills')
            .update({ ...updates, ...meta })
            .eq('id', args.billId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_recurring_bill',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', bill: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_recurring_bill',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage bill: ${err.message}` }] };
      }
    }
  );

  // 26. manage_emi
  server.registerTool(
    'manage_emi',
    {
      title: 'Manage EMI Trackers',
      description:
        'List loan EMIs, create new loan trackers, log monthly installments (creates expense + advances paid months), or foreclose a loan.',
      inputSchema: {
        action: z.enum(['list', 'create', 'update', 'log_payment', 'foreclose']).describe('Action to execute'),
        emiId: z.string().uuid().optional().describe('EMI Tracker UUID'),
        loanName: z.string().min(1).max(100).optional().describe('Loan name (e.g. Home Loan, Car Loan, MacBook EMI)'),
        lenderName: z.string().optional().describe('Bank or Lender (e.g. HDFC Bank, Bajaj Finserv)'),
        principalAmount: z.number().positive().optional().describe('Total original loan amount'),
        interestRateAnnual: z.number().min(0).optional().describe('Annual interest percentage (e.g. 8.5)'),
        emiAmount: z.number().positive().optional().describe('Monthly EMI installment amount'),
        tenureMonths: z.number().int().positive().optional().describe('Total tenure in months'),
        paidMonths: z.number().int().min(0).optional().describe('Months already paid'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        billingDayOfMonth: z.number().int().min(1).max(31).optional(),
        accountId: z.string().uuid().optional().describe('Account EMI is auto-debited from'),
        categoryId: z.string().uuid().optional(),
        notes: z.string().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for foreclose'),
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

      if (args.action === 'list') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }
        const { data, error } = await supabase
          .from('emi_trackers')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null)
          .order('status')
          .order('billing_day_of_month');

        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch EMIs: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, emis: data }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }

      const start = Date.now();
      const dateIst = getIstIsoDate();
      const monthKey = getIstMonthKey();

      try {
        if (args.action === 'create') {
          if (!args.loanName || !args.principalAmount || !args.emiAmount || !args.tenureMonths) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Validation Error: loanName, principalAmount, emiAmount, and tenureMonths are required for create.',
                },
              ],
            };
          }

          const meta = getInsertMetadata();
          const newEmi = {
            user_id: auth.userId,
            loan_name: args.loanName.trim(),
            lender_name: args.lenderName?.trim() || 'Lender',
            principal_amount: Number(args.principalAmount),
            interest_rate_annual: Number(args.interestRateAnnual || 0),
            emi_amount: Number(args.emiAmount),
            tenure_months: Number(args.tenureMonths),
            paid_months: Number(args.paidMonths || 0),
            start_date: args.startDate || dateIst,
            billing_day_of_month: args.billingDayOfMonth || 5,
            category_id: args.categoryId || null,
            account_id: args.accountId || null,
            status: 'active',
            notes: args.notes || null,
            ...meta,
          };

          const { data, error } = await supabase.from('emi_trackers').insert(newEmi).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_emi',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'created', emi: data }, null, 2) }] };
        }

        if (!args.emiId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: emiId is required.' }] };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('emi_trackers')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.emiId)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `EMI tracker not found: ${args.emiId}` }] };
        }

        if (args.action === 'foreclose') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Confirmation Required: Foreclosing an EMI requires confirm: true.' }],
            };
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('emi_trackers')
            .update({ status: 'foreclosed', ...meta })
            .eq('id', args.emiId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_emi',
            action: 'foreclose',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'foreclosed', emi: data }, null, 2) }] };
        }

        if (args.action === 'log_payment') {
          const accountIdToUse = args.accountId || existing.account_id;
          let createdTx = null;

          if (accountIdToUse) {
            const txMeta = getInsertMetadata();
            const txPayload = {
              user_id: auth.userId,
              title: `EMI: ${existing.loan_name} (${existing.paid_months + 1}/${existing.tenure_months})`,
              merchant_name: existing.lender_name,
              amount: existing.emi_amount,
              type: 'expense',
              category_id: existing.category_id,
              account_id: accountIdToUse,
              date: dateIst,
              month_key: monthKey,
              linked_emi_id: existing.id,
              tags: ['emi_payment'],
              notes: `Monthly EMI installment for ${existing.loan_name}`,
              ...txMeta,
            };

            const { data: tx } = await supabase.from('finance_transactions').insert(txPayload).select().single();
            createdTx = tx;

            await applyAccountBalanceDelta(supabase, auth.userId, [
              { accountId: accountIdToUse, delta: -existing.emi_amount },
            ]);
          }

          const nextPaidMonths = existing.paid_months + 1;
          const status = nextPaidMonths >= existing.tenure_months ? 'completed' : 'active';
          const meta = getUpdateMetadata(existing);

          const { data: updatedEmi } = await supabase
            .from('emi_trackers')
            .update({
              paid_months: nextPaidMonths,
              status,
              last_paid_month_key: monthKey,
              ...meta,
            })
            .eq('id', args.emiId)
            .select()
            .single();

          await logMcpToolInvocation(auth, {
            toolName: 'manage_emi',
            action: 'log_payment',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'payment_logged', emi: updatedEmi, loggedTransaction: createdTx }, null, 2),
              },
            ],
          };
        }

        if (args.action === 'update') {
          const updates: Record<string, any> = {};
          if (args.loanName !== undefined) updates.loan_name = args.loanName.trim();
          if (args.lenderName !== undefined) updates.lender_name = args.lenderName.trim();
          if (args.emiAmount !== undefined) updates.emi_amount = args.emiAmount;
          if (args.paidMonths !== undefined) updates.paid_months = args.paidMonths;
          if (args.billingDayOfMonth !== undefined) updates.billing_day_of_month = args.billingDayOfMonth;
          if (args.accountId !== undefined) updates.account_id = args.accountId;
          if (args.categoryId !== undefined) updates.category_id = args.categoryId;

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('emi_trackers')
            .update({ ...updates, ...meta })
            .eq('id', args.emiId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_emi',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', emi: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_emi',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage EMI: ${err.message}` }] };
      }
    }
  );

  // 27. manage_sip_plan
  server.registerTool(
    'manage_sip_plan',
    {
      title: 'Manage SIP Investment Plans',
      description:
        'List SIP plans, create new monthly SIP investments, log installments (creates investment transaction + updates total invested), or update latest portfolio valuation.',
      inputSchema: {
        action: z
          .enum(['list', 'create', 'update', 'log_installment', 'update_valuation', 'archive'])
          .describe('Action to execute'),
        sipId: z.string().uuid().optional().describe('SIP Plan UUID'),
        name: z.string().min(1).max(100).optional().describe('SIP fund/asset name (e.g. Parag Parikh Flexi Cap)'),
        platform: z.string().optional().describe('Platform name (e.g. Zerodha Coin, Groww, INDmoney)'),
        assetClass: z.enum(['equity', 'debt', 'hybrid', 'gold', 'crypto', 'other']).optional(),
        monthlyAmount: z.number().positive().optional().describe('Monthly SIP installment amount in INR'),
        sipDayOfMonth: z.number().int().min(1).max(31).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        totalInvested: z.number().min(0).optional(),
        currentValue: z.number().min(0).optional().describe('Current portfolio valuation in INR'),
        expectedReturnAnnual: z.number().min(0).optional().describe('Expected CAGR annual return percentage'),
        accountId: z.string().uuid().optional().describe('Source bank/investment account UUID'),
        categoryId: z.string().uuid().optional(),
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
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }
        const { data, error } = await supabase
          .from('finance_sip_plans')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null)
          .order('sip_day_of_month');

        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch SIP plans: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, sipPlans: data }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }

      const start = Date.now();
      const dateIst = getIstIsoDate();
      const monthKey = getIstMonthKey();

      try {
        if (args.action === 'create') {
          if (!args.name || !args.monthlyAmount) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Validation Error: name and monthlyAmount are required for create.' }],
            };
          }

          const meta = getInsertMetadata();
          const newSip = {
            user_id: auth.userId,
            name: args.name.trim(),
            platform: args.platform?.trim() || 'Direct',
            asset_class: args.assetClass || 'equity',
            monthly_amount: Number(args.monthlyAmount),
            sip_day_of_month: args.sipDayOfMonth || 10,
            start_date: args.startDate || dateIst,
            total_invested: Number(args.totalInvested || 0),
            current_value: Number(args.currentValue || args.totalInvested || 0),
            expected_return_annual: Number(args.expectedReturnAnnual || 12),
            account_id: args.accountId || null,
            category_id: args.categoryId || null,
            is_active: true,
            notes: args.notes || null,
            ...meta,
          };

          const { data, error } = await supabase.from('finance_sip_plans').insert(newSip).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_sip_plan',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'created', sip: data }, null, 2) }] };
        }

        if (!args.sipId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: sipId is required.' }] };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('finance_sip_plans')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.sipId)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `SIP plan not found: ${args.sipId}` }] };
        }

        if (args.action === 'archive') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Confirmation Required: Archiving this SIP plan requires confirm: true.' }],
            };
          }

          const meta = getSoftDeleteMetadata(existing);
          const { data, error } = await supabase
            .from('finance_sip_plans')
            .update({ is_active: false, ...meta })
            .eq('id', args.sipId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_sip_plan',
            action: 'archive',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'archived', sip: data }, null, 2) }] };
        }

        if (args.action === 'update_valuation') {
          if (args.currentValue === undefined) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Validation Error: currentValue is required for update_valuation.' }],
            };
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_sip_plans')
            .update({ current_value: Number(args.currentValue), ...meta })
            .eq('id', args.sipId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_sip_plan',
            action: 'update_valuation',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'valuation_updated', sip: data }, null, 2) }] };
        }

        if (args.action === 'log_installment') {
          const accountIdToUse = args.accountId || existing.account_id;
          let createdTx = null;

          if (accountIdToUse) {
            const txMeta = getInsertMetadata();
            const txPayload = {
              user_id: auth.userId,
              title: `SIP: ${existing.name}`,
              merchant_name: existing.platform,
              amount: existing.monthly_amount,
              type: 'investment',
              category_id: existing.category_id,
              account_id: accountIdToUse,
              date: dateIst,
              month_key: monthKey,
              linked_sip_id: existing.id,
              tags: ['sip_installment', existing.asset_class],
              notes: `Monthly SIP installment for ${existing.name}`,
              ...txMeta,
            };

            const { data: tx } = await supabase.from('finance_transactions').insert(txPayload).select().single();
            createdTx = tx;

            await applyAccountBalanceDelta(supabase, auth.userId, [
              { accountId: accountIdToUse, delta: -existing.monthly_amount },
            ]);
          }

          const newTotalInvested = Math.round((Number(existing.total_invested || 0) + existing.monthly_amount) * 100) / 100;
          const newCurrentValue = Math.round((Number(existing.current_value || 0) + existing.monthly_amount) * 100) / 100;

          const meta = getUpdateMetadata(existing);
          const { data: updatedSip } = await supabase
            .from('finance_sip_plans')
            .update({
              total_invested: newTotalInvested,
              current_value: newCurrentValue,
              last_invested_month_key: monthKey,
              ...meta,
            })
            .eq('id', args.sipId)
            .select()
            .single();

          await logMcpToolInvocation(auth, {
            toolName: 'manage_sip_plan',
            action: 'log_installment',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'installment_logged', sip: updatedSip, loggedTransaction: createdTx }, null, 2),
              },
            ],
          };
        }

        if (args.action === 'update') {
          const updates: Record<string, any> = {};
          if (args.name !== undefined) updates.name = args.name.trim();
          if (args.platform !== undefined) updates.platform = args.platform.trim();
          if (args.assetClass !== undefined) updates.asset_class = args.assetClass;
          if (args.monthlyAmount !== undefined) updates.monthly_amount = args.monthlyAmount;
          if (args.sipDayOfMonth !== undefined) updates.sip_day_of_month = args.sipDayOfMonth;
          if (args.totalInvested !== undefined) updates.total_invested = args.totalInvested;
          if (args.currentValue !== undefined) updates.current_value = args.currentValue;
          if (args.expectedReturnAnnual !== undefined) updates.expected_return_annual = args.expectedReturnAnnual;
          if (args.accountId !== undefined) updates.account_id = args.accountId;

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_sip_plans')
            .update({ ...updates, ...meta })
            .eq('id', args.sipId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_sip_plan',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', sip: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_sip_plan',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage SIP: ${err.message}` }] };
      }
    }
  );

  // 28. manage_monthly_commitment
  server.registerTool(
    'manage_monthly_commitment',
    {
      title: 'Manage Monthly Commitments (Family/Personal Allowances)',
      description:
        'List commitments, create monthly target obligations (parents allowance, house rent, etc.), log contributions (direct payments or offset expenses), or archive commitments.',
      inputSchema: {
        action: z.enum(['list', 'create', 'update', 'log_contribution', 'archive']).describe('Action to execute'),
        commitmentId: z.string().uuid().optional().describe('Commitment UUID'),
        title: z.string().min(1).max(100).optional().describe('Commitment title (e.g. Parents Support, Home Rent)'),
        recipientName: z.string().min(1).max(100).optional().describe('Recipient name (e.g. Mom & Dad, Landlord)'),
        relationship: z.string().optional().describe('Relationship (e.g. Parents, Family, Landlord)'),
        monthlyTargetAmount: z.number().positive().optional().describe('Monthly target allocation in INR'),
        dueDayOfMonth: z.number().int().min(1).max(31).optional(),
        autoRolloverOverpayment: z.boolean().optional().describe('Whether overpayment rolls over to reduce next month target'),
        contributionAmount: z.number().positive().optional().describe('Contribution amount in INR for log_contribution'),
        contributionType: z.enum(['direct_payment', 'offset_expense']).optional().default('direct_payment'),
        accountId: z.string().uuid().optional().describe('Account used for payment'),
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
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }
        const { data, error } = await supabase
          .from('monthly_commitments')
          .select('*')
          .eq('user_id', auth.userId)
          .is('deleted_at', null)
          .order('due_day_of_month');

        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch commitments: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, commitments: data }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }

      const start = Date.now();
      const dateIst = getIstIsoDate();
      const monthKey = getIstMonthKey();

      try {
        if (args.action === 'create') {
          if (!args.title || !args.recipientName || !args.monthlyTargetAmount) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Validation Error: title, recipientName, and monthlyTargetAmount are required for create.',
                },
              ],
            };
          }

          const meta = getInsertMetadata();
          const newCommitment = {
            user_id: auth.userId,
            title: args.title.trim(),
            recipient_name: args.recipientName.trim(),
            relationship: args.relationship?.trim() || 'Other',
            monthly_target_amount: Number(args.monthlyTargetAmount),
            due_day_of_month: args.dueDayOfMonth || 1,
            auto_rollover_overpayment: args.autoRolloverOverpayment ?? true,
            is_active: true,
            notes: args.notes || null,
            ...meta,
          };

          const { data, error } = await supabase.from('monthly_commitments').insert(newCommitment).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_monthly_commitment',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'created', commitment: data }, null, 2) }] };
        }

        if (!args.commitmentId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: commitmentId is required.' }] };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('monthly_commitments')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.commitmentId)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `Commitment not found: ${args.commitmentId}` }] };
        }

        if (args.action === 'archive') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Confirmation Required: Archiving commitment requires confirm: true.' }],
            };
          }

          const meta = getSoftDeleteMetadata(existing);
          const { data, error } = await supabase
            .from('monthly_commitments')
            .update({ is_active: false, ...meta })
            .eq('id', args.commitmentId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_monthly_commitment',
            action: 'archive',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'archived', commitment: data }, null, 2) }] };
        }

        if (args.action === 'log_contribution') {
          if (!args.contributionAmount || !args.accountId) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Validation Error: contributionAmount and accountId are required for log_contribution.',
                },
              ],
            };
          }

          const amount = Number(args.contributionAmount);
          const txMeta = getInsertMetadata();
          const txPayload = {
            user_id: auth.userId,
            title: `Commitment: ${existing.title}`,
            merchant_name: existing.recipient_name,
            amount,
            type: 'expense',
            account_id: args.accountId,
            date: dateIst,
            month_key: monthKey,
            linked_commitment_id: existing.id,
            commitment_contribution_type: args.contributionType || 'direct_payment',
            tags: ['commitment_contribution'],
            notes: args.notes || `Fulfilled monthly commitment for ${existing.recipient_name}`,
            ...txMeta,
          };

          const { data: tx, error: txErr } = await supabase.from('finance_transactions').insert(txPayload).select().single();
          if (txErr) throw txErr;

          await applyAccountBalanceDelta(supabase, auth.userId, [{ accountId: args.accountId, delta: -amount }]);

          // Calculate updated ledger
          const { data: txs } = await supabase
            .from('finance_transactions')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('linked_commitment_id', existing.id)
            .is('deleted_at', null);

          const ledger = calculateCommitmentLedger(
            mapMonthlyCommitmentFromRow(existing),
            monthKey,
            (txs || []).map(mapFinanceTransactionFromRow)
          );

          await logMcpToolInvocation(auth, {
            toolName: 'manage_monthly_commitment',
            action: 'log_contribution',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ action: 'contribution_logged', loggedTransaction: tx, monthLedger: ledger }, null, 2),
              },
            ],
          };
        }

        if (args.action === 'update') {
          const updates: Record<string, any> = {};
          if (args.title !== undefined) updates.title = args.title.trim();
          if (args.recipientName !== undefined) updates.recipient_name = args.recipientName.trim();
          if (args.relationship !== undefined) updates.relationship = args.relationship.trim();
          if (args.monthlyTargetAmount !== undefined) updates.monthly_target_amount = args.monthlyTargetAmount;
          if (args.dueDayOfMonth !== undefined) updates.due_day_of_month = args.dueDayOfMonth;
          if (args.autoRolloverOverpayment !== undefined) {
            updates.auto_rollover_overpayment = args.autoRolloverOverpayment;
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('monthly_commitments')
            .update({ ...updates, ...meta })
            .eq('id', args.commitmentId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_monthly_commitment',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', commitment: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_monthly_commitment',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage commitment: ${err.message}` }] };
      }
    }
  );
}
