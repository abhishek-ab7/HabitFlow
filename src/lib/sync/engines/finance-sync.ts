/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { ISynchronizer } from '../types';
import type { SyncEngine } from '../sync-engine';

/**
 * FinanceSyncEngine synchronizes FlowFinance V2 tables between Dexie (local IndexedDB)
 * and Supabase PostgreSQL with two-way push + pull, generationCounter conflict resolution,
 * and soft-delete tombstones (deletedAt).
 */
export class FinanceSyncEngine implements ISynchronizer {
  readonly domainName = 'Finance';

  private shouldApplyRemote(local: any | undefined, remote: any): boolean {
    if (!local) return true;
    const remoteGen = Number(remote.generation_counter || 0);
    const localGen = Number(local.generationCounter || 0);
    if (remoteGen > localGen) return true;
    if (remoteGen === localGen && remote.updated_at && local.updatedAt) {
      return new Date(remote.updated_at).getTime() > new Date(local.updatedAt).getTime();
    }
    return false;
  }

  async sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' | 'partial_failure' }> {
    const supabase = getSupabaseClient();
    let pushed = 0;
    let pulled = 0;
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
        is_archived: cat.archived || !!cat.deletedAt,
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

    // Pull Remote Categories -> Local
    try {
      const { data: remoteCats, error: pullCatErr } = await (supabase
        .from('finance_categories') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullCatErr && Array.isArray(remoteCats)) {
        for (const r of remoteCats) {
          const local = await db.financeCategories.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
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
        is_archived: acc.archived || !!acc.deletedAt,
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

    // Pull Remote Accounts -> Local
    try {
      const { data: remoteAccs, error: pullAccErr } = await (supabase
        .from('finance_accounts') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullAccErr && Array.isArray(remoteAccs)) {
        for (const r of remoteAccs) {
          const local = await db.financeAccounts.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.financeAccounts.put({
              id: r.id,
              userId: r.user_id,
              name: r.name,
              type: r.type,
              balance: Number(r.balance || 0),
              creditLimit: r.credit_limit ?? local?.creditLimit,
              statementDay: r.statement_day ?? local?.statementDay,
              dueDay: r.due_day ?? local?.dueDay,
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
        is_active: comm.isActive && !comm.deletedAt,
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

    // Pull Remote Monthly Commitments -> Local
    try {
      const { data: remoteComms, error: pullCommErr } = await (supabase
        .from('monthly_commitments') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullCommErr && Array.isArray(remoteComms)) {
        for (const r of remoteComms) {
          const local = await db.monthlyCommitments.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.monthlyCommitments.put({
              id: r.id,
              userId: r.user_id,
              title: r.title,
              recipientName: r.recipient_name,
              relationship: r.relationship || 'Family',
              monthlyTargetAmount: Number(r.monthly_target_amount || 0),
              dueDayOfMonth: Number(r.due_day_of_month || 5),
              category: r.category || 'family_support',
              defaultCategoryId: r.default_category_id || undefined,
              autoRolloverOverpayment: !!r.auto_rollover_overpayment,
              icon: r.icon || 'HeartHandshake',
              color: r.color || '#ec4899',
              isActive: !!r.is_active,
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
        status: debt.deletedAt ? 'archived' : debt.status,
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

    // Pull Remote Debt Records -> Local
    try {
      const { data: remoteDebts, error: pullDebtErr } = await (supabase
        .from('debt_records') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullDebtErr && Array.isArray(remoteDebts)) {
        for (const r of remoteDebts) {
          const local = await db.debtRecords.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.debtRecords.put({
              id: r.id,
              userId: r.user_id,
              personName: r.person_name,
              contactInfo: r.contact_info || undefined,
              direction: r.direction,
              title: r.title,
              principalAmount: Number(r.principal_amount || 0),
              totalRepaidAmount: Number(r.total_repaid_amount || 0),
              remainingAmount: Number(r.remaining_amount || 0),
              startDate: r.start_date,
              targetSettlementDate: r.target_settlement_date || undefined,
              repaymentSchedule: r.repayment_schedule || 'flexible',
              plannedMonthlyInstallment: r.planned_monthly_installment
                ? Number(r.planned_monthly_installment)
                : undefined,
              dueDayOfMonth: r.due_day_of_month ? Number(r.due_day_of_month) : undefined,
              status: r.status || 'active',
              notes: r.notes || undefined,
              color: r.color || '#3b82f6',
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

    // Pull Remote Debt Installments -> Local
    try {
      const { data: remoteInsts, error: pullInstErr } = await (supabase
        .from('debt_installments') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullInstErr && Array.isArray(remoteInsts)) {
        for (const r of remoteInsts) {
          const local = await db.debtInstallments.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.debtInstallments.put({
              id: r.id,
              userId: r.user_id,
              debtId: r.debt_id,
              amount: Number(r.amount || 0),
              date: r.date,
              monthKey: r.month_key,
              paymentMethod: r.payment_method || 'upi',
              transactionId: r.transaction_id || null,
              note: r.note || undefined,
              balanceAfterPayment: Number(r.balance_after_payment || 0),
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

    // Pull Remote EMI Trackers -> Local
    try {
      const { data: remoteEmis, error: pullEmiErr } = await (supabase
        .from('emi_trackers') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullEmiErr && Array.isArray(remoteEmis)) {
        for (const r of remoteEmis) {
          const local = await db.emiTrackers.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.emiTrackers.put({
              id: r.id,
              userId: r.user_id,
              loanName: r.loan_name,
              lenderName: r.lender_name,
              principalAmount: Number(r.principal_amount || 0),
              interestRateAnnual: Number(r.interest_rate_annual || 0),
              emiAmount: Number(r.emi_amount || 0),
              tenureMonths: Number(r.tenure_months || 1),
              paidMonths: Number(r.paid_months || 0),
              startDate: r.start_date,
              billingDayOfMonth: Number(r.billing_day_of_month || 5),
              categoryId: r.category_id,
              accountId: r.account_id || undefined,
              autoCreateTaskReminder: !!r.auto_create_task_reminder,
              lastPaidMonthKey: r.last_paid_month_key || undefined,
              status: r.status || 'active',
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

    // Pull Remote Finance Transactions -> Local
    try {
      const { data: remoteTxs, error: pullTxErr } = await (supabase
        .from('finance_transactions') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullTxErr && Array.isArray(remoteTxs)) {
        for (const r of remoteTxs) {
          const local = await db.financeTransactions.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.financeTransactions.put({
              id: r.id,
              userId: r.user_id,
              title: r.title,
              merchantName: r.merchant_name ?? local?.merchantName,
              rawMerchant: r.raw_merchant ?? local?.rawMerchant,
              amount: Number(r.amount || 0),
              type: r.type || 'expense',
              categoryId: r.category_id,
              subcategory: r.subcategory || undefined,
              accountId: r.account_id,
              toAccountId: r.to_account_id || undefined,
              date: r.date,
              monthKey: r.month_key || (r.date ? r.date.slice(0, 7) : ''),
              notes: r.notes || undefined,
              tags: Array.isArray(r.tags) ? r.tags : [],
              isRecurring: !!r.is_recurring,
              recurrenceRule: r.recurrence_rule || undefined,
              needsReview: r.needs_review ?? local?.needsReview ?? false,
              splitGroupId: r.split_group_id ?? local?.splitGroupId ?? null,
              linkedCommitmentId: r.linked_commitment_id || null,
              commitmentContributionType: r.commitment_contribution_type || null,
              linkedDebtId: r.linked_debt_id || null,
              linkedDebtInstallmentId: r.linked_debt_installment_id || null,
              linkedEmiId: r.linked_emi_id || null,
              linkedSipId: r.linked_sip_id ?? local?.linkedSipId ?? null,
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

    // Pull Remote Finance Budgets -> Local
    try {
      const { data: remoteBudgets, error: pullBudgetErr } = await (supabase
        .from('finance_budgets') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullBudgetErr && Array.isArray(remoteBudgets)) {
        for (const r of remoteBudgets) {
          const local = await db.financeBudgets.get(r.id);
          if (this.shouldApplyRemote(local, r)) {
            await db.financeBudgets.put({
              id: r.id,
              userId: r.user_id,
              monthKey: r.month_key,
              totalBudget: Number(r.total_budget || 0),
              expectedIncome: Number(r.expected_income || 0),
              plannedSipAmount: r.planned_sip_amount ?? local?.plannedSipAmount,
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

    // 9. Optional Sync for V2 SIP Plans, Categorization Rules & Recurring Bills (gracefully skipped if remote table doesn't exist yet)
    try {
      if (db.financeSipPlans) {
        const dirtySips = await db.financeSipPlans
          .where('userId')
          .equals(userId)
          .filter((s) => !!s.isDirty)
          .toArray();
        for (const sip of dirtySips) {
          const { error } = await (supabase.from('finance_sip_plans') as any).upsert({
            id: sip.id,
            user_id: userId,
            name: sip.name,
            platform: sip.platform || null,
            asset_class: sip.assetClass,
            monthly_amount: sip.monthlyAmount,
            sip_day_of_month: sip.sipDayOfMonth,
            start_date: sip.startDate,
            total_invested: sip.totalInvested,
            current_value: sip.currentValue,
            expected_return_annual: sip.expectedReturnAnnual || null,
            account_id: sip.accountId || null,
            category_id: sip.categoryId || null,
            last_invested_month_key: sip.lastInvestedMonthKey || null,
            is_active: sip.isActive && !sip.deletedAt,
            color: sip.color,
            notes: sip.notes || null,
            generation_counter: sip.generationCounter || 1,
            created_at: sip.createdAt,
            updated_at: sip.updatedAt,
          });
          if (!error) {
            await db.financeSipPlans.update(sip.id, { isDirty: false });
            pushed++;
          }
        }
      }
    } catch {
      // Non-fatal
    }

    logger.info('[FinanceSyncEngine] Completed FlowFinance V2 two-way sync cycle');
    return {
      pushed,
      pulled,
      status: hasError ? 'partial_failure' : 'success',
    };
  }
}

export async function syncFinanceWithRetry(engine: SyncEngine): Promise<void> {
  if (!engine.userId) return;
  const syncer = new FinanceSyncEngine();
  await engine.withRetry(() => syncer.sync(engine.userId!), 'syncFinance');
}

