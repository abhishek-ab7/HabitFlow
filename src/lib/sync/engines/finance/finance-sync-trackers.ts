/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  type SyncStepResult,
  upsertWithColumnFallback,
  shouldApplyRemote,
} from './finance-sync-types';

export async function syncCommitments(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  let hasError = false;

  const dirtyCommitments = await db.monthlyCommitments
    .where('userId')
    .equals(userId)
    .filter((c) => c.isDirty !== false)
    .toArray();

  for (const comm of dirtyCommitments) {
    const payload = {
      id: comm.id,
      user_id: userId,
      title: comm.title,
      recipient_name: comm.recipientName,
      relationship: comm.relationship || 'Family',
      monthly_target_amount: Number(comm.monthlyTargetAmount || 0),
      due_day_of_month: Number(comm.dueDayOfMonth || 5),
      category: comm.category || 'family_support',
      default_category_id: comm.defaultCategoryId || null,
      auto_rollover_overpayment: !!comm.autoRolloverOverpayment,
      icon: comm.icon || 'HeartHandshake',
      color: comm.color || '#ec4899',
      is_active: comm.isActive && !comm.deletedAt,
      notes: comm.notes || null,
      deleted_at: comm.deletedAt || null,
      generation_counter: comm.generationCounter || 1,
      created_at: comm.createdAt || new Date().toISOString(),
      updated_at: comm.updatedAt || new Date().toISOString(),
    };
    const { error } = await upsertWithColumnFallback(supabase, 'monthly_commitments', payload);
    if (!error) {
      await db.monthlyCommitments.update(comm.id, { isDirty: false });
      pushed++;
    } else {
      logger.error('[FinanceSyncEngine] Commitment upsert failed:', error);
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
        if (shouldApplyRemote(local, r)) {
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

  return { pushed, pulled, hasError };
}

export async function syncDebts(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  let hasError = false;

  const dirtyDebts = await db.debtRecords
    .where('userId')
    .equals(userId)
    .filter((d) => d.isDirty !== false)
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
      bucket_type: debt.bucketType || 'long_term_loan',
      is_emi: !!debt.isEmi,
      emi_amount: debt.emiAmount ?? null,
      emi_due_day: debt.emiDueDay ?? null,
      total_installments: debt.totalInstallments ?? null,
      paid_installments: debt.paidInstallments ?? 0,
      notes: debt.notes || null,
      color: debt.color,
      deleted_at: debt.deletedAt || null,
      generation_counter: debt.generationCounter || 1,
      created_at: debt.createdAt,
      updated_at: debt.updatedAt,
    };
    const { error } = await upsertWithColumnFallback(supabase, 'debt_records', payload);
    if (!error) {
      await db.debtRecords.update(debt.id, { isDirty: false });
      pushed++;
    } else {
      logger.error('[FinanceSyncEngine] Debt upsert failed:', error);
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
        if (shouldApplyRemote(local, r)) {
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
            bucketType: (r.bucket_type as any) || 'long_term_loan',
            isEmi: r.is_emi ?? false,
            emiAmount: r.emi_amount ? Number(r.emi_amount) : undefined,
            emiDueDay: r.emi_due_day ? Number(r.emi_due_day) : undefined,
            totalInstallments: r.total_installments ? Number(r.total_installments) : undefined,
            paidInstallments: r.paid_installments ? Number(r.paid_installments) : 0,
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

  return { pushed, pulled, hasError };
}

export async function syncInstallments(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  let hasError = false;

  const dirtyInstallments = await db.debtInstallments
    .where('userId')
    .equals(userId)
    .filter((i) => i.isDirty !== false)
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
      deleted_at: inst.deletedAt || null,
      generation_counter: inst.generationCounter || 1,
      created_at: inst.createdAt,
      updated_at: inst.updatedAt,
    };
    const { error } = await upsertWithColumnFallback(supabase, 'debt_installments', payload);
    if (!error) {
      await db.debtInstallments.update(inst.id, { isDirty: false });
      pushed++;
    } else {
      logger.error('[FinanceSyncEngine] Installment upsert failed:', error);
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
        if (shouldApplyRemote(local, r)) {
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

  return { pushed, pulled, hasError };
}

export async function syncEmis(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  let hasError = false;

  const dirtyEmis = await db.emiTrackers
    .where('userId')
    .equals(userId)
    .filter((e) => e.isDirty !== false)
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
      category_id: emi.categoryId || null,
      account_id: emi.accountId || null,
      auto_create_task_reminder: emi.autoCreateTaskReminder,
      last_paid_month_key: emi.lastPaidMonthKey || null,
      status: emi.status,
      notes: emi.notes || null,
      deleted_at: emi.deletedAt || null,
      generation_counter: emi.generationCounter || 1,
      created_at: emi.createdAt,
      updated_at: emi.updatedAt,
    };
    const { error } = await upsertWithColumnFallback(supabase, 'emi_trackers', payload);
    if (!error) {
      await db.emiTrackers.update(emi.id, { isDirty: false });
      pushed++;
    } else {
      logger.error('[FinanceSyncEngine] EMI upsert failed:', error);
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
        if (shouldApplyRemote(local, r)) {
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

  return { pushed, pulled, hasError };
}

export async function syncSips(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  const hasError = false;

  try {
    if (db.financeSipPlans) {
      const dirtySips = await db.financeSipPlans
        .where('userId')
        .equals(userId)
        .filter((s) => s.isDirty !== false)
        .toArray();
      for (const sip of dirtySips) {
        const { error } = await upsertWithColumnFallback(supabase, 'finance_sip_plans', {
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
          deleted_at: sip.deletedAt || null,
          generation_counter: sip.generationCounter || 1,
          created_at: sip.createdAt,
          updated_at: sip.updatedAt,
        });
        if (!error) {
          await db.financeSipPlans.update(sip.id, { isDirty: false });
          pushed++;
        } else {
          logger.error('[FinanceSyncEngine] SIP plan upsert failed:', error);
        }
      }

      const { data: remoteSips, error: pullSipErr } = await (supabase
        .from('finance_sip_plans') as any)
        .select('*')
        .eq('user_id', userId);
      if (!pullSipErr && Array.isArray(remoteSips)) {
        for (const r of remoteSips) {
          const local = await db.financeSipPlans.get(r.id);
          if (shouldApplyRemote(local, r)) {
            await db.financeSipPlans.put({
              id: r.id,
              userId: r.user_id,
              name: r.name,
              platform: r.platform || undefined,
              assetClass: r.asset_class || 'equity_mf',
              monthlyAmount: Number(r.monthly_amount || 0),
              sipDayOfMonth: Number(r.sip_day_of_month || 5),
              startDate: r.start_date,
              totalInvested: Number(r.total_invested || 0),
              currentValue: Number(r.current_value || 0),
              expectedReturnAnnual: r.expected_return_annual ? Number(r.expected_return_annual) : undefined,
              accountId: r.account_id || undefined,
              categoryId: r.category_id || undefined,
              lastInvestedMonthKey: r.last_invested_month_key || undefined,
              isActive: !!r.is_active,
              color: r.color || '#10b981',
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
    }
  } catch {
    // Non-fatal
  }

  return { pushed, pulled, hasError };
}

export async function syncRecurringBills(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  const hasError = false;

  try {
    if (db.financeRecurringBills) {
      const dirtyBills = await db.financeRecurringBills
        .where('userId')
        .equals(userId)
        .filter((b) => b.isDirty !== false)
        .toArray();
      for (const bill of dirtyBills) {
        const { error } = await upsertWithColumnFallback(supabase, 'finance_recurring_bills', {
          id: bill.id,
          user_id: userId,
          name: bill.name,
          amount: bill.amount,
          previous_amount: bill.previousAmount || null,
          cadence: bill.cadence,
          due_day_of_month: bill.dueDayOfMonth,
          category_id: bill.categoryId,
          account_id: bill.accountId || null,
          auto_log: bill.autoLog,
          last_paid_month_key: bill.lastPaidMonthKey || null,
          is_active: bill.isActive && !bill.deletedAt,
          color: bill.color,
          icon: bill.icon,
          deleted_at: bill.deletedAt || null,
          generation_counter: bill.generationCounter || 1,
          created_at: bill.createdAt,
          updated_at: bill.updatedAt,
        });
        if (!error) {
          await db.financeRecurringBills.update(bill.id, { isDirty: false });
          pushed++;
        }
      }
      const { data: remoteBills } = await (supabase.from('finance_recurring_bills') as any)
        .select('*')
        .eq('user_id', userId);
      if (Array.isArray(remoteBills)) {
        for (const r of remoteBills) {
          const local = await db.financeRecurringBills.get(r.id);
          if (shouldApplyRemote(local, r)) {
            await db.financeRecurringBills.put({
              id: r.id,
              userId: r.user_id,
              name: r.name,
              amount: Number(r.amount || 0),
              previousAmount: r.previous_amount ? Number(r.previous_amount) : undefined,
              cadence: r.cadence || 'monthly',
              dueDayOfMonth: Number(r.due_day_of_month || 5),
              categoryId: r.category_id,
              accountId: r.account_id || undefined,
              autoLog: !!r.auto_log,
              lastPaidMonthKey: r.last_paid_month_key || undefined,
              isActive: !!r.is_active,
              color: r.color || '#6366f1',
              icon: r.icon || 'Calendar',
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
    }
  } catch {
    // Non-fatal
  }

  return { pushed, pulled, hasError };
}
