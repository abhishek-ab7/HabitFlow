import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext, hasScope } from '../auth';
import { getSupabaseAdmin } from '../supabase-admin';
import { getIstIsoDate, getIstMonthKey } from '../config';
import { getInsertMetadata, getUpdateMetadata, getSoftDeleteMetadata } from '../sync-helpers';
import { logMcpToolInvocation } from '../audit';
import {
  mapCreditCardStatementFromRow,
  mapDebtInstallmentFromRow,
  mapDebtRecordFromRow,
  mapEmiTrackerFromRow,
  mapFinanceAccountFromRow,
  mapFinanceBudgetFromRow,
  mapFinanceCategoryFromRow,
  mapFinanceRecurringBillFromRow,
  mapFinanceSipPlanFromRow,
  mapFinanceTransactionFromRow,
  mapMonthlyCommitmentFromRow,
} from '../mappers';
import {
  calculateMonthlySummary,
  calculateNetWorthSummary,
  calculateUpcomingFinancialObligations,
} from '@/lib/finance/shared-analytics';
import { buildCashFlowForecast } from '@/lib/finance/forecast';
import { detectSpendingAnomalies } from '@/lib/finance/anomalies';
import {
  normalizePaydayOfMonth,
  parsePaydayFromNotes,
  resolveEffectivePaydayOfMonth,
  upsertPaydayNoteTag,
} from '@/lib/finance/payday';

