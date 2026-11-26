import { db } from '@/lib/db';
import { computeCreditCardSummary, getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { CreditCardStatement, FinanceAccount, FinanceTransaction } from '@/lib/types';
import type { FinanceStore } from '../helpers';
export { reconcileCreditCardStatementImpl } from './credit-card-reconcile';
export { getCreditCardSummaryImpl } from './credit-card-summary';
export { payCreditCardBillImpl } from './credit-card-pay';

async function upsertBilledStatement(
  card: FinanceAccount,
  stmt: CreditCardStatement,
  transactions: FinanceTransaction[],
  now: string
): Promise<void> {
  const existing = await db.creditCardStatements.get(stmt.id);
  if (existing) {
    await db.creditCardStatements.update(stmt.id, {
      calculatedAmount: stmt.calculatedAmount,
      totalDue: stmt.totalDue,
      remainingDue: stmt.remainingDue,
      status: stmt.status,
      dueDate: stmt.dueDate,
      updatedAt: now,
      isDirty: true,
    });
    return;
  }

  const hasLinkedPayment = transactions.some(
    (t) =>
      !t.deletedAt &&
      t.paidStatementId &&
      (t.paidStatementId === stmt.id || t.paidStatementId === stmt.cycleKey)
  );
  await db.creditCardStatements.put({
    ...stmt,
    paidAmount: hasLinkedPayment ? stmt.paidAmount : 0,
    userId: card.userId,
    isDirty: true,
    createdAt: now,
    updatedAt: now,
  });
}

function selectTargetCards(accounts: FinanceAccount[], accountId?: string): FinanceAccount[] {
  return accounts.filter((a) =>
    accountId
      ? a.id === accountId && a.type === 'credit_card'
      : a.type === 'credit_card' && !a.archived && !a.deletedAt
  );
}

export async function syncCardStatementsImpl(
  state: FinanceStore,
  setStatements: (stmts: CreditCardStatement[]) => void,
  accountId?: string
): Promise<void> {
  const cards = selectTargetCards(state.accounts, accountId);
  if (cards.length === 0) return;

  const now = new Date().toISOString();
  const todayIso = getLocalIsoDate();

  for (const card of cards) {
    const summary = computeCreditCardSummary({
      account: card,
      transactions: state.transactions,
      persistedStatements: state.creditCardStatements,
      referenceDate: todayIso,
    });
    if (summary.currentBilledStatement) {
      await upsertBilledStatement(card, summary.currentBilledStatement, state.transactions, now);
    }
  }

  const userId = cards[0]?.userId;
  if (!userId) return;
  const updatedStmts = await db.creditCardStatements
    .where('userId')
    .equals(userId)
    .filter((s) => !s.deletedAt)
    .toArray();
  setStatements(updatedStmts);
}
