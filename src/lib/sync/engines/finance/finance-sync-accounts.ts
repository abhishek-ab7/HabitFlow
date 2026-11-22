/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  type SyncStepResult,
  missingRemoteFinanceTables,
  isMissingRelationError,
  upsertWithColumnFallback,
  shouldApplyRemote,
} from './finance-sync-types';

export async function syncCategories(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  let hasError = false;

  const dirtyCategories = await db.financeCategories
    .where('userId')
    .equals(userId)
    .filter((c) => c.isDirty !== false)
    .toArray();

  for (const cat of dirtyCategories) {
    const payload = {
      id: cat.id,
      user_id: userId,
      name: cat.name,
      slug: cat.slug,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      monthly_budget_limit: Number(cat.monthlyBudgetLimit || 0),
      rollover_enabled: !!cat.rolloverEnabled,
      subcategories: cat.subcategories || [],
      order_index: cat.order ?? 0,
      is_system: !!cat.isSystem,
      is_archived: !!cat.archived || !!cat.deletedAt,
      deleted_at: cat.deletedAt || null,
      generation_counter: cat.generationCounter || 1,
      created_at: cat.createdAt || new Date().toISOString(),
      updated_at: cat.updatedAt || new Date().toISOString(),
    };
    const { error } = await upsertWithColumnFallback(supabase, 'finance_categories', payload);
    if (!error) {
      await db.financeCategories.update(cat.id, { isDirty: false });
      pushed++;
    } else {
      logger.error('[FinanceSyncEngine] Category upsert failed:', error);
      hasError = true;
    }
  }

  // Pull Remote Categories -> Local
  try {
    const { data: remoteCats, error: pullCatErr } = await (supabase
      .from('finance_categories') as any)
      .select('*')
      .eq('user_id', userId);
    if (!pullCatErr && Array.isArray(remoteCats)) {
      for (const r of remoteCats) {
        let local = await db.financeCategories.get(r.id);
        if (!local && r.slug) {
          const sameSlug = await db.financeCategories
            .where('userId')
            .equals(r.user_id)
            .filter((c) => c.slug === r.slug)
            .first();
          if (sameSlug && sameSlug.id !== r.id) {
            const txs = await db.financeTransactions.where('categoryId').equals(sameSlug.id).toArray();
            for (const tx of txs) {
              await db.financeTransactions.update(tx.id, { categoryId: r.id });
            }
            await db.financeCategories.delete(sameSlug.id);
            local = sameSlug;
          }
        }
        if (shouldApplyRemote(local, r)) {
          await db.financeCategories.put({
            id: r.id,
            userId: r.user_id,
            name: r.name,
            slug: r.slug,
            type: r.type,
            icon: r.icon,
            color: r.color,
            monthlyBudgetLimit: Number(r.monthly_budget_limit || 0),
            rolloverEnabled: r.rollover_enabled ?? local?.rolloverEnabled ?? false,
            subcategories: r.subcategories || [],
            order: r.order_index ?? 0,
            isSystem: !!r.is_system,
            archived: !!r.is_archived,
            deletedAt: r.deleted_at || (r.is_archived ? r.updated_at : null),
            generationCounter: r.generation_counter || 1,
            createdAt: r.created_at || r.updated_at || new Date().toISOString(),
            updatedAt: r.updated_at || new Date().toISOString(),
            isDirty: false,
          });
          pulled++;
        }
      }
    }
  } catch {
    // Non-fatal if remote table unavailable
  }

  return { pushed, pulled, hasError };
}

