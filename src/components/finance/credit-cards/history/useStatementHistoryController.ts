'use client';

import { useEffect, useState } from 'react';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { FinanceAccount } from '@/lib/types';
import {
  filterCycleTransactions,
  mergeStatementsWithLive,
  normalizeInitialTab,
  type InternalHistoryTab,
  type StatementHistoryTab,
} from '@/lib/finance/statement-cycle-helpers';
import { toast } from 'sonner';

export function useStatementHistoryData(card: FinanceAccount) {
  const getCreditCardSummary = useFinanceStore((s) => s.getCreditCardSummary);
  const statements = useFinanceStore((s) => s.creditCardStatements);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const moveTransactionToCycle = useFinanceStore((s) => s.moveTransactionToCycle);

  const summary = getCreditCardSummary(card.id);
  const billingDay = card.billingDay ?? card.statementDay ?? 1;
  const dueDay = card.dueDay ?? 20;
  const cardStatements = mergeStatementsWithLive(statements, card.id, summary);

  const cardTxs = transactions
    .filter((t) => t.accountId === card.id && !t.deletedAt && !t.isCreditCardPayment && t.type !== 'transfer')
    .sort((a, b) => b.date.localeCompare(a.date));

  const currentBilledCycleKey = summary?.billedStatement?.cycleKey;
  const unbilledCycleKey = summary?.unbilledCycle.cycleKey || '';

  return {
    summary,
    billingDay,
    dueDay,
    cardStatements,
    billedTxs: filterCycleTransactions(cardTxs, currentBilledCycleKey, billingDay, dueDay),
    unbilledTxs: filterCycleTransactions(cardTxs, unbilledCycleKey, billingDay, dueDay),
    currentBilledCycleKey,
    unbilledCycleKey,
    categoryNameById: new Map(categories.map((c) => [c.id, c.name])),
    moveTransactionToCycle,
  };
}

export function useStatementHistoryController(params: {
  open: boolean;
  card: FinanceAccount;
  initialTab?: StatementHistoryTab;
}) {
  const { open, card, initialTab = 'current' } = params;
  const [activeTab, setActiveTab] = useState<InternalHistoryTab>(() => normalizeInitialTab(initialTab));
  const [isMoving, setIsMoving] = useState<string | null>(null);
  const data = useStatementHistoryData(card);

  useEffect(() => {
    if (open) setActiveTab(normalizeInitialTab(initialTab));
  }, [open, initialTab]);

  const handleShiftCycle = async (txId: string, targetCycleKey: string) => {
    setIsMoving(txId);
    try {
      await data.moveTransactionToCycle(txId, targetCycleKey);
      toast.success(`Transaction moved to cycle ${targetCycleKey}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to move transaction to cycle');
    } finally {
      setIsMoving(null);
    }
  };

  return {
    activeTab,
    setActiveTab,
    isMoving,
    data,
    handleShiftCycle,
  };
}
