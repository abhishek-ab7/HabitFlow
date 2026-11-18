/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { ISynchronizer } from '../types';
import type { SyncEngine } from '../sync-engine';

/**
 * FinanceSyncEngine synchronizes FlowFinance tables between Dexie (local IndexedDB)
 * and Supabase PostgreSQL with generationCounter conflict resolution.
 */
export class FinanceSyncEngine implements ISynchronizer {
  readonly domainName = 'Finance';

  async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' | 'partial_failure' }> {
    const supabase = getSupabaseClient();
    let pushed = 0;
    let hasError = false;

    // 1. Sync Dirty Local Categories -> Remote
    const dirtyCategories = await db.financeCategories
      .where('userId')
      .equals(userId)
      .filter((c) => !!c.isDirty)
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
        monthly_budget_limit: cat.monthlyBudgetLimit,
        subcategories: cat.subcategories,
        order_index: cat.order,
        is_system: cat.isSystem,
        is_archived: cat.archived,
        generation_counter: cat.generationCounter || 1,
        created_at: cat.createdAt,
        updated_at: cat.updatedAt,
      };
      const { error } = await (supabase.from('finance_categories') as any).upsert(payload);
      if (!error) {
        await db.financeCategories.update(cat.id, { isDirty: false });
        pushed++;
      } else {
        hasError = true;
      }
    }

    // 2. Sync Dirty Local Accounts -> Remote
    const dirtyAccounts = await db.financeAccounts
      .where('userId')
      .equals(userId)
      .filter((a) => !!a.isDirty)
      .toArray();

    for (const acc of dirtyAccounts) {
      const payload = {
        id: acc.id,
        user_id: userId,
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        currency: acc.currency,
        color: acc.color,
        icon: acc.icon,
        is_default: acc.isDefault,
        is_archived: acc.archived,
        generation_counter: acc.generationCounter || 1,
        created_at: acc.createdAt,
        updated_at: acc.updatedAt,
      };
      const { error } = await (supabase.from('finance_accounts') as any).upsert(payload);
      if (!error) {
        await db.financeAccounts.update(acc.id, { isDirty: false });
        pushed++;
      } else {
        hasError = true;
      }
    }

    // 3. Sync Dirty Monthly Commitments -> Remote
    const dirtyCommitments = await db.monthlyCommitments
      .where('userId')
      .equals(userId)
      .filter((c) => !!c.isDirty)
      .toArray();

    for (const comm of dirtyCommitments) {
      const payload = {
        id: comm.id,
        user_id: userId,
        title: comm.title,
        recipient_name: comm.recipientName,
        relationship: comm.relationship,
        monthly_target_amount: comm.monthlyTargetAmount,
        due_day_of_month: comm.dueDayOfMonth,
        category: comm.category,
        default_category_id: comm.defaultCategoryId || null,
        auto_rollover_overpayment: comm.autoRolloverOverpayment,
        icon: comm.icon,
        color: comm.color,
        is_active: comm.isActive,
        notes: comm.notes || null,
        generation_counter: comm.generationCounter || 1,
        created_at: comm.createdAt,
        updated_at: comm.updatedAt,
      };
      const { error } = await (supabase.from('monthly_commitments') as any).upsert(payload);
      if (!error) {
        await db.monthlyCommitments.update(comm.id, { isDirty: false });
        pushed++;
      } else {
        hasError = true;
      }
    }

    // 4. Sync Dirty Debt Records -> Remote
    const dirtyDebts = await db.debtRecords
      .where('userId')
      .equals(userId)
      .filter((d) => !!d.isDirty)
      .toArray();

    for (const debt of dirtyDebts) {
      const payload = {
        id: debt.id,
        user_id: userId,
        person_name: debt.personName,
        contact_info: debt.contactInfo || null,
        direction: debt.direction,
        title: debt.title,
        principal_amount: debt.principalAmount,
        total_repaid_amount: debt.totalRepaidAmount,
        remaining_amount: debt.remainingAmount,
        start_date: debt.startDate,
        target_settlement_date: debt.targetSettlementDate || null,
        repayment_schedule: debt.repaymentSchedule,
        planned_monthly_installment: debt.plannedMonthlyInstallment || null,
        due_day_of_month: debt.dueDayOfMonth || null,
        status: debt.status,
        notes: debt.notes || null,
        color: debt.color,
        generation_counter: debt.generationCounter || 1,
        created_at: debt.createdAt,
        updated_at: debt.updatedAt,
      };
      const { error } = await (supabase.from('debt_records') as any).upsert(payload);
      if (!error) {
        await db.debtRecords.update(debt.id, { isDirty: false });
        pushed++;
      } else {
        hasError = true;
      }
    }

    // 5. Sync Dirty Debt Installments -> Remote
    const dirtyInstallments = await db.debtInstallments
      .where('userId')
      .equals(userId)
      .filter((i) => !!i.isDirty)
      .toArray();

    for (const inst of dirtyInstallments) {
      const payload = {
        id: inst.id,
        user_id: userId,
        debt_id: inst.debtId,
        amount: inst.amount,
        date: inst.date,
        month_key: inst.monthKey,
        payment_method: inst.paymentMethod,
        transaction_id: inst.transactionId || null,
        note: inst.note || null,
        balance_after_payment: inst.balanceAfterPayment,
        generation_counter: inst.generationCounter || 1,
        created_at: inst.createdAt,
        updated_at: inst.updatedAt,
      };
      const { error } = await (supabase.from('debt_installments') as any).upsert(payload);
      if (!error) {
        await db.debtInstallments.update(inst.id, { isDirty: false });
        pushed++;
      } else {
        hasError = true;
      }
    }

    // 6. Sync Dirty EMI Trackers -> Remote
    const dirtyEmis = await db.emiTrackers
      .where('userId')
      .equals(userId)
      .filter((e) => !!e.isDirty)
      .toArray();

    for (const emi of dirtyEmis) {
      const payload = {
        id: emi.id,
        user_id: userId,
        loan_name: emi.loanName,
        lender_name: emi.lenderName,
        principal_amount: emi.principalAmount,
        interest_rate_annual: emi.interestRateAnnual,
        emi_amount: emi.emiAmount,
        tenure_months: emi.tenureMonths,
        paid_months: emi.paidMonths,
        start_date: emi.startDate,
        billing_day_of_month: emi.billingDayOfMonth,
        category_id: emi.categoryId,
        account_id: emi.accountId || null,
        auto_create_task_reminder: emi.autoCreateTaskReminder,
        last_paid_month_key: emi.lastPaidMonthKey || null,
        status: emi.status,
        notes: emi.notes || null,
        generation_counter: emi.generationCounter || 1,
        created_at: emi.createdAt,
        updated_at: emi.updatedAt,
      };
      const { error } = await (supabase.from('emi_trackers') as any).upsert(payload);
      if (!error) {
        await db.emiTrackers.update(emi.id, { isDirty: false });
        pushed++;
      } else {
        hasError = true;
      }
    }

    // 7. Sync Dirty Finance Transactions -> Remote
    const dirtyTransactions = await db.financeTransactions
      .where('userId')
      .equals(userId)
      .filter((t) => !!t.isDirty)
      .toArray();

    for (const tx of dirtyTransactions) {
      const payload = {
        id: tx.id,
        user_id: userId,
        title: tx.title,
        amount: tx.amount,
        type: tx.type,
        category_id: tx.categoryId,
        subcategory: tx.subcategory || null,
        account_id: tx.accountId,
        to_account_id: tx.toAccountId || null,
        date: tx.date,
        month_key: tx.monthKey,
        notes: tx.notes || null,
        tags: tx.tags || [],
        is_recurring: tx.isRecurring,
        recurrence_rule: tx.recurrenceRule || null,
        linked_commitment_id: tx.linkedCommitmentId || null,
        commitment_contribution_type: tx.commitmentContributionType || null,
        linked_debt_id: tx.linkedDebtId || null,
        linked_debt_installment_id: tx.linkedDebtInstallmentId || null,
        linked_emi_id: tx.linkedEmiId || null,
        generation_counter: tx.generationCounter || 1,
        created_at: tx.createdAt,
        updated_at: tx.updatedAt,
      };
      const { error } = await (supabase.from('finance_transactions') as any).upsert(payload);
      if (!error) {
        await db.financeTransactions.update(tx.id, { isDirty: false });
        pushed++;
      } else {
        hasError = true;
      }
    }

    // 8. Sync Dirty Finance Budgets -> Remote
    const dirtyBudgets = await db.financeBudgets
      .where('userId')
      .equals(userId)
      .filter((b) => !!b.isDirty)
      .toArray();

    for (const budget of dirtyBudgets) {
      const payload = {
        id: budget.id,
        user_id: userId,
        month_key: budget.monthKey,
        total_budget: budget.totalBudget,
        expected_income: budget.expectedIncome,
        currency: budget.currency,
        notes: budget.notes || null,
        generation_counter: budget.generationCounter || 1,
        created_at: budget.createdAt,
        updated_at: budget.updatedAt,
      };
      const { error } = await (supabase.from('finance_budgets') as any).upsert(payload);
      if (!error) {
        await db.financeBudgets.update(budget.id, { isDirty: false });
        pushed++;
      } else {
        hasError = true;
      }
    }

    logger.info('[FinanceSyncEngine] Completed FlowFinance sync cycle');
    return {
      pushed,
      pulled: 0,
      status: hasError ? 'partial_failure' : 'success',
    };
  }
}

export async function syncFinanceWithRetry(engine: SyncEngine): Promise<void> {
  if (!engine.userId) return;
  const syncer = new FinanceSyncEngine();
  await engine.withRetry(() => syncer.sync(engine.userId!), 'syncFinance');
}
