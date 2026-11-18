import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { useFinanceStore, getCurrentMonthKey } from '../finance-store';

// Mock mediator to avoid gamification side-effects in isolated finance store tests
vi.mock('../mediator', () => ({
  CrossDomainActionMediator: {
    onFinanceEvent: vi.fn().mockResolvedValue(undefined),
    dispatch: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('FlowFinance Store — Fresh Start, Offsets, Partial Debts & EMI Engine', () => {
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

  test('1. Fresh start seeds only 10 categories and 4 clean ₹0 accounts with zero dummy data', async () => {
    const store = useFinanceStore.getState();

    expect(store.categories.length).toBe(10);
    expect(store.categories.every((c) => c.monthlyBudgetLimit === 0)).toBe(true);

    expect(store.accounts.length).toBe(4);
    expect(store.accounts.every((a) => a.balance === 0)).toBe(true);

    expect(store.transactions.length).toBe(0);
    expect(store.commitments.length).toBe(0);
    expect(store.debtRecords.length).toBe(0);
    expect(store.emiTrackers.length).toBe(0);

    const summary = store.getMonthlySummary(currentMonth);
    expect(summary.totalSpent).toBe(0);
    expect(summary.monthlyBudget).toBe(0);
    expect(summary.totalIncome).toBe(0);
  });

  test('2. Monthly commitment offset math + settlement + rollover + resetAllFinanceData', async () => {
    const store = useFinanceStore.getState();
    const familyCat = store.categories.find((c) => c.slug === 'family-commitments')!;
    const shoppingCat = store.categories.find((c) => c.slug === 'shopping-personal-care')!;
    const utilitiesCat = store.categories.find((c) => c.slug === 'utilities-bills')!;
    const medCat = store.categories.find((c) => c.slug === 'medical-supplements')!;
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;

    await store.setMonthlyBudget(currentMonth, 40000);

    const motherCommitment = await store.addCommitment({
      title: "Mother's Monthly Allowance",
      recipientName: 'Mother',
      relationship: 'Mother',
      monthlyTargetAmount: 3000,
      dueDayOfMonth: 10,
      category: 'family_support',
      defaultCategoryId: familyCat.id,
      autoRolloverOverpayment: true,
      icon: 'HeartHandshake',
      color: '#ec4899',
      isActive: true,
    });

    await useFinanceStore.getState().addTransaction({
      title: 'Lipstick for Mother',
      amount: 450,
      type: 'expense',
      categoryId: shoppingCat.id,
      accountId: upiAcc.id,
      date: `${currentMonth}-05`,
      linkedCommitmentId: motherCommitment.id,
      commitmentContributionType: 'offset_expense',
    });

    await useFinanceStore.getState().addTransaction({
      title: 'Electricity Bill',
      amount: 850,
      type: 'expense',
      categoryId: utilitiesCat.id,
      accountId: upiAcc.id,
      date: `${currentMonth}-06`,
      linkedCommitmentId: motherCommitment.id,
      commitmentContributionType: 'offset_expense',
    });

    const ledger = useFinanceStore
      .getState()
      .getCommitmentLedger(motherCommitment.id, currentMonth)!;
    expect(ledger.offsetExpensesAmount).toBe(1300);
    expect(ledger.remainingBalance).toBe(1700);
    expect(ledger.status).toBe('in_progress');

    const summary = useFinanceStore.getState().getMonthlySummary(currentMonth);
    expect(summary.totalSpent).toBe(1300);
    expect(summary.remainingUnpaidCommitments).toBe(1700);
    expect(summary.safeToSpendMonthly).toBe(40000 - (1300 + 1700));

    // Settle remaining ₹1,700
    const settlementTx = await useFinanceStore
      .getState()
      .settleCommitmentBalance(motherCommitment.id, upiAcc.id, currentMonth);
    expect(settlementTx?.amount).toBe(1700);

    // Extra ₹500 medicine offset creates overpayment that rolls over to next month
    await useFinanceStore.getState().addTransaction({
      title: 'Calcium Supplements',
      amount: 500,
      type: 'expense',
      categoryId: medCat.id,
      accountId: upiAcc.id,
      date: `${currentMonth}-15`,
      linkedCommitmentId: motherCommitment.id,
      commitmentContributionType: 'offset_expense',
    });

    const [yStr, mStr] = currentMonth.split('-');
    let nextY = parseInt(yStr, 10);
    let nextM = parseInt(mStr, 10) + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const nextMonthKey = `${nextY}-${String(nextM).padStart(2, '0')}`;
    const nextLedger = useFinanceStore
      .getState()
      .getCommitmentLedger(motherCommitment.id, nextMonthKey)!;
    expect(nextLedger.rolloverFromPreviousMonth).toBe(500);
    expect(nextLedger.effectiveTargetAmount).toBe(2500);

    // Verify resetAllFinanceData keeps categories and resets everything else to ₹0
    await useFinanceStore.getState().resetAllFinanceData(true);
    const afterReset = useFinanceStore.getState();
    expect(afterReset.categories.length).toBe(10);
    expect(afterReset.transactions.length).toBe(0);
    expect(afterReset.commitments.length).toBe(0);
    expect(afterReset.accounts.every((a) => a.balance === 0)).toBe(true);
  });

  test('3. Borrowed ₹2,000 with partial monthly repayments updates remaining balance and settles at ₹0', async () => {
    const store = useFinanceStore.getState();
    const rahulDebt = await store.addDebtRecord({
      personName: 'Rahul Sharma',
      direction: 'borrowed',
      title: 'Goa Trip',
      principalAmount: 2000,
      startDate: `${currentMonth}-01`,
      repaymentSchedule: 'monthly_partial',
      plannedMonthlyInstallment: 500,
      dueDayOfMonth: 15,
      color: '#f59e0b',
    });

    const inst1 = await useFinanceStore.getState().recordDebtInstallment({
      debtId: rahulDebt.id,
      amount: 500,
      paymentMethod: 'upi',
      note: '1st installment',
    });
    expect(inst1?.balanceAfterPayment).toBe(1500);

    const inst2 = await useFinanceStore.getState().recordDebtInstallment({
      debtId: rahulDebt.id,
      amount: 1500,
      paymentMethod: 'upi',
      note: 'Final settlement',
    });
    expect(inst2?.balanceAfterPayment).toBe(0);

    const settled = useFinanceStore
      .getState()
      .debtRecords.find((d) => d.id === rahulDebt.id)!;
    expect(settled.totalRepaidAmount).toBe(2000);
    expect(settled.remainingAmount).toBe(0);
    expect(settled.status).toBe('settled');
  });

  test('4. Paying monthly EMI increments paidMonths, logs expense, and updates account balance', async () => {
    const store = useFinanceStore.getState();
    const emiCat = store.categories.find((c) => c.slug === 'emis-debt-repayment')!;
    const bankAcc = store.accounts.find((a) => a.type === 'bank')!;

    await store.updateAccount(bankAcc.id, { balance: 20000 });

    const emi = await store.addEmiTracker({
      loanName: 'Laptop EMI',
      lenderName: 'HDFC',
      principalAmount: 60000,
      interestRateAnnual: 0,
      emiAmount: 5000,
      tenureMonths: 12,
      paidMonths: 5,
      startDate: `${currentMonth}-01`,
      billingDayOfMonth: 5,
      categoryId: emiCat.id,
      accountId: bankAcc.id,
      autoCreateTaskReminder: true,
      status: 'active',
    });

    const tx = await useFinanceStore.getState().payMonthlyEmi(emi.id);
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(5000);

    const updatedEmi = useFinanceStore
      .getState()
      .emiTrackers.find((e) => e.id === emi.id)!;
    expect(updatedEmi.paidMonths).toBe(6);
    expect(updatedEmi.lastPaidMonthKey).toBe(currentMonth);

    const updatedBank = useFinanceStore
      .getState()
      .accounts.find((a) => a.id === bankAcc.id)!;
    expect(updatedBank.balance).toBe(15000);
  });

  test('5. Setting specific category spending limits calculates overall budget and tracks actual vs budgeted status', async () => {
    const store = useFinanceStore.getState();
    const foodCat = store.categories.find((c) => c.slug === 'food-dining')!;
    const groceryCat = store.categories.find((c) => c.slug === 'groceries-household')!;
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;

    await store.saveMonthlyBudgetSettings(currentMonth, 0, {
      [foodCat.id]: 2000,
      [groceryCat.id]: 5000,
    });

    await useFinanceStore.getState().addTransaction({
      title: 'Dinner',
      amount: 1700,
      type: 'expense',
      categoryId: foodCat.id,
      accountId: upiAcc.id,
      date: `${currentMonth}-08`,
    });

    await useFinanceStore.getState().addTransaction({
      title: 'Supermarket',
      amount: 5500,
      type: 'expense',
      categoryId: groceryCat.id,
      accountId: upiAcc.id,
      date: `${currentMonth}-09`,
    });

    const summary = useFinanceStore.getState().getMonthlySummary(currentMonth);
    expect(summary.monthlyBudget).toBe(7000);

    const foodStatus = summary.categoryBreakdown.find((b) => b.category.id === foodCat.id)!;
    expect(foodStatus.budgetLimit).toBe(2000);
    expect(foodStatus.spent).toBe(1700);
    expect(foodStatus.percentageOfBudget).toBe(85);
    expect(foodStatus.status).toBe('warning');

    const groceryStatus = summary.categoryBreakdown.find(
      (b) => b.category.id === groceryCat.id
    )!;
    expect(groceryStatus.budgetLimit).toBe(5000);
    expect(groceryStatus.spent).toBe(5500);
    expect(groceryStatus.percentageOfBudget).toBe(110);
    expect(groceryStatus.status).toBe('exceeded');
  });

  test('6. 6-month spending trends compare monthly expenses against set category budgets in chronological order', async () => {
    const store = useFinanceStore.getState();
    const foodCat = store.categories.find((c) => c.slug === 'food-dining')!;
    const shoppingCat = store.categories.find((c) => c.slug === 'shopping-personal-care')!;
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;

    await store.saveMonthlyBudgetSettings('2026-06', 0, {
      [foodCat.id]: 3000,
      [shoppingCat.id]: 2000,
    });

    await useFinanceStore.getState().addTransaction({
      title: 'April Food',
      amount: 2500,
      type: 'expense',
      categoryId: foodCat.id,
      accountId: upiAcc.id,
      date: '2026-04-12',
    });

    await useFinanceStore.getState().addTransaction({
      title: 'June Food Overrun',
      amount: 3800,
      type: 'expense',
      categoryId: foodCat.id,
      accountId: upiAcc.id,
      date: '2026-06-05',
    });

    await useFinanceStore.getState().addTransaction({
      title: 'June Shopping',
      amount: 1500,
      type: 'expense',
      categoryId: shoppingCat.id,
      accountId: upiAcc.id,
      date: '2026-06-10',
    });

    const allTrends = useFinanceStore
      .getState()
      .getSixMonthSpendingTrends('2026-06', 'all');
    expect(allTrends).toHaveLength(6);
    expect(allTrends.map((p) => p.monthKey)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ]);

    const juneAll = allTrends[5];
    expect(juneAll.spent).toBe(5300);
    expect(juneAll.budget).toBe(5000);
    expect(juneAll.isOverBudget).toBe(true);
    expect(juneAll.variance).toBe(-300);

    const foodTrends = useFinanceStore
      .getState()
      .getSixMonthSpendingTrends('2026-06', foodCat.id);
    const aprilFood = foodTrends[3];
    expect(aprilFood.spent).toBe(2500);
    expect(aprilFood.budget).toBe(3000);
    expect(aprilFood.isOverBudget).toBe(false);
    expect(aprilFood.variance).toBe(500);

    const juneFood = foodTrends[5];
    expect(juneFood.spent).toBe(3800);
    expect(juneFood.budget).toBe(3000);
    expect(juneFood.isOverBudget).toBe(true);
  });

  test('7. Yearly spending trends aggregate annual expenses against annualized category budgets', async () => {
    const store = useFinanceStore.getState();
    const foodCat = store.categories.find((c) => c.slug === 'food-dining')!;
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;

    await store.saveMonthlyBudgetSettings('2026-06', 0, {
      [foodCat.id]: 1000, // Annualized = 12,000
    });

    await useFinanceStore.getState().addTransaction({
      title: '2025 Food Trip',
      amount: 9500,
      type: 'expense',
      categoryId: foodCat.id,
      accountId: upiAcc.id,
      date: '2025-11-15',
    });

    await useFinanceStore.getState().addTransaction({
      title: '2026 Food Catering',
      amount: 14000,
      type: 'expense',
      categoryId: foodCat.id,
      accountId: upiAcc.id,
      date: '2026-03-20',
    });

    const yearlyTrends = useFinanceStore
      .getState()
      .getYearlySpendingTrends('2026-06', foodCat.id, 5);
    expect(yearlyTrends).toHaveLength(5);
    expect(yearlyTrends.map((y) => y.label)).toEqual([
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
    ]);

    const y2025 = yearlyTrends[3];
    expect(y2025.spent).toBe(9500);
    expect(y2025.budget).toBe(12000);
    expect(y2025.isOverBudget).toBe(false);
    expect(y2025.variance).toBe(2500);

    const y2026 = yearlyTrends[4];
    expect(y2026.spent).toBe(14000);
    expect(y2026.budget).toBe(12000);
    expect(y2026.isOverBudget).toBe(true);
    expect(y2026.variance).toBe(-2000);
  });

  test('8. Sends toast warning when category spending exceeds 90% and toast error at 100%+', async () => {
    const warnSpy = vi.spyOn(toast, 'warning').mockImplementation(() => '');
    const errSpy = vi.spyOn(toast, 'error').mockImplementation(() => '');

    try {
      const store = useFinanceStore.getState();
      const foodCat = store.categories.find((c) => c.slug === 'food-dining')!;
      const upiAcc = store.accounts.find((a) => a.type === 'upi')!;

      await store.saveMonthlyBudgetSettings(currentMonth, 0, {
        [foodCat.id]: 2000,
      });

      // Exactly 90% (1800 / 2000) -> should NOT trigger >90% alert
      const tx1 = await useFinanceStore.getState().addTransaction({
        title: 'Grocer Food',
        amount: 1800,
        type: 'expense',
        categoryId: foodCat.id,
        accountId: upiAcc.id,
        date: `${currentMonth}-10`,
      });
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errSpy).not.toHaveBeenCalled();

      // Update to 1900 (95% > 90%) -> triggers toast.warning
      await useFinanceStore.getState().updateTransaction(tx1.id, { amount: 1900 });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('95%');

      // Add 200 -> 2100 (105% >= 100%) -> triggers toast.error
      await useFinanceStore.getState().addTransaction({
        title: 'Late Night Snack',
        amount: 200,
        type: 'expense',
        categoryId: foodCat.id,
        accountId: upiAcc.id,
        date: `${currentMonth}-11`,
      });
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(errSpy.mock.calls[0][0]).toContain('105%');
    } finally {
      warnSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
