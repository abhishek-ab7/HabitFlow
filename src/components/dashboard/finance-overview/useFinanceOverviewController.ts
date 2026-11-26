'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinancialObligationItem } from '@/lib/types';
import { useFeedback } from '@/hooks/use-feedback';

export function useFinanceOverviewController() {
  const router = useRouter();
  const feedback = useFeedback();

  const isLoading = useFinanceStore((s) => s.isLoading);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const emiTrackers = useFinanceStore((s) => s.emiTrackers);
  const sipPlans = useFinanceStore((s) => s.sipPlans);
  const recurringBills = useFinanceStore((s) => s.recurringBills);
  const commitments = useFinanceStore((s) => s.commitments);
  const creditCardStatements = useFinanceStore((s) => s.creditCardStatements);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const getNetWorthSummary = useFinanceStore((s) => s.getNetWorthSummary);
  const getUpcomingFinancialObligations = useFinanceStore((s) => s.getUpcomingFinancialObligations);
  const payRecurringBill = useFinanceStore((s) => s.payRecurringBill);
  const payMonthlyEmi = useFinanceStore((s) => s.payMonthlyEmi);
  const payMonthlySip = useFinanceStore((s) => s.payMonthlySip);
  const settleCommitmentBalance = useFinanceStore((s) => s.settleCommitmentBalance);
  const recordDebtInstallment = useFinanceStore((s) => s.recordDebtInstallment);

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [payingCardAccount, setPayingCardAccount] = useState<FinanceAccount | null>(null);
  const [payingCardAmount, setPayingCardAmount] = useState<number | undefined>(undefined);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length === 0) loadFinanceData(undefined, false);
  }, [categories.length, loadFinanceData]);

  const summary = getMonthlySummary();
  const netWorth = getNetWorthSummary();

  const due5d = useMemo(
    () => getUpcomingFinancialObligations(5),
    [getUpcomingFinancialObligations, transactions, emiTrackers, sipPlans, recurringBills, commitments, accounts, creditCardStatements, debtRecords]
  );
  const totalDue5d = useMemo(() => due5d.reduce((acc, item) => acc + item.amount, 0), [due5d]);

  const rawDue14d = useMemo(
    () => getUpcomingFinancialObligations(14),
    [getUpcomingFinancialObligations, transactions, emiTrackers, sipPlans, recurringBills, commitments, accounts, creditCardStatements, debtRecords]
  );
  const due5dIds = useMemo(() => new Set(due5d.map((i) => i.id)), [due5d]);
  const due14d = useMemo(() => rawDue14d.filter((item) => !due5dIds.has(item.id)), [rawDue14d, due5dIds]);
  const dueTotal14d = useMemo(() => due14d.reduce((acc, item) => acc + item.amount, 0), [due14d]);

  const topCategories = summary.categoryBreakdown.filter((c) => c.budgetLimit > 0 || c.spent > 0).slice(0, 4);

  const recentTxs = useMemo(
    () =>
      transactions
        .filter((t) => !t.deletedAt)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [transactions]
  );

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const payCreditCardObligation = (item: FinancialObligationItem) => {
    const card = accounts.find((a) => a.id === item.sourceId);
    if (!card) return void router.push('/finance?tab=accounts');
    setPayingCardAccount(card);
    setPayingCardAmount(item.amount);
  };

  const executeObligationPayment = async (item: FinancialObligationItem) => {
    const handlers: Record<string, () => Promise<void>> = {
      bill: async () => { if (await payRecurringBill(item.sourceId)) toast.success(`Marked ${item.title} paid`); },
      emi: async () => { if (await payMonthlyEmi(item.sourceId)) toast.success(`Logged EMI payment for ${item.title}`); },
      sip: async () => { if (await payMonthlySip(item.sourceId)) toast.success(`Logged SIP investment for ${item.title}`); },
      commitment: async () => { if (await settleCommitmentBalance(item.sourceId, undefined, selectedMonth)) toast.success(`Settled commitment: ${item.title}`); },
      credit_card: async () => payCreditCardObligation(item),
      debt: async () => {
        await recordDebtInstallment({ debtId: item.sourceId, amount: item.amount, paymentMethod: 'upi', note: 'Quick settlement from Cashflow Radar' });
        toast.success(`Logged ${formatINR(item.amount)} for ${item.title}`);
      },
    };
    const run = handlers[item.type] ?? (async () => router.push('/finance?tab=trackers'));
    await run();
  };

  const handleQuickPay = async (item: FinancialObligationItem) => {
    if (payingId) return;
    feedback.coin();
    setPayingId(item.id);
    try {
      await executeObligationPayment(item);
    } catch {
      toast.error(`Could not process payment for ${item.title}`);
    } finally {
      setPayingId(null);
    }
  };

  return {
    isLoading, categories, summary, netWorth,
    due5d, totalDue5d, due14d, dueTotal14d,
    topCategories, recentTxs, categoryMap,
    isQuickAddOpen, setIsQuickAddOpen,
    payingCardAccount, setPayingCardAccount,
    payingCardAmount, setPayingCardAmount,
    payingId, handleQuickPay,
  };
}
