import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { useFinanceStore, getCurrentMonthKey } from '../finance-store';

// Mock mediator to avoid gamification side-effects in isolated finance store tests
vi.mock('../mediator', () => ({
  CrossDomainActionMediator: {
    onFinanceEvent: vi.fn().mockResolvedValue(undefined),
    dispatch: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('FlowFinance Store — Monthly Commitment Offsets, Partial Debts & EMI Engine', () => {
  const testUserId = 'local-demo-user';
  const currentMonth = getCurrentMonthKey();

  beforeEach(async () => {
    await db.financeCategories.clear();
    await db.financeAccounts.clear();
    await db.financeTransactions.clear();
    await db.financeBudgets.clear();
    await db.monthlyCommitments.clear();
    await db.debtRecords.clear();
    await db.debtInstallments.clear();
    await db.emiTrackers.clear();

    await useFinanceStore.getState().loadFinanceData(testUserId);
  });

  test('1. Pre-seeds Mother ₹3,000 commitment with ₹450 lipstick & ₹850 electricity bill offsets leaving ₹1,700 remaining and zero double-counting in Safe-to-Spend', async () => {
    const store = useFinanceStore.getState();
    const motherCommitment = store.commitments.find(
      (c) => c.recipientName === 'Mother'
    );
    expect(motherCommitment).toBeDefined();

    const ledger = store.getCommitmentLedger(motherCommitment!.id, currentMonth);
    expect(ledger).not.toBeNull();
    expect(ledger!.baseTargetAmount).toBe(3000);
    expect(ledger!.offsetExpensesAmount).toBe(1300); // ₹450 lipstick + ₹850 electricity bill
    expect(ledger!.directPaidAmount).toBe(0);
    expect(ledger!.totalFulfilledAmount).toBe(1300);
    expect(ledger!.remainingBalance).toBe(1700);
    expect(ledger!.status).toBe('in_progress');

    // Verify category spend totals include the offset items in their true categories
    const summary = store.getMonthlySummary(currentMonth);
    const shoppingBreakdown = summary.categoryBreakdown.find(
      (b) => b.category.slug === 'shopping-personal-care'
    );
    const utilitiesBreakdown = summary.categoryBreakdown.find(
      (b) => b.category.slug === 'utilities-bills'
    );

    expect(shoppingBreakdown?.spent).toBe(450);
    expect(utilitiesBreakdown?.spent).toBe(850);

    // Verify Safe-to-Spend only deducts the remaining ₹1,700 (not the full ₹3,000 on top of the ₹1,300 already in totalSpent)
    expect(summary.remainingUnpaidCommitments).toBe(1700);
    const expectedSafeToSpend =
      summary.monthlyBudget -
      (summary.totalSpent +
        summary.remainingUnpaidEmis +
        summary.remainingUnpaidCommitments +
        summary.plannedDebtInstallmentsDue);
    expect(summary.safeToSpendMonthly).toBe(expectedSafeToSpend);
  });

  test('2. Settling remaining commitment balance logs ₹1,700 direct transfer and marks commitment settled; overpayment rolls over to next month', async () => {
    const store = useFinanceStore.getState();
    const motherCommitment = store.commitments.find(
      (c) => c.recipientName === 'Mother'
    )!;

    const settlementTx = await store.settleCommitmentBalance(
      motherCommitment.id,
      undefined,
      currentMonth
    );
    expect(settlementTx).not.toBeNull();
    expect(settlementTx!.amount).toBe(1700);
    expect(settlementTx!.commitmentContributionType).toBe('direct_payment');

    const updatedLedger = useFinanceStore
      .getState()
      .getCommitmentLedger(motherCommitment.id, currentMonth)!;
    expect(updatedLedger.directPaidAmount).toBe(1700);
    expect(updatedLedger.offsetExpensesAmount).toBe(1300);
    expect(updatedLedger.totalFulfilledAmount).toBe(3000);
    expect(updatedLedger.remainingBalance).toBe(0);
    expect(updatedLedger.status).toBe('settled');

    // Add an extra ₹500 medicine offset for Mother in currentMonth -> creates ₹500 overpayment
    const medCat = useFinanceStore
      .getState()
      .categories.find((c) => c.slug === 'medical-supplements')!;
    const defaultAcc = useFinanceStore.getState().accounts[0];

    await useFinanceStore.getState().addTransaction({
      title: 'Calcium Supplements for Mother',
      amount: 500,
      type: 'expense',
      categoryId: medCat.id,
      accountId: defaultAcc.id,
      date: `${currentMonth}-15`,
      linkedCommitmentId: motherCommitment.id,
      commitmentContributionType: 'offset_expense',
    });

    const overpaidLedger = useFinanceStore
      .getState()
      .getCommitmentLedger(motherCommitment.id, currentMonth)!;
    expect(overpaidLedger.overpaidAmount).toBe(500);
    expect(overpaidLedger.status).toBe('overpaid');

    // Check next month's effective target has ₹500 deducted via autoRolloverOverpayment
    const [yStr, mStr] = currentMonth.split('-');
    let nextY = parseInt(yStr, 10);
    let nextM = parseInt(mStr, 10) + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const nextMonthKey = `${nextY}-${String(nextM).padStart(2, '0')}`;

    const nextMonthLedger = useFinanceStore
      .getState()
      .getCommitmentLedger(motherCommitment.id, nextMonthKey)!;
    expect(nextMonthLedger.rolloverFromPreviousMonth).toBe(500);
    expect(nextMonthLedger.effectiveTargetAmount).toBe(2500);
  });

  test('3. Borrowed ₹2,000 with partial monthly repayments updates remaining balance and settles at ₹0', async () => {
    const store = useFinanceStore.getState();
    const rahulDebt = store.debtRecords.find((d) =>
      d.personName.includes('Rahul')
    )!;

    // Seeded state: ₹2,000 principal, ₹500 already repaid -> ₹1,500 remaining
    expect(rahulDebt.principalAmount).toBe(2000);
    expect(rahulDebt.totalRepaidAmount).toBe(500);
    expect(rahulDebt.remainingAmount).toBe(1500);

    // Log a second partial installment of ₹400
    const inst2 = await store.recordDebtInstallment({
      debtId: rahulDebt.id,
      amount: 400,
      paymentMethod: 'upi',
      note: '2nd partial installment',
    });

    expect(inst2).not.toBeNull();
    expect(inst2!.balanceAfterPayment).toBe(1100);

    const afterSecond = useFinanceStore
      .getState()
      .debtRecords.find((d) => d.id === rahulDebt.id)!;
    expect(afterSecond.totalRepaidAmount).toBe(900);
    expect(afterSecond.remainingAmount).toBe(1100);
    expect(afterSecond.status).toBe('active');

    // Settle remaining ₹1,100
    await useFinanceStore.getState().recordDebtInstallment({
      debtId: rahulDebt.id,
      amount: 1100,
      paymentMethod: 'upi',
      note: 'Final settlement',
    });

    const settledDebt = useFinanceStore
      .getState()
      .debtRecords.find((d) => d.id === rahulDebt.id)!;
    expect(settledDebt.totalRepaidAmount).toBe(2000);
    expect(settledDebt.remainingAmount).toBe(0);
    expect(settledDebt.status).toBe('settled');
  });

  test('4. Paying monthly EMI increments paidMonths, creates expense transaction, and completes at tenure end', async () => {
    const store = useFinanceStore.getState();
    const macbookEmi = store.emiTrackers[0];
    expect(macbookEmi.paidMonths).toBe(5);
    expect(macbookEmi.tenureMonths).toBe(12);

    const tx = await store.payMonthlyEmi(macbookEmi.id);
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(6500);

    const updatedEmi = useFinanceStore
      .getState()
      .emiTrackers.find((e) => e.id === macbookEmi.id)!;
    expect(updatedEmi.paidMonths).toBe(6);
    expect(updatedEmi.lastPaidMonthKey).toBe(currentMonth);
  });
});