export function registerFinanceCoreTools(server: McpServer) {
  // 14. get_finance_overview
  server.registerTool(
    'get_finance_overview',
    {
      title: 'Get Finance Overview',
      description:
        'Retrieves monthly income, expenses, investments, net savings, budget pace, category breakdown, net worth, and upcoming obligations.',
      inputSchema: {
        monthKey: z
          .string()
          .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM')
          .optional()
          .describe('Target month (defaults to current month in IST)'),
        includeForecast: z.boolean().optional().default(false).describe('Include 30-day cash flow runway projection'),
        includeAnomalies: z.boolean().optional().default(false).describe('Include detected spending anomalies'),
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

      const monthKey = args.monthKey || getIstMonthKey();
      const referenceDate = getIstIsoDate();
      const supabase = getSupabaseAdmin();

      const [
        { data: accounts },
        { data: txs },
        { data: categories },
        { data: budgets },
        { data: commitments },
        { data: emis },
        { data: debts },
        { data: debtInsts },
        { data: bills },
        { data: sips },
        { data: ccStatements },
      ] = await Promise.all([
        supabase.from('finance_accounts').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_transactions').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_categories').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_budgets').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('monthly_commitments').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('emi_trackers').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('debt_records').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('debt_installments').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_recurring_bills').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('finance_sip_plans').select('*').eq('user_id', auth.userId).is('deleted_at', null),
        supabase.from('credit_card_statements').select('*').eq('user_id', auth.userId).is('deleted_at', null),
      ]);

      const mappedAccounts = (accounts || []).map(mapFinanceAccountFromRow);
      const mappedTxs = (txs || []).map(mapFinanceTransactionFromRow);
      const mappedCategories = (categories || []).map(mapFinanceCategoryFromRow);
      const mappedBudgets = (budgets || []).map(mapFinanceBudgetFromRow);
      const mappedCommitments = (commitments || []).map(mapMonthlyCommitmentFromRow);
      const mappedEmis = (emis || []).map(mapEmiTrackerFromRow);
      const mappedDebts = (debts || []).map(mapDebtRecordFromRow);
      const mappedDebtInsts = (debtInsts || []).map(mapDebtInstallmentFromRow);
      const mappedBills = (bills || []).map(mapFinanceRecurringBillFromRow);
      const mappedSips = (sips || []).map(mapFinanceSipPlanFromRow);
      const mappedCcStatements = (ccStatements || []).map(mapCreditCardStatementFromRow);

      const monthlySummary = calculateMonthlySummary({
        monthKey,
        transactions: mappedTxs,
        categories: mappedCategories,
        budgets: mappedBudgets,
        commitments: mappedCommitments,
        emiTrackers: mappedEmis,
        debtRecords: mappedDebts,
        debtInstallments: mappedDebtInsts,
        recurringBills: mappedBills,
        sipPlans: mappedSips,
        referenceDate,
      });

      const netWorth = calculateNetWorthSummary({
        accounts: mappedAccounts,
        sipPlans: mappedSips,
        debtRecords: mappedDebts,
        emiTrackers: mappedEmis,
      });

      const upcomingObligations = calculateUpcomingFinancialObligations({
        emiTrackers: mappedEmis,
        commitments: mappedCommitments,
        debtRecords: mappedDebts,
        debtInstallments: mappedDebtInsts,
        recurringBills: mappedBills,
        sipPlans: mappedSips,
        transactions: mappedTxs,
        currentDate: referenceDate,
        withinDays: 7,
      });

      let forecast = null;
      if (args.includeForecast) {
        forecast = buildCashFlowForecast({
          accounts: mappedAccounts,
          transactions: mappedTxs,
          budgets: mappedBudgets,
          recurringBills: mappedBills,
          emiTrackers: mappedEmis,
          sipPlans: mappedSips,
          commitments: mappedCommitments,
          creditCardStatements: mappedCcStatements,
          horizonDays: 30,
          referenceDate,
        });
      }

      let anomalies = null;
      if (args.includeAnomalies) {
        anomalies = detectSpendingAnomalies({
          selectedMonth: monthKey,
          transactions: mappedTxs,
          categories: mappedCategories,
          accounts: mappedAccounts,
          debtRecords: mappedDebts,
          recurringBills: mappedBills,
          upcomingObligations7d: upcomingObligations,
        });
      }

      const result = {
        monthKey,
        referenceDateIst: referenceDate,
        summary: monthlySummary,
        netWorth,
        upcomingObligations,
        forecast,
        anomalies,
      };

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 15. manage_finance_account
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
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }
        let query = supabase
          .from('finance_accounts')
          .select('*')
          .eq('user_id', auth.userId);

        if (!args.includeArchived) {
          query = query.is('deleted_at', null).eq('is_archived', false);
        }
        const { data, error } = await query.order('name');

        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch accounts: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, accounts: data }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }

      const start = Date.now();

      try {
        if (args.action === 'create') {
          if (!args.name || !args.type) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: name and type are required for create.' }] };
          }

          const meta = getInsertMetadata();
          const newAccount = {
            user_id: auth.userId,
            name: args.name.trim(),
            type: args.type,
            balance: args.balance ?? 0,
            credit_limit: args.creditLimit ?? 0,
            billing_day: args.statementDay ?? null,
            statement_day: args.statementDay ?? null,
            due_day: args.dueDay ?? null,
            grace_period_days: args.gracePeriodDays ?? 20,
            include_in_net_worth: args.includeInNetWorth ?? true,
            currency: args.currency || 'INR',
            icon: args.icon || 'Landmark',
            color: args.color || '#10b981',
            is_default: args.isDefault ?? false,
            is_archived: false,
            ...meta,
          };

          const { data, error } = await supabase.from('finance_accounts').insert(newAccount).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_account',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'created', account: data }, null, 2) }] };
        }

        if (!args.accountId) {
          return { isError: true, content: [{ type: 'text', text: 'Validation Error: accountId is required.' }] };
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('finance_accounts')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('id', args.accountId)
          .single();

        if (fetchErr || !existing) {
          return { isError: true, content: [{ type: 'text', text: `Account not found: ${args.accountId}` }] };
        }

        if (args.action === 'archive') {
          if (!args.confirm) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Confirmation Required: Archiving this account requires confirm: true in tool arguments.',
                },
              ],
            };
          }

          const meta = getSoftDeleteMetadata(existing);
          const { data, error } = await supabase
            .from('finance_accounts')
            .update({ is_archived: true, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.accountId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_account',
            action: 'archive',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'archived', account: data }, null, 2) }] };
        }

        if (args.action === 'restore') {
          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_accounts')
            .update({ is_archived: false, deleted_at: null, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.accountId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_account',
            action: 'restore',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'restored', account: data }, null, 2) }] };
        }

        if (args.action === 'reconcile_balance') {
          if (args.balance === undefined) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: balance is required for reconcile_balance.' }] };
          }

          const previousBalance = Number(existing.balance || 0);
          const newBalance = Number(args.balance);
          const meta = getUpdateMetadata(existing);

          const { data, error } = await supabase
            .from('finance_accounts')
            .update({ balance: newBalance, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.accountId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_account',
            action: 'reconcile_balance',
            input: { ...args, previousBalance, newBalance },
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    action: 'reconciled',
                    accountId: args.accountId,
                    previousBalance,
                    newBalance,
                    account: data,
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
          if (args.name !== undefined) updates.name = args.name.trim();
          if (args.type !== undefined) updates.type = args.type;
          if (args.balance !== undefined) updates.balance = args.balance;
          if (args.creditLimit !== undefined) updates.credit_limit = args.creditLimit;
          if (args.statementDay !== undefined) {
            updates.statement_day = args.statementDay;
            updates.billing_day = args.statementDay;
          }
          if (args.dueDay !== undefined) updates.due_day = args.dueDay;
          if (args.gracePeriodDays !== undefined) updates.grace_period_days = args.gracePeriodDays;
          if (args.includeInNetWorth !== undefined) updates.include_in_net_worth = args.includeInNetWorth;
          if (args.currency !== undefined) updates.currency = args.currency;
          if (args.icon !== undefined) updates.icon = args.icon;
          if (args.color !== undefined) updates.color = args.color;
          if (args.isDefault !== undefined) updates.is_default = args.isDefault;

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_accounts')
            .update({ ...updates, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.accountId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_account',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', account: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_finance_account',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage account: ${err.message}` }] };
      }
    }
  );

  // 16. manage_finance_category
  server.registerTool(
    'manage_finance_category',
    {
      title: 'Manage Finance Category & Rules',
      description:
        'List, create, update, archive, or restore expense/income categories, and manage automatic merchant categorization rules.',
      inputSchema: {
        action: z
          .enum(['list', 'create', 'update', 'archive', 'restore', 'list_rules', 'upsert_rule', 'delete_rule', 'restore_rule'])
          .describe('Action to perform'),
        categoryId: z.string().uuid().optional().describe('Category UUID (required for update, archive, restore)'),
        name: z.string().min(1).max(100).optional().describe('Category name'),
        slug: z.string().optional().describe('Unique category slug'),
        type: z.enum(['expense', 'income', 'both']).optional().describe('Category flow type'),
        monthlyBudgetLimit: z.number().min(0).optional().describe('Default monthly budget limit for this category'),
        rolloverEnabled: z.boolean().optional().describe('Whether unspent budget rolls over to next month'),
        subcategories: z.array(z.string()).optional().describe('Subcategories list'),
        orderIndex: z.number().int().optional().describe('Display sort order index'),
        icon: z.string().optional(),
        color: z.string().optional(),
        includeArchived: z.boolean().optional().default(false).describe('Include archived/deleted categories when listing'),
        includeInactive: z.boolean().optional().default(false).describe('Include deleted/inactive rules when listing rules'),
        // Rule specific fields
        rulePattern: z.string().optional().describe('Merchant matching pattern string'),
        cleanMerchantName: z.string().optional().describe('Clean normalized merchant name'),
        ruleMatchType: z.enum(['contains', 'exact', 'starts_with', 'regex']).optional(),
        ruleSubcategory: z.string().optional(),
        defaultTags: z.array(z.string()).optional().describe('Default tags applied by this rule'),
        ruleId: z.string().uuid().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for destructive actions like archive or delete_rule'),
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
        let query = supabase
          .from('finance_categories')
          .select('*')
          .eq('user_id', auth.userId);
        if (!args.includeArchived) {
          query = query.is('deleted_at', null).eq('is_archived', false);
        }
        const { data, error } = await query.order('order_index');

        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch categories: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, categories: data }, null, 2) }] };
      }

      if (args.action === 'list_rules') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }
        let query = supabase
          .from('finance_categorization_rules')
          .select('*')
          .eq('user_id', auth.userId);
        if (!args.includeInactive) {
          query = query.is('deleted_at', null).eq('is_active', true);
        }
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch rules: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, rules: data }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }

      const start = Date.now();

      try {
        if (args.action === 'create') {
          if (!args.name) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: name is required for create.' }] };
          }

          const slug = args.slug || args.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const meta = getInsertMetadata();
          const newCat = {
            user_id: auth.userId,
            name: args.name.trim(),
            slug,
            type: args.type || 'expense',
            icon: args.icon || 'Tag',
            color: args.color || '#6B7280',
            monthly_budget_limit: args.monthlyBudgetLimit ?? 0,
            rollover_enabled: args.rolloverEnabled ?? false,
            subcategories: args.subcategories || [],
            order_index: args.orderIndex ?? 0,
            is_system: false,
            is_archived: false,
            ...meta,
          };

          const { data, error } = await supabase.from('finance_categories').insert(newCat).select().single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_category',
            action: 'create',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'created', category: data }, null, 2) }] };
        }

        if (args.action === 'archive') {
          if (!args.categoryId) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: categoryId is required.' }] };
          }
          if (!args.confirm) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Confirmation Required: Archiving this category requires confirm: true.' }],
            };
          }

          const { data: existing } = await supabase
            .from('finance_categories')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.categoryId)
            .single();

          if (!existing) {
            return { isError: true, content: [{ type: 'text', text: 'Category not found.' }] };
          }
          if (existing.is_system) {
            return { isError: true, content: [{ type: 'text', text: 'Forbidden: System categories cannot be deleted or archived.' }] };
          }

          const meta = getSoftDeleteMetadata(existing);
          const { data, error } = await supabase
            .from('finance_categories')
            .update({ is_archived: true, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.categoryId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_category',
            action: 'archive',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'archived', category: data }, null, 2) }] };
        }

        if (args.action === 'restore') {
          if (!args.categoryId) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: categoryId is required.' }] };
          }
          const { data: existing } = await supabase
            .from('finance_categories')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.categoryId)
            .single();
          if (!existing) {
            return { isError: true, content: [{ type: 'text', text: 'Category not found.' }] };
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_categories')
            .update({ is_archived: false, deleted_at: null, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.categoryId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_category',
            action: 'restore',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'restored', category: data }, null, 2) }] };
        }

        if (args.action === 'upsert_rule') {
          if (!args.rulePattern || !args.categoryId) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Validation Error: rulePattern and categoryId are required for upsert_rule.' }],
            };
          }

          const cleanPattern = args.rulePattern.trim();
          const cleanMerchant = args.cleanMerchantName?.trim() || cleanPattern;
          let resultRule = null;
          if (args.ruleId) {
            const { data: existing } = await supabase
              .from('finance_categorization_rules')
              .select('*')
              .eq('user_id', auth.userId)
              .eq('id', args.ruleId)
              .single();

            const meta = getUpdateMetadata(existing);
            const { data, error } = await supabase
              .from('finance_categorization_rules')
              .update({
                match_pattern: cleanPattern,
                clean_merchant_name: cleanMerchant,
                category_id: args.categoryId,
                subcategory: args.ruleSubcategory || null,
                default_tags: args.defaultTags ?? existing?.default_tags ?? [],
                is_active: true,
                deleted_at: null,
                ...meta,
              })
              .eq('user_id', auth.userId)
              .eq('id', args.ruleId)
              .select()
              .single();

            if (error) throw error;
            resultRule = data;
          } else {
            const meta = getInsertMetadata();
            const { data, error } = await supabase
              .from('finance_categorization_rules')
              .insert({
                user_id: auth.userId,
                match_pattern: cleanPattern,
                clean_merchant_name: cleanMerchant,
                category_id: args.categoryId,
                subcategory: args.ruleSubcategory || null,
                default_tags: args.defaultTags || [],
                is_active: true,
                ...meta,
              })
              .select()
              .single();

            if (error) throw error;
            resultRule = data;
          }

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_category',
            action: 'upsert_rule',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'rule_saved', rule: resultRule }, null, 2) }] };
        }

        if (args.action === 'delete_rule') {
          if (!args.ruleId) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: ruleId is required for delete_rule.' }] };
          }
          if (!args.confirm) {
            return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: confirm: true required.' }] };
          }

          const { data: existing } = await supabase
            .from('finance_categorization_rules')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.ruleId)
            .single();

          if (!existing) {
            return { isError: true, content: [{ type: 'text', text: 'Categorization rule not found.' }] };
          }

          const meta = getSoftDeleteMetadata(existing);
          const { error } = await supabase
            .from('finance_categorization_rules')
            .update({ is_active: false, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.ruleId);

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_category',
            action: 'delete_rule',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'rule_deleted', ruleId: args.ruleId }, null, 2) }] };
        }

        if (args.action === 'restore_rule') {
          if (!args.ruleId) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: ruleId is required for restore_rule.' }] };
          }
          const { data: existing } = await supabase
            .from('finance_categorization_rules')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.ruleId)
            .single();
          if (!existing) {
            return { isError: true, content: [{ type: 'text', text: 'Categorization rule not found.' }] };
          }

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_categorization_rules')
            .update({ is_active: true, deleted_at: null, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.ruleId)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_category',
            action: 'restore_rule',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'rule_restored', rule: data }, null, 2) }] };
        }

        if (args.action === 'update') {
          if (!args.categoryId) {
            return { isError: true, content: [{ type: 'text', text: 'Validation Error: categoryId is required.' }] };
          }

          const { data: existing } = await supabase
            .from('finance_categories')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('id', args.categoryId)
            .single();

          if (!existing) {
            return { isError: true, content: [{ type: 'text', text: 'Category not found.' }] };
          }

          const updates: Record<string, any> = {};
          if (args.name !== undefined) updates.name = args.name.trim();
          if (args.type !== undefined) updates.type = args.type;
          if (args.monthlyBudgetLimit !== undefined) updates.monthly_budget_limit = args.monthlyBudgetLimit;
          if (args.rolloverEnabled !== undefined) updates.rollover_enabled = args.rolloverEnabled;
          if (args.subcategories !== undefined) updates.subcategories = args.subcategories;
          if (args.orderIndex !== undefined) updates.order_index = args.orderIndex;
          if (args.icon !== undefined) updates.icon = args.icon;
          if (args.color !== undefined) updates.color = args.color;

          const meta = getUpdateMetadata(existing);
          const { data, error } = await supabase
            .from('finance_categories')
            .update({ ...updates, ...meta })
            .eq('user_id', auth.userId)
            .eq('id', args.categoryId)
            .select()
            .single();

          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_category',
            action: 'update',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', category: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_finance_category',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage category: ${err.message}` }] };
      }
    }
  );

  // 17. manage_finance_budget
  server.registerTool(
    'manage_finance_budget',
    {
      title: 'Manage Finance Budget',
      description:
        'Get, list, upsert, delete (soft-delete), or restore monthly spending caps, expected income, planned SIP allocation, and per-category budget limits.',
      inputSchema: {
        action: z.enum(['get', 'list', 'upsert', 'delete', 'restore']).describe('Action to perform'),
        budgetId: z.string().uuid().optional().describe('Optional budget UUID for delete/restore'),
        monthKey: z
          .string()
          .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM')
          .optional()
          .describe('Month key (defaults to current month in IST)'),
        limit: z.number().int().min(1).max(24).optional().default(12).describe('Number of months for list'),
        includeDeleted: z.boolean().optional().default(false),
        totalBudget: z.number().min(0).optional().describe('Overall monthly spending limit'),
        expectedIncome: z.number().min(0).optional().describe('Expected monthly salary/inflows'),
        plannedSipAmount: z.number().min(0).optional().describe('Planned monthly SIP investment goal'),
        paydayOfMonth: z.number().int().min(1).max(31).optional().describe('Day of month (1-31) when salary/expected income arrives'),
        budgetMode: z.enum(['cap', 'zero_based']).optional(),
        assignedIncome: z.number().min(0).optional(),
        notes: z.string().optional(),
        categoryLimits: z
          .array(
            z.object({
              categoryId: z.string().uuid(),
              monthlyBudgetLimit: z.number().min(0),
            })
          )
          .optional()
          .describe('Optional batch updates to individual category monthly budget limits'),
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
      const monthKey = args.monthKey || getIstMonthKey();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }
        let query = supabase.from('finance_budgets').select('*').eq('user_id', auth.userId);
        if (!args.includeDeleted) query = query.is('deleted_at', null);
        const { data, error } = await query.order('month_key', { ascending: false }).limit(args.limit || 12);
        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to list budgets: ${error.message}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, budgets: data || [] }, null, 2) }] };
      }

      if (args.action === 'get') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }

        const [{ data: allBudgets }, { data: categories }] = await Promise.all([
          supabase
            .from('finance_budgets')
            .select('*')
            .eq('user_id', auth.userId)
            .is('deleted_at', null),
          supabase
            .from('finance_categories')
            .select('id, name, monthly_budget_limit')
            .eq('user_id', auth.userId)
            .is('deleted_at', null),
        ]);

        const mappedBudgets = (allBudgets || []).map(mapFinanceBudgetFromRow);
        const budget = (allBudgets || []).find((b: any) => b.month_key === monthKey) ?? null;
        const effectivePaydayOfMonth =
          resolveEffectivePaydayOfMonth(mappedBudgets, monthKey) ?? 1;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  monthKey,
                  budget: budget
                    ? {
                        ...budget,
                        payday_of_month:
                          normalizePaydayOfMonth(budget.payday_of_month) ??
                          parsePaydayFromNotes(budget.notes) ??
                          effectivePaydayOfMonth,
                      }
                    : null,
                  effectivePaydayOfMonth,
                  categoryBudgets: categories || [],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (args.action === 'upsert') {
        if (!hasScope(auth, 'habitflow:finance:write')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
        }

        const start = Date.now();
        const isMissingPaydayColError = (err: any) =>
          Boolean(
            err &&
              (err.code === 'PGRST204' ||
                err.code === '42703' ||
                String(err.message || '').includes('payday_of_month'))
          );
        try {
          const { data: existing } = await supabase
            .from('finance_budgets')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('month_key', monthKey)
            .is('deleted_at', null)
            .maybeSingle();

          let savedBudget: Record<string, any> | null = null;
          const normalizedPayday =
            args.paydayOfMonth !== undefined
              ? normalizePaydayOfMonth(args.paydayOfMonth)
              : undefined;

          if (existing) {
            const updates: Record<string, any> = {};
            if (args.totalBudget !== undefined) updates.total_budget = args.totalBudget;
            if (args.expectedIncome !== undefined) updates.expected_income = args.expectedIncome;
            if (args.plannedSipAmount !== undefined) updates.planned_sip_amount = args.plannedSipAmount;
            if (normalizedPayday !== undefined) updates.payday_of_month = normalizedPayday;
            if (args.budgetMode !== undefined) updates.budget_mode = args.budgetMode;
            if (args.assignedIncome !== undefined) updates.assigned_income = args.assignedIncome;
            if (args.notes !== undefined) updates.notes = args.notes;

            const meta = getUpdateMetadata(existing);
            let { data, error } = await supabase
              .from('finance_budgets')
              .update({ ...updates, ...meta })
              .eq('id', existing.id)
              .select()
              .single();

            if (error && normalizedPayday !== undefined && isMissingPaydayColError(error)) {
              const fallbackUpdates = { ...updates };
              delete fallbackUpdates.payday_of_month;
              fallbackUpdates.notes = upsertPaydayNoteTag(
                args.notes !== undefined ? args.notes : existing.notes,
                normalizedPayday
              );
              const retry = await supabase
                .from('finance_budgets')
                .update({ ...fallbackUpdates, ...meta })
                .eq('id', existing.id)
                .select()
                .single();
              data = retry.data;
              error = retry.error;
            }

            if (error) throw error;
            savedBudget = data;
          } else {
            const meta = getInsertMetadata();
            const insertPayload: Record<string, any> = {
              user_id: auth.userId,
              month_key: monthKey,
              total_budget: args.totalBudget ?? 0,
              expected_income: args.expectedIncome ?? 0,
              planned_sip_amount: args.plannedSipAmount ?? 0,
              ...(normalizedPayday !== undefined ? { payday_of_month: normalizedPayday } : {}),
              budget_mode: args.budgetMode || 'cap',
              assigned_income: args.assignedIncome ?? 0,
              notes: args.notes || null,
              currency: 'INR',
              ...meta,
            };
            let { data, error } = await supabase
              .from('finance_budgets')
              .insert(insertPayload)
              .select()
              .single();

            if (error && normalizedPayday !== undefined && isMissingPaydayColError(error)) {
              const fallbackInsert = { ...insertPayload };
              delete fallbackInsert.payday_of_month;
              fallbackInsert.notes = upsertPaydayNoteTag(args.notes, normalizedPayday);
              const retry = await supabase
                .from('finance_budgets')
                .insert(fallbackInsert)
                .select()
                .single();
              data = retry.data;
              error = retry.error;
            }

            if (error) throw error;
            savedBudget = data;
          }

          // Apply any category limits updates
          const updatedCategories = [];
          if (args.categoryLimits && args.categoryLimits.length > 0) {
            for (const item of args.categoryLimits) {
              const { data: cat } = await supabase
                .from('finance_categories')
                .select('*')
                .eq('user_id', auth.userId)
                .eq('id', item.categoryId)
                .single();

              if (cat) {
                const catMeta = getUpdateMetadata(cat);
                const { data: updatedCat } = await supabase
                  .from('finance_categories')
                  .update({ monthly_budget_limit: item.monthlyBudgetLimit, ...catMeta })
                  .eq('id', cat.id)
                  .select()
                  .single();
                if (updatedCat) updatedCategories.push(updatedCat);
              }
            }
          }

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_budget',
            action: 'upsert',
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
                    action: 'budget_upserted',
                    monthKey,
                    budget: savedBudget,
                    updatedCategoryLimits: updatedCategories,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (err: any) {
          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_budget',
            action: 'upsert',
            input: args,
            status: 'error',
            errorMessage: err.message,
            durationMs: Date.now() - start,
          });
          return { isError: true, content: [{ type: 'text', text: `Failed to update budget: ${err.message}` }] };
        }
      }

      if (args.action === 'delete' || args.action === 'restore') {
        if (!hasScope(auth, 'habitflow:finance:write')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
        }
        if (args.action === 'delete' && !args.confirm) {
          return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: Deleting a budget requires confirm: true.' }] };
        }

        const start = Date.now();
        try {
          let query = supabase.from('finance_budgets').select('*').eq('user_id', auth.userId);
          query = args.budgetId ? query.eq('id', args.budgetId) : query.eq('month_key', monthKey);
          const { data: existing, error: fetchErr } = await query.maybeSingle();
          if (fetchErr) throw fetchErr;
          if (!existing) {
            return { isError: true, content: [{ type: 'text', text: `Budget not found for ${args.budgetId || monthKey}` }] };
          }

          const patch =
            args.action === 'delete'
              ? getSoftDeleteMetadata(existing)
              : { deleted_at: null, ...getUpdateMetadata(existing) };

          const { data, error } = await supabase
            .from('finance_budgets')
            .update(patch)
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;

          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_budget',
            action: args.action,
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });
          return { content: [{ type: 'text', text: JSON.stringify({ action: args.action === 'delete' ? 'deleted' : 'restored', budget: data }, null, 2) }] };
        } catch (err: any) {
          await logMcpToolInvocation(auth, {
            toolName: 'manage_finance_budget',
            action: args.action,
            input: args,
            status: 'error',
            errorMessage: err.message,
            durationMs: Date.now() - start,
          });
          return { isError: true, content: [{ type: 'text', text: `Failed to ${args.action} budget: ${err.message}` }] };
        }
      }

      return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
    }
  );

  // 18. manage_net_worth_snapshot
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
        monthKey: z
          .string()
          .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM')
          .optional()
          .describe('Month key (defaults to current month in IST)'),
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
      const auth = getMcpAuthContext();
      const supabase = getSupabaseAdmin();

      if (args.action === 'list') {
        if (!hasScope(auth, 'habitflow:finance:read')) {
          return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:read scope.' }] };
        }

        let query = supabase
          .from('finance_net_worth_snapshots')
          .select('*')
          .eq('user_id', auth.userId);
        if (!args.includeDeleted) {
          query = query.is('deleted_at', null);
        }
        const { data, error } = await query
          .order('month_key', { ascending: false })
          .limit(args.months || 6);

        if (error) {
          return { isError: true, content: [{ type: 'text', text: `Failed to fetch net worth history: ${error.message}` }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify({ count: (data || []).length, snapshots: data }, null, 2) }] };
      }

      if (!hasScope(auth, 'habitflow:finance:write')) {
        return { isError: true, content: [{ type: 'text', text: 'Forbidden: Missing habitflow:finance:write scope.' }] };
      }

      const start = Date.now();
      const monthKey = args.monthKey || getIstMonthKey();

      if (args.action === 'capture') {
        try {
          const [{ data: accounts }, { data: sips }, { data: debts }, { data: emis }] = await Promise.all([
            supabase.from('finance_accounts').select('*').eq('user_id', auth.userId).is('deleted_at', null),
            supabase.from('finance_sip_plans').select('*').eq('user_id', auth.userId).is('deleted_at', null),
            supabase.from('debt_records').select('*').eq('user_id', auth.userId).is('deleted_at', null),
            supabase.from('emi_trackers').select('*').eq('user_id', auth.userId).is('deleted_at', null),
          ]);

          const nw = calculateNetWorthSummary({
            accounts: (accounts || []).map(mapFinanceAccountFromRow),
            sipPlans: (sips || []).map(mapFinanceSipPlanFromRow),
            debtRecords: (debts || []).map(mapDebtRecordFromRow),
            emiTrackers: (emis || []).map(mapEmiTrackerFromRow),
          });

          const snapshotDate = args.snapshotDate || getIstIsoDate();

          // Check if snapshot exists for (user_id, month_key)
          const { data: existing } = await supabase
            .from('finance_net_worth_snapshots')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('month_key', monthKey)
            .maybeSingle();

          let savedSnapshot = null;

          if (existing) {
            const meta = getUpdateMetadata(existing);
            const { data, error } = await supabase
              .from('finance_net_worth_snapshots')
              .update({
                snapshot_date: snapshotDate,
                deleted_at: null,
                total_assets: nw.totalAssets,
                total_liabilities: nw.totalLiabilities,
                net_worth: nw.netWorth,
                liquid_assets: nw.liquidAssets,
                investment_assets: nw.investmentAssets,
                credit_card_liabilities: nw.creditCardLiabilities,
                emi_remaining_principal: nw.emiRemainingPrincipal,
                friend_receivables: nw.friendReceivables,
                friend_payables: nw.friendPayables,
                ...meta,
              })
              .eq('id', existing.id)
              .select()
              .single();

            if (error) throw error;
            savedSnapshot = data;
          } else {
            const meta = getInsertMetadata();
            const { data, error } = await supabase
              .from('finance_net_worth_snapshots')
              .insert({
                user_id: auth.userId,
                month_key: monthKey,
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
                ...meta,
              })
              .select()
              .single();

            if (error) throw error;
            savedSnapshot = data;
          }

          await logMcpToolInvocation(auth, {
            toolName: 'manage_net_worth_snapshot',
            action: 'capture',
            input: args,
            status: 'ok',
            durationMs: Date.now() - start,
          });

          return { content: [{ type: 'text', text: JSON.stringify({ action: 'captured', snapshot: savedSnapshot }, null, 2) }] };
        } catch (err: any) {
          await logMcpToolInvocation(auth, {
            toolName: 'manage_net_worth_snapshot',
            action: 'capture',
            input: args,
            status: 'error',
            errorMessage: err.message,
            durationMs: Date.now() - start,
          });
          return { isError: true, content: [{ type: 'text', text: `Failed to capture snapshot: ${err.message}` }] };
        }
      }

      try {
        let query = supabase.from('finance_net_worth_snapshots').select('*').eq('user_id', auth.userId);
        query = args.snapshotId ? query.eq('id', args.snapshotId) : query.eq('month_key', monthKey);
        const { data: existing, error: fetchErr } = await query.maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!existing) {
          return { isError: true, content: [{ type: 'text', text: `Net worth snapshot not found for ${args.snapshotId || monthKey}` }] };
        }

        if (args.action === 'delete') {
          if (!args.confirm) {
            return { isError: true, content: [{ type: 'text', text: 'Confirmation Required: Deleting snapshot requires confirm: true.' }] };
          }
          const { data, error } = await supabase
            .from('finance_net_worth_snapshots')
            .update(getSoftDeleteMetadata(existing))
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          await logMcpToolInvocation(auth, { toolName: 'manage_net_worth_snapshot', action: 'delete', input: args, status: 'ok', durationMs: Date.now() - start });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'deleted', snapshot: data }, null, 2) }] };
        }

        if (args.action === 'restore') {
          const { data, error } = await supabase
            .from('finance_net_worth_snapshots')
            .update({ deleted_at: null, ...getUpdateMetadata(existing) })
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          await logMcpToolInvocation(auth, { toolName: 'manage_net_worth_snapshot', action: 'restore', input: args, status: 'ok', durationMs: Date.now() - start });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'restored', snapshot: data }, null, 2) }] };
        }

        if (args.action === 'update') {
          const updates: Record<string, any> = {};
          if (args.snapshotDate !== undefined) updates.snapshot_date = args.snapshotDate;
          if (args.totalAssets !== undefined) updates.total_assets = args.totalAssets;
          if (args.totalLiabilities !== undefined) updates.total_liabilities = args.totalLiabilities;
          if (args.netWorth !== undefined) updates.net_worth = args.netWorth;
          if (args.liquidAssets !== undefined) updates.liquid_assets = args.liquidAssets;
          if (args.investmentAssets !== undefined) updates.investment_assets = args.investmentAssets;
          if (args.creditCardLiabilities !== undefined) updates.credit_card_liabilities = args.creditCardLiabilities;
          if (args.emiRemainingPrincipal !== undefined) updates.emi_remaining_principal = args.emiRemainingPrincipal;
          if (args.friendReceivables !== undefined) updates.friend_receivables = args.friendReceivables;
          if (args.friendPayables !== undefined) updates.friend_payables = args.friendPayables;

          const { data, error } = await supabase
            .from('finance_net_worth_snapshots')
            .update({ ...updates, ...getUpdateMetadata(existing) })
            .eq('user_id', auth.userId)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          await logMcpToolInvocation(auth, { toolName: 'manage_net_worth_snapshot', action: 'update', input: args, status: 'ok', durationMs: Date.now() - start });
          return { content: [{ type: 'text', text: JSON.stringify({ action: 'updated', snapshot: data }, null, 2) }] };
        }

        return { isError: true, content: [{ type: 'text', text: `Unknown action: ${args.action}` }] };
      } catch (err: any) {
        await logMcpToolInvocation(auth, {
          toolName: 'manage_net_worth_snapshot',
          action: args.action,
          input: args,
          status: 'error',
          errorMessage: err.message,
          durationMs: Date.now() - start,
        });
        return { isError: true, content: [{ type: 'text', text: `Failed to manage net worth snapshot: ${err.message}` }] };
      }
    }
  );
}
