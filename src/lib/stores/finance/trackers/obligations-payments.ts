import { db } from '@/lib/db';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { EmiTracker, FinanceTransaction } from '@/lib/types';
import { formatINR, notifyFinanceSync, type FinanceStore } from '../helpers';
import { emitFinanceEventNonBlocking, resolveAccountAndCategory } from './obligations-helpers';

export async function settleCommitmentBalanceImpl(
  state: FinanceStore,
  commitmentId: string,
  accountId?: string,
  monthKey?: string
): Promise<FinanceTransaction | null> {
  const targetMonth = monthKey || state.selectedMonth;
  const ledger = state.getCommitmentLedger(commitmentId, targetMonth);
  if (!ledger || ledger.remainingBalance <= 0) return null;

  const { account, category } = resolveAccountAndCategory({
    state,
    preferredAccountId: accountId,
    preferredCategoryId: ledger.commitment.defaultCategoryId,
    fallbackSlug: 'family-commitments',
  });
  if (!account || !category) return null;

  const todayStr = getLocalIsoDate();
  const txDate = todayStr.startsWith(targetMonth) ? todayStr : `${targetMonth}-28`;
  const tx = await state.addTransaction({
    title: `Final Balance Transfer to ${ledger.commitment.recipientName} (${targetMonth})`,
    amount: ledger.remainingBalance,
    type: 'expense',
    categoryId: category.id,
    subcategory: 'Parental Allowance',
    accountId: account.id,
    date: txDate,
    notes: `Settled remaining balance of ${formatINR(ledger.remainingBalance)} after ${formatINR(
      ledger.offsetExpensesAmount
    )} in offset purchases/bills`,
    tags: ['commitment-settlement', ledger.commitment.recipientName.toLowerCase()],
    linkedCommitmentId: commitmentId,
    commitmentContributionType: 'direct_payment',
  });

  await emitFinanceEventNonBlocking('COMMITMENT_SETTLED', txDate, ledger.remainingBalance);
  return tx;
}

function resolveNextEmiStatus(
  existingStatus: EmiTracker['status'],
  requestedStatus: EmiTracker['status'] | undefined,
  nextPaid: number,
  nextTenure: number
): EmiTracker['status'] {
  if (requestedStatus) return requestedStatus;
  if (existingStatus === 'foreclosed') return 'foreclosed';
  return nextPaid >= nextTenure ? 'completed' : 'active';
}

export async function updateEmiTrackerImpl(
  state: FinanceStore,
  id: string,
  data: Partial<EmiTracker>
): Promise<void> {
  const existing = state.emiTrackers.find((e) => e.id === id) || (await db.emiTrackers.get(id));
  if (!existing) return;

  const nextTenure =
    data.tenureMonths !== undefined ? Math.max(1, Number(data.tenureMonths)) : existing.tenureMonths;
  const rawPaid = data.paidMonths !== undefined ? Number(data.paidMonths) : existing.paidMonths;
  const nextPaid = Math.min(nextTenure, Math.max(0, rawPaid));
  const nextStatus = resolveNextEmiStatus(existing.status, data.status, nextPaid, nextTenure);

  await db.emiTrackers.update(id, {
    ...data,
    tenureMonths: nextTenure,
    paidMonths: nextPaid,
    status: nextStatus,
    isDirty: true,
    generationCounter: (existing.generationCounter || 1) + 1,
    updatedAt: new Date().toISOString(),
  });

  await state.loadFinanceData(existing.userId);
  await state.recordCurrentNetWorthSnapshot();
  notifyFinanceSync();
}

