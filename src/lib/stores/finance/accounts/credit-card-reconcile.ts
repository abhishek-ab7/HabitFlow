import { db } from '@/lib/db';
import {
  getCycleWindowForMonth,
  resolveCardBillingConfig,
  resolveTransactionCycle,
  roundCurrency,
} from '@/lib/finance/credit-card-cycles';
import type { CreditCardStatement, FinanceAccount, FinanceTransaction } from '@/lib/types';
import { notifyFinanceSync, type FinanceStore } from '../helpers';

function calculateCycleAmount(card: FinanceAccount, txs: FinanceTransaction[], cycleKey: string) {
  const { billingDay, dueDay } = resolveCardBillingConfig(card);
  let calculatedAmount = 0;
  for (const tx of txs) {
    const isCardSpend =
      tx.accountId === card.id && !tx.deletedAt && !tx.isCreditCardPayment && tx.type !== 'transfer';
    if (!isCardSpend) continue;
    if (resolveTransactionCycle(tx.date, billingDay, dueDay, tx.statementCycleKey) !== cycleKey) {
      continue;
    }
    const delta = tx.type === 'income' ? -tx.amount : tx.amount;
    calculatedAmount = roundCurrency(calculatedAmount + delta);
  }
  return calculatedAmount;
}

function buildUpdatedStatement(params: {
  existing: CreditCardStatement;
  calculatedAmount: number;
  manualAdjustment: number;
  note?: string;
  now: string;
}): CreditCardStatement {
  const { existing, calculatedAmount, manualAdjustment, note, now } = params;
  const totalDue = roundCurrency(
    Math.max(0, calculatedAmount + manualAdjustment + (existing.carriedForwardAmount || 0))
  );
  const remainingDue = roundCurrency(Math.max(0, totalDue - existing.paidAmount));
  const status =
    remainingDue === 0 && totalDue > 0 ? 'paid' : existing.paidAmount > 0 ? 'partial' : 'billed';

  return {
    ...existing,
    calculatedAmount,
    manualAdjustment,
    totalDue,
    remainingDue,
    status,
    notes: note || existing.notes,
    updatedAt: now,
    isDirty: true,
  };
}

export async function reconcileCreditCardStatementImpl(
  state: FinanceStore,
  params: {
    cardAccountId: string;
    cycleKey: string;
    actualStatementAmount: number;
    note?: string;
  }
): Promise<CreditCardStatement> {
  const { cardAccountId, cycleKey, actualStatementAmount, note } = params;
  const card = state.accounts.find((a) => a.id === cardAccountId);
  if (!card) throw new Error('Card account not found');

  const now = new Date().toISOString();
  const { billingDay, dueDay, gracePeriodDays } = resolveCardBillingConfig(card);
  const [cYear, cMonth] = cycleKey.split('-').map(Number);
  const window = getCycleWindowForMonth(billingDay, dueDay, cYear, cMonth - 1, gracePeriodDays);
  const calculatedAmount = calculateCycleAmount(card, state.transactions, cycleKey);
  const actual = roundCurrency(Math.max(0, Number(actualStatementAmount)));
  const manualAdjustment = roundCurrency(actual - calculatedAmount);

  const existing = await db.creditCardStatements
    .where('accountId')
    .equals(cardAccountId)
    .filter((s) => s.cycleKey === cycleKey && !s.deletedAt)
    .first();

  const statement: CreditCardStatement = existing
    ? buildUpdatedStatement({ existing, calculatedAmount, manualAdjustment, note, now })
    : {
        id: `${cardAccountId}_${cycleKey}`,
        userId: card.userId,
        accountId: cardAccountId,
        cycleKey,
        periodStart: window.periodStart,
        periodEnd: window.periodEnd,
        dueDate: window.dueDate,
        calculatedAmount,
        manualAdjustment,
        totalDue: actual,
        carriedForwardAmount: 0,
        paidAmount: 0,
        remainingDue: actual,
        status: 'billed',
        notes: note,
        isDirty: true,
        createdAt: now,
        updatedAt: now,
      };

  await db.creditCardStatements.put(statement);
  await state.loadFinanceData(card.userId);
  notifyFinanceSync();
  return statement;
}
