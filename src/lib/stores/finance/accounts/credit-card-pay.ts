import { db } from '@/lib/db';
import { allocatePaymentToStatements, getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { FinanceTransaction } from '@/lib/types';
import { notifyFinanceSync, type FinanceStore } from '../helpers';

async function allocateAndPersistCardPayment(
  cardAccountId: string,
  payAmount: number,
  resolvedStatementId: string | null,
  now: string
): Promise<void> {
  const currentStatements = await db.creditCardStatements
    .where('accountId')
    .equals(cardAccountId)
    .filter((s) => !s.deletedAt)
    .toArray();
  if (currentStatements.length === 0) return;

  const { updatedStatements } = allocatePaymentToStatements(
    currentStatements,
    payAmount,
    resolvedStatementId
  );
  for (const updated of updatedStatements) {
    const isDirect =
      Boolean(resolvedStatementId) &&
      (updated.id === resolvedStatementId || updated.cycleKey === resolvedStatementId);
    await db.creditCardStatements.update(updated.id, {
      ...(isDirect ? { paidAmount: updated.paidAmount } : {}),
      remainingDue: updated.remainingDue,
      status: updated.status,
      paidAt: updated.paidAt,
      updatedAt: now,
      isDirty: true,
    });
  }
}

function resolveBillsCategoryId(state: FinanceStore): string {
  const match =
    state.categories.find((c) => c.slug === 'utilities-bills') || state.categories[0];
  return match?.id || 'default';
}

function buildCardPaymentTxInput(params: {
  cardName: string;
  payAmount: number;
  categoryId: string;
  fromAccountId: string;
  cardAccountId: string;
  txDate: string;
  note?: string;
  resolvedStatementId: string | null;
}) {
  return {
    title: `${params.cardName} Bill Payment`,
    amount: params.payAmount,
    type: 'transfer' as const,
    categoryId: params.categoryId,
    accountId: params.fromAccountId,
    toAccountId: params.cardAccountId,
    date: params.txDate,
    notes: params.note || `Payment toward ${params.cardName}`,
    tags: ['credit-card-payment'],
    statementCycleKey: null,
    paidStatementId: params.resolvedStatementId,
    isCreditCardPayment: true,
  };
}

function validateCardPaymentRequest(
  state: FinanceStore,
  cardAccountId: string,
  fromAccountId: string,
  amount: number
) {
  const card = state.accounts.find((a) => a.id === cardAccountId);
  const bank = state.accounts.find((a) => a.id === fromAccountId);
  if (!card || !bank) throw new Error('Card or Bank account not found');
  const payAmount = Math.max(0, Number(amount));
  if (payAmount <= 0) throw new Error('Payment amount must be greater than zero');
  return { cardName: card.name, payAmount };
}

export async function payCreditCardBillImpl(
  state: FinanceStore,
  params: {
    cardAccountId: string;
    fromAccountId: string;
    amount: number;
    date?: string;
    statementId?: string;
    note?: string;
  }
): Promise<FinanceTransaction> {
  const { cardAccountId, fromAccountId, amount, date, statementId, note } = params;
  const { cardName, payAmount } = validateCardPaymentRequest(
    state,
    cardAccountId,
    fromAccountId,
    amount
  );

  const txDate = date || getLocalIsoDate();
  const billedStmtId = state.getCreditCardSummary(cardAccountId, txDate)?.currentBilledStatement?.id;
  const resolvedStatementId = statementId || billedStmtId || null;

  const tx = await state.addTransaction(
    buildCardPaymentTxInput({
      cardName,
      payAmount,
      categoryId: resolveBillsCategoryId(state),
      fromAccountId,
      cardAccountId,
      txDate,
      note,
      resolvedStatementId,
    })
  );

  await allocateAndPersistCardPayment(
    cardAccountId,
    payAmount,
    resolvedStatementId,
    new Date().toISOString()
  );
  await state.syncCardStatements(cardAccountId);
  notifyFinanceSync();
  return tx;
}