export async function payMonthlyEmiImpl(
  state: FinanceStore,
  emiId: string,
  accountId?: string,
  date?: string
): Promise<FinanceTransaction | null> {
  const emi = state.emiTrackers.find((e) => e.id === emiId);
  if (!emi || emi.status !== 'active') return null;

  const now = new Date().toISOString();
  const txDate = date || now.split('T')[0];
  const monthKey = txDate.slice(0, 7);
  const newPaidMonths = Math.min(emi.tenureMonths, emi.paidMonths + 1);
  const newStatus = newPaidMonths >= emi.tenureMonths ? 'completed' : 'active';

  const { account, category } = resolveAccountAndCategory({
    state,
    preferredAccountId: accountId,
    entityAccountId: emi.accountId,
    preferredCategoryId: emi.categoryId,
    fallbackSlug: 'emis-debt-repayment',
  });

  await db.emiTrackers.update(emiId, {
    paidMonths: newPaidMonths,
    lastPaidMonthKey: monthKey,
    status: newStatus,
    isDirty: true,
    updatedAt: now,
  });

  let createdTx: FinanceTransaction | null = null;
  if (account && category) {
    createdTx = await state.addTransaction({
      title: `${emi.loanName} — EMI #${newPaidMonths}/${emi.tenureMonths}`,
      amount: emi.emiAmount,
      type: 'expense',
      categoryId: category.id,
      subcategory: 'Loan EMI',
      accountId: account.id,
      date: txDate,
      notes: `Paid monthly EMI to ${emi.lenderName} (${newPaidMonths} of ${emi.tenureMonths} months completed)`,
      tags: ['emi', emi.lenderName.toLowerCase()],
      linkedEmiId: emi.id,
    });
  } else {
    await state.loadFinanceData(emi.userId);
  }

  await emitFinanceEventNonBlocking('EMI_PAID', txDate, emi.emiAmount);
  return createdTx;
}

export async function payMonthlySipImpl(
  state: FinanceStore,
  sipId: string,
  accountId?: string,
  date?: string
): Promise<FinanceTransaction | null> {
  const sip = state.sipPlans.find((s) => s.id === sipId);
  if (!sip || !sip.isActive) return null;

  const now = new Date().toISOString();
  const txDate = date || now.split('T')[0];
  const monthKey = txDate.slice(0, 7);
  const newTotalInvested = sip.totalInvested + sip.monthlyAmount;
  const newCurrentValue = Math.max(newTotalInvested, sip.currentValue + sip.monthlyAmount);

  await db.financeSipPlans.update(sipId, {
    totalInvested: newTotalInvested,
    currentValue: newCurrentValue,
    lastInvestedMonthKey: monthKey,
    isDirty: true,
    updatedAt: now,
  });

  const { account, category } = resolveAccountAndCategory({
    state,
    preferredAccountId: accountId,
    entityAccountId: sip.accountId,
    preferredCategoryId: sip.categoryId,
    fallbackSlug: 'investments-savings',
  });

  let createdTx: FinanceTransaction | null = null;
  if (account && category) {
    const prefix = sip.platform ? `${sip.platform} · ` : '';
    createdTx = await state.addTransaction({
      title: `SIP Investment — ${sip.name}`,
      amount: sip.monthlyAmount,
      type: 'investment',
      categoryId: category.id,
      subcategory: 'SIP / Mutual Funds',
      accountId: account.id,
      date: txDate,
      notes: `${prefix}Total Invested: ${formatINR(newTotalInvested)}`,
      tags: ['sip', 'investment', sip.assetClass],
      linkedSipId: sip.id,
    });
  } else {
    await state.loadFinanceData(sip.userId);
  }

  await emitFinanceEventNonBlocking('SIP_COMPLETED', txDate, sip.monthlyAmount);
  return createdTx;
}

export async function payRecurringBillImpl(
  state: FinanceStore,
  billId: string,
  accountId?: string,
  date?: string
): Promise<FinanceTransaction | null> {
  const bill = state.recurringBills.find((b) => b.id === billId);
  if (!bill) return null;

  const now = new Date().toISOString();
  const txDate = date || now.split('T')[0];
  await db.financeRecurringBills.update(billId, {
    lastPaidMonthKey: txDate.slice(0, 7),
    isDirty: true,
    updatedAt: now,
  });

  const { account, category } = resolveAccountAndCategory({
    state,
    preferredAccountId: accountId,
    entityAccountId: bill.accountId,
    preferredCategoryId: bill.categoryId,
    fallbackSlug: 'utilities-bills',
  });

  if (!account || !category) {
    await state.loadFinanceData(bill.userId);
    return null;
  }

  return state.addTransaction({
    title: bill.name,
    amount: bill.amount,
    type: 'expense',
    categoryId: category.id,
    subcategory: 'Recurring Bill',
    accountId: account.id,
    date: txDate,
    tags: ['bill', bill.cadence],
    isRecurring: true,
  });
}