export async function syncAccounts(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  let hasError = false;

  const dirtyAccounts = await db.financeAccounts
    .where('userId')
    .equals(userId)
    .filter((a) => a.isDirty !== false)
    .toArray();

  for (const acc of dirtyAccounts) {
    const payload = {
      id: acc.id,
      user_id: userId,
      name: acc.name,
      type: acc.type,
      balance: Number(acc.balance || 0),
      credit_limit: acc.creditLimit !== undefined ? Number(acc.creditLimit) : null,
      billing_day: acc.billingDay ?? acc.statementDay ?? null,
      statement_day: acc.statementDay ?? acc.billingDay ?? null,
      due_day: acc.dueDay ?? null,
      grace_period_days: acc.gracePeriodDays ?? null,
      last_statement_checked_at: acc.lastStatementCheckedAt ?? null,
      include_in_net_worth: acc.includeInNetWorth !== false,
      currency: acc.currency || 'INR',
      color: acc.color || '#10b981',
      icon: acc.icon || 'Landmark',
      is_default: !!acc.isDefault,
      is_archived: !!acc.archived || !!acc.deletedAt,
      deleted_at: acc.deletedAt || null,
      generation_counter: acc.generationCounter || 1,
      created_at: acc.createdAt || new Date().toISOString(),
      updated_at: acc.updatedAt || new Date().toISOString(),
    };
    const { error } = await upsertWithColumnFallback(supabase, 'finance_accounts', payload);
    if (!error) {
      await db.financeAccounts.update(acc.id, { isDirty: false });
      pushed++;
    } else {
      logger.error('[FinanceSyncEngine] Account upsert failed:', error);
      hasError = true;
    }
  }

  // Pull Remote Accounts -> Local
  try {
    const { data: remoteAccs, error: pullAccErr } = await (supabase
      .from('finance_accounts') as any)
      .select('*')
      .eq('user_id', userId);
    if (!pullAccErr && Array.isArray(remoteAccs)) {
      for (const r of remoteAccs) {
        let local = await db.financeAccounts.get(r.id);
        if (!local && r.name && r.type) {
          const sameDefaultAcc = await db.financeAccounts
            .where('userId')
            .equals(r.user_id)
            .filter((a) => a.name === r.name && a.type === r.type && a.balance === 0 && !a.archived)
            .first();
          if (sameDefaultAcc && sameDefaultAcc.id !== r.id) {
            const txCount = await db.financeTransactions.where('accountId').equals(sameDefaultAcc.id).count();
            if (txCount === 0) {
              await db.financeAccounts.delete(sameDefaultAcc.id);
              local = sameDefaultAcc;
            }
          }
        }
        if (shouldApplyRemote(local, r)) {
          await db.financeAccounts.put({
            id: r.id,
            userId: r.user_id,
            name: r.name,
            type: r.type,
            balance: Number(r.balance || 0),
            creditLimit: r.credit_limit !== null && r.credit_limit !== undefined ? Number(r.credit_limit) : local?.creditLimit,
            billingDay: r.billing_day ?? r.statement_day ?? local?.billingDay,
            statementDay: r.statement_day ?? r.billing_day ?? local?.statementDay,
            dueDay: r.due_day ?? local?.dueDay,
            gracePeriodDays: r.grace_period_days ?? local?.gracePeriodDays,
            lastStatementCheckedAt: r.last_statement_checked_at ?? local?.lastStatementCheckedAt,
            includeInNetWorth: r.include_in_net_worth ?? local?.includeInNetWorth ?? true,
            currency: r.currency || 'INR',
            color: r.color || '#10b981',
            icon: r.icon || 'Wallet',
            isDefault: !!r.is_default,
            archived: !!r.is_archived,
            deletedAt: r.deleted_at || null,
            generationCounter: r.generation_counter || 1,
            createdAt: r.created_at || r.updated_at || new Date().toISOString(),
            updatedAt: r.updated_at || new Date().toISOString(),
            isDirty: false,
          });
          pulled++;
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return { pushed, pulled, hasError };
}

export async function syncCreditCardStatements(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  let hasError = false;

  try {
    if (db.creditCardStatements && !missingRemoteFinanceTables.has('credit_card_statements')) {
      const dirtyStatements = await db.creditCardStatements
        .where('userId')
        .equals(userId)
        .filter((s) => s.isDirty !== false)
        .toArray();

      for (const s of dirtyStatements) {
        if (s.deletedAt) {
          const { error } = await (supabase.from('credit_card_statements') as any)
            .delete()
            .eq('id', s.id)
            .eq('user_id', userId);
          if (error) {
            if (isMissingRelationError(error)) {
              missingRemoteFinanceTables.add('credit_card_statements');
              break;
            }
          } else {
            await db.creditCardStatements.delete(s.id);
            pushed++;
          }
          continue;
        }

        const payload = {
          id: s.id,
          user_id: userId,
          account_id: s.accountId,
          cycle_key: s.cycleKey,
          period_start: s.periodStart,
          period_end: s.periodEnd,
          due_date: s.dueDate,
          calculated_amount: Number(s.calculatedAmount || 0),
          manual_adjustment: Number(s.manualAdjustment || 0),
          total_due: Number(s.totalDue || 0),
          carried_forward_amount: Number(s.carriedForwardAmount || 0),
          paid_amount: Number(s.paidAmount || 0),
          remaining_due: Number(s.remainingDue || 0),
          status: s.status || 'billed',
          paid_at: s.paidAt || null,
          notes: s.notes || null,
          generation_counter: s.generationCounter || 1,
          created_at: s.createdAt || new Date().toISOString(),
          updated_at: s.updatedAt || new Date().toISOString(),
          deleted_at: s.deletedAt || null,
        };
        const { error } = await upsertWithColumnFallback(
          supabase,
          'credit_card_statements',
          payload,
          { onConflict: 'user_id,account_id,cycle_key' }
        );
        if (error) {
          if (isMissingRelationError(error)) {
            missingRemoteFinanceTables.add('credit_card_statements');
            logger.info('[FinanceSyncEngine] Skipping unmigrated table credit_card_statements for this session.');
            break;
          } else {
            logger.error('[FinanceSyncEngine] CreditCardStatement upsert failed:', error);
            hasError = true;
          }
        } else {
          await db.creditCardStatements.update(s.id, { isDirty: false });
          pushed++;
        }
      }

      if (!missingRemoteFinanceTables.has('credit_card_statements')) {
        const { data: remoteStmts, error: pullStmtError } = await (supabase.from('credit_card_statements') as any)
          .select('*')
          .eq('user_id', userId);
        if (pullStmtError && isMissingRelationError(pullStmtError)) {
          missingRemoteFinanceTables.add('credit_card_statements');
        } else if (Array.isArray(remoteStmts)) {
          for (const r of remoteStmts) {
            let local = await db.creditCardStatements.get(r.id);
            if (!local && r.account_id && r.cycle_key) {
              const sameCycle = await db.creditCardStatements
                .where('[accountId+cycleKey]')
                .equals([r.account_id, r.cycle_key])
                .first();
              if (sameCycle && sameCycle.id !== r.id) {
                if (shouldApplyRemote(sameCycle, r)) {
                  const linkedTxs = await db.financeTransactions
                    .where('userId')
                    .equals(userId)
                    .filter((t) => t.paidStatementId === sameCycle.id)
                    .toArray();
                  for (const ltx of linkedTxs) {
                    await db.financeTransactions.update(ltx.id, { paidStatementId: r.id });
                  }
                  await db.creditCardStatements.delete(sameCycle.id);
                }
                local = sameCycle;
              }
            }
            if (shouldApplyRemote(local, r)) {
              await db.creditCardStatements.put({
                id: r.id,
                userId: r.user_id,
                accountId: r.account_id,
                cycleKey: r.cycle_key,
                periodStart: r.period_start,
                periodEnd: r.period_end,
                dueDate: r.due_date,
                calculatedAmount: Number(r.calculated_amount || 0),
                manualAdjustment: Number(r.manualAdjustment || r.manual_adjustment || 0),
                totalDue: Number(r.total_due || 0),
                carriedForwardAmount: Number(r.carried_forward_amount || 0),
                paidAmount: Number(r.paid_amount || 0),
                remainingDue: Number(r.remaining_due || 0),
                status: r.status as any,
                paidAt: r.paid_at || null,
                notes: r.notes || undefined,
                generationCounter: r.generation_counter || 1,
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                updatedAt: r.updated_at || new Date().toISOString(),
                deletedAt: r.deleted_at || null,
                isDirty: false,
              });
              pulled++;
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return { pushed, pulled, hasError };
}

export async function syncBudgets(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  let hasError = false;

  const dirtyBudgets = await db.financeBudgets
    .where('userId')
    .equals(userId)
    .filter((b) => b.isDirty !== false)
    .toArray();

  for (const budget of dirtyBudgets) {
    if (budget.deletedAt) {
      const { error } = await (supabase.from('finance_budgets') as any)
        .delete()
        .eq('id', budget.id)
        .eq('user_id', userId);
      if (!error) {
        await db.financeBudgets.delete(budget.id);
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] Budget remote delete failed:', error);
        hasError = true;
      }
      continue;
    }

    const payload = {
      id: budget.id,
      user_id: userId,
      month_key: budget.monthKey,
      total_budget: budget.totalBudget,
      expected_income: budget.expectedIncome,
      planned_sip_amount: Number(budget.plannedSipAmount || 0),
      budget_mode: budget.budgetMode || 'cap',
      assigned_income: budget.assignedIncome !== undefined ? Number(budget.assignedIncome) : null,
      currency: budget.currency,
      notes: budget.notes || null,
      deleted_at: budget.deletedAt || null,
      generation_counter: budget.generationCounter || 1,
      created_at: budget.createdAt,
      updated_at: budget.updatedAt,
    };
    const { error } = await upsertWithColumnFallback(supabase, 'finance_budgets', payload, {
      onConflict: 'user_id,month_key',
    });
    if (!error) {
      await db.financeBudgets.update(budget.id, { isDirty: false });
      pushed++;
    } else {
      logger.error('[FinanceSyncEngine] Budget upsert failed:', error);
      hasError = true;
    }
  }

  // Pull Remote Finance Budgets -> Local
  try {
    const { data: remoteBudgets, error: pullBudgetErr } = await (supabase
      .from('finance_budgets') as any)
      .select('*')
      .eq('user_id', userId);
    if (!pullBudgetErr && Array.isArray(remoteBudgets)) {
      for (const r of remoteBudgets) {
        let local = await db.financeBudgets.get(r.id);
        if (!local && r.month_key) {
          const sameMonth = await db.financeBudgets
            .where('[userId+monthKey]')
            .equals([r.user_id, r.month_key])
            .first();
          if (sameMonth && sameMonth.id !== r.id) {
            await db.financeBudgets.delete(sameMonth.id);
            local = sameMonth;
          }
        }
        if (shouldApplyRemote(local, r)) {
          await db.financeBudgets.put({
            id: r.id,
            userId: r.user_id,
            monthKey: r.month_key,
            totalBudget: Number(r.total_budget || 0),
            expectedIncome: Number(r.expected_income || 0),
            plannedSipAmount: r.planned_sip_amount ? Number(r.planned_sip_amount) : (local?.plannedSipAmount ?? 0),
            budgetMode: r.budget_mode === 'zero_based' ? 'zero_based' : (local?.budgetMode || 'cap'),
            assignedIncome: r.assigned_income !== null && r.assigned_income !== undefined ? Number(r.assigned_income) : local?.assignedIncome,
            currency: r.currency || 'INR',
            notes: r.notes || undefined,
            deletedAt: r.deleted_at || null,
            generationCounter: r.generation_counter || 1,
            createdAt: r.created_at || r.updated_at || new Date().toISOString(),
            updatedAt: r.updated_at || new Date().toISOString(),
            isDirty: false,
          });
          pulled++;
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return { pushed, pulled, hasError };
}
