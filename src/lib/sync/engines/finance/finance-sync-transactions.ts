/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import {
  type SyncStepResult,
  missingRemoteFinanceTables,
  isMissingRelationError,
  upsertWithColumnFallback,
  shouldApplyRemote,
} from './finance-sync-types';

export async function syncTransactions(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  let hasError = false;

  const dirtyTransactions = await db.financeTransactions
    .where('userId')
    .equals(userId)
    .filter((t) => t.isDirty !== false)
    .toArray();

  for (const tx of dirtyTransactions) {
    if (tx.deletedAt) {
      const { error } = await (supabase.from('finance_transactions') as any)
        .delete()
        .eq('id', tx.id)
        .eq('user_id', userId);
      if (!error) {
        await db.financeTransactions.delete(tx.id);
        pushed++;
      } else {
        logger.error('[FinanceSyncEngine] Transaction remote delete failed:', error);
        hasError = true;
      }
      continue;
    }

    const localToday = getLocalIsoDate();
    const safeMonthKey = tx.monthKey || (tx.date ? tx.date.slice(0, 7) : localToday.slice(0, 7));
    const safeDate = tx.date || localToday;
    const payload = {
      id: tx.id,
      user_id: userId,
      title: tx.title || 'Untitled Transaction',
      merchant_name: tx.merchantName || null,
      raw_merchant: tx.rawMerchant || null,
      amount: Number(tx.amount || 0),
      type: tx.type || 'expense',
      category_id: tx.categoryId,
      subcategory: tx.subcategory || null,
      account_id: tx.accountId,
      to_account_id: tx.toAccountId || null,
      date: safeDate,
      month_key: safeMonthKey,
      notes: tx.notes || null,
      tags: Array.isArray(tx.tags) ? tx.tags : [],
      is_recurring: !!tx.isRecurring,
      recurrence_rule: tx.recurrenceRule || null,
      needs_review: !!tx.needsReview,
      split_group_id: tx.splitGroupId || null,
      linked_commitment_id: tx.linkedCommitmentId || null,
      commitment_contribution_type: tx.linkedCommitmentId ? (tx.commitmentContributionType || 'offset_expense') : null,
      linked_debt_id: tx.linkedDebtId || null,
      linked_debt_installment_id: tx.linkedDebtInstallmentId || null,
      linked_emi_id: tx.linkedEmiId || null,
      linked_sip_id: tx.linkedSipId || null,
      statement_cycle_key: tx.statementCycleKey ?? null,
      paid_statement_id: tx.paidStatementId ?? null,
      is_credit_card_payment: !!tx.isCreditCardPayment,
      deleted_at: tx.deletedAt || null,
      generation_counter: tx.generationCounter || 1,
      created_at: tx.createdAt || new Date().toISOString(),
      updated_at: tx.updatedAt || new Date().toISOString(),
    };
    let { error } = await upsertWithColumnFallback(supabase, 'finance_transactions', payload);
    if (error && (error as any).code === '23503') {
      logger.warn('[FinanceSyncEngine] Foreign key 23503 violation on transaction upsert, retrying with unlinked references:', error);
      const unlinkedPayload = {
        ...payload,
        linked_commitment_id: null,
        commitment_contribution_type: null,
        linked_debt_id: null,
        linked_debt_installment_id: null,
        linked_emi_id: null,
        linked_sip_id: null,
        paid_statement_id: null,
      };
      const retryResult = await upsertWithColumnFallback(supabase, 'finance_transactions', unlinkedPayload);
      error = retryResult.error;
    }
    if (!error) {
      await db.financeTransactions.update(tx.id, { isDirty: false });
      pushed++;
    } else {
      logger.error('[FinanceSyncEngine] Transaction upsert failed:', error);
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
        if (shouldApplyRemote(local, r)) {
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
            statementCycleKey: r.statement_cycle_key ?? local?.statementCycleKey ?? null,
            paidStatementId: r.paid_statement_id ?? local?.paidStatementId ?? null,
            isCreditCardPayment: r.is_credit_card_payment ?? local?.isCreditCardPayment ?? false,
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

export async function syncCategorizationRules(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  const hasError = false;

  try {
    if (db.financeCategorizationRules) {
      const dirtyRules = await db.financeCategorizationRules
        .where('userId')
        .equals(userId)
        .filter((r) => r.isDirty !== false)
        .toArray();
      for (const rule of dirtyRules) {
        const { error } = await upsertWithColumnFallback(supabase, 'finance_categorization_rules', {
          id: rule.id,
          user_id: userId,
          match_pattern: rule.matchPattern,
          clean_merchant_name: rule.cleanMerchantName,
          category_id: rule.categoryId,
          subcategory: rule.subcategory || null,
          default_tags: rule.defaultTags || [],
          is_active: rule.isActive && !rule.deletedAt,
          deleted_at: rule.deletedAt || null,
          generation_counter: rule.generationCounter || 1,
          created_at: rule.createdAt,
          updated_at: rule.updatedAt,
        });
        if (!error) {
          await db.financeCategorizationRules.update(rule.id, { isDirty: false });
          pushed++;
        }
      }
      const { data: remoteRules } = await (supabase.from('finance_categorization_rules') as any)
        .select('*')
        .eq('user_id', userId);
      if (Array.isArray(remoteRules)) {
        for (const r of remoteRules) {
          const local = await db.financeCategorizationRules.get(r.id);
          if (shouldApplyRemote(local, r)) {
            await db.financeCategorizationRules.put({
              id: r.id,
              userId: r.user_id,
              matchPattern: r.match_pattern,
              cleanMerchantName: r.clean_merchant_name,
              categoryId: r.category_id,
              subcategory: r.subcategory || undefined,
              defaultTags: r.default_tags || [],
              isActive: !!r.is_active,
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

export async function syncNetWorthSnapshots(supabase: any, userId: string): Promise<SyncStepResult> {
  let pushed = 0;
  let pulled = 0;
  const hasError = false;

  try {
    if (db.financeNetWorthSnapshots && !missingRemoteFinanceTables.has('finance_net_worth_snapshots')) {
      const dirtySnapshots = await db.financeNetWorthSnapshots
        .where('userId')
        .equals(userId)
        .filter((s) => s.isDirty !== false)
        .toArray();
      for (const snap of dirtySnapshots) {
        if (missingRemoteFinanceTables.has('finance_net_worth_snapshots')) break;
        const { error } = await upsertWithColumnFallback(
          supabase,
          'finance_net_worth_snapshots',
          {
            id: snap.id,
            user_id: userId,
            month_key: snap.monthKey,
            snapshot_date: snap.snapshotDate,
            liquid_assets: Number(snap.liquidAssets || 0),
            investment_assets: Number(snap.investmentAssets || 0),
            friend_receivables: Number(snap.friendReceivables || 0),
            total_assets: Number(snap.totalAssets || 0),
            credit_card_liabilities: Number(snap.creditCardLiabilities || 0),
            emi_remaining_principal: Number(snap.emiRemainingPrincipal || 0),
            friend_payables: Number(snap.friendPayables || 0),
            total_liabilities: Number(snap.totalLiabilities || 0),
            net_worth: Number(snap.netWorth || 0),
            deleted_at: snap.deletedAt || null,
            generation_counter: snap.generationCounter || 1,
            created_at: snap.createdAt,
            updated_at: snap.updatedAt,
          },
          { onConflict: 'user_id,month_key' }
        );
        if (error) {
          if (isMissingRelationError(error)) {
            missingRemoteFinanceTables.add('finance_net_worth_snapshots');
            logger.info('[FinanceSyncEngine] Skipping unmigrated table finance_net_worth_snapshots for this session.');
            break;
          }
        } else {
          await db.financeNetWorthSnapshots.update(snap.id, { isDirty: false });
          pushed++;
        }
      }
      if (!missingRemoteFinanceTables.has('finance_net_worth_snapshots')) {
        const { data: remoteSnaps, error: pullSnapError } = await (supabase.from('finance_net_worth_snapshots') as any)
          .select('*')
          .eq('user_id', userId);
        if (pullSnapError && isMissingRelationError(pullSnapError)) {
          missingRemoteFinanceTables.add('finance_net_worth_snapshots');
        } else if (Array.isArray(remoteSnaps)) {
          for (const r of remoteSnaps) {
            const local = await db.financeNetWorthSnapshots.get(r.id);
            if (shouldApplyRemote(local, r)) {
              await db.financeNetWorthSnapshots.put({
                id: r.id,
                userId: r.user_id,
                monthKey: r.month_key,
                snapshotDate: r.snapshot_date,
                liquidAssets: Number(r.liquid_assets || 0),
                investmentAssets: Number(r.investment_assets || 0),
                friendReceivables: Number(r.friend_receivables || 0),
                totalAssets: Number(r.total_assets || 0),
                creditCardLiabilities: Number(r.credit_card_liabilities || 0),
                emiRemainingPrincipal: Number(r.emi_remaining_principal || 0),
                friendPayables: Number(r.friend_payables || 0),
                totalLiabilities: Number(r.total_liabilities || 0),
                netWorth: Number(r.net_worth || 0),
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
    }
  } catch {
    // Non-fatal
  }

  return { pushed, pulled, hasError };
}
