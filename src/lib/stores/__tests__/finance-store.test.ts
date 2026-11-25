import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { useFinanceStore, getCurrentMonthKey } from '../finance-store';
import { buildDeterministicFinanceAnswer } from '@/lib/finance/qa-analyzer';

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

  test('1. Fresh start seeds only 11 default categories (including Junk Food) and 4 clean ₹0 accounts with zero dummy data', async () => {
    const store = useFinanceStore.getState();

    expect(store.categories.length).toBe(11);
    expect(store.categories.some((c) => c.slug === 'junk-food')).toBe(true);
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
    expect(afterReset.categories.length).toBe(11);
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

  test('9. getFilteredTransactions safely handles legacy transactions with undefined tags during search and tag filtering', async () => {
    const store = useFinanceStore.getState();
    const foodCat = store.categories.find((c) => c.slug === 'food-dining')!;
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;

    await store.addTransaction({
      title: 'Swiggy Bowl',
      amount: 320,
      type: 'expense',
      categoryId: foodCat.id,
      accountId: upiAcc.id,
      date: `${currentMonth}-12`,
      tags: ['dinner'],
    });

    // Simulate legacy record with undefined tags in store state
    useFinanceStore.setState((state) => ({
      transactions: [
        ...state.transactions,
        {
          id: 'legacy-no-tags',
          userId: testUserId,
          title: 'Legacy Coffee',
          amount: 140,
          type: 'expense',
          categoryId: foodCat.id,
          accountId: upiAcc.id,
          date: `${currentMonth}-13`,
          monthKey: currentMonth,
          tags: undefined as unknown as string[],
          isRecurring: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));

    useFinanceStore.getState().setFilters({ searchQuery: 'coffee' });
    const searchResults = useFinanceStore.getState().getFilteredTransactions(currentMonth);
    expect(searchResults.map((t) => t.id)).toEqual(['legacy-no-tags']);

    useFinanceStore.getState().setFilters({ searchQuery: '', tag: 'dinner' });
    const tagResults = useFinanceStore.getState().getFilteredTransactions(currentMonth);
    expect(tagResults.map((t) => t.title)).toEqual(['Swiggy Bowl']);
  });

  test('10. setDefaultAccount switches isDefault exclusively across user accounts', async () => {
    const store = useFinanceStore.getState();
    const bankAcc = store.accounts.find((a) => a.type === 'bank')!;
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;

    expect(upiAcc.isDefault).toBe(true);
    expect(bankAcc.isDefault).toBe(false);

    await store.setDefaultAccount(bankAcc.id);
    const updated = useFinanceStore.getState().accounts;
    expect(updated.find((a) => a.id === bankAcc.id)?.isDefault).toBe(true);
    expect(updated.find((a) => a.id === upiAcc.id)?.isDefault).toBe(false);
    expect(updated.filter((a) => a.isDefault)).toHaveLength(1);
  });

  test('11. Finance Q&A deterministic analyzer produces distinct answers per question intent', () => {
    const context = {
      selectedMonth: '2026-11',
      monthlySummary: {
        totalIncome: 80000,
        totalSpent: 24500,
        totalInvested: 15000,
        safeToSpendMonthly: 18000,
        safeToSpendDaily: 1800,
        remainingDaysInMonth: 10,
        savingsRatePct: 50,
        remainingUnpaidBills: 2400,
        remainingUnpaidEmis: 5000,
        remainingUnpaidCommitments: 0,
      },
      netWorth: {
        netWorth: 245000,
        liquidAssets: 95000,
        investmentAssets: 175000,
        totalLiabilities: 25000,
      },
      categories: [
        { name: 'Food & Dining', spent: 6200, budgetLimit: 8000, transactionCount: 9 },
        { name: 'Transport', spent: 3100, budgetLimit: 4000, transactionCount: 6 },
      ],
      accounts: [{ name: 'UPI', type: 'upi', balance: 45000, isDefault: true }],
      recurringBills: [{ name: 'Jio Fiber', amount: 999, cadence: 'monthly', dueDay: 15, annualized: 11988 }],
      activeEmis: [{ name: 'Phone EMI', emiAmount: 5000, remainingMonths: 4, interestRate: 12 }],
      activeSips: [{ name: 'Nifty 50 SIP', monthlyAmount: 10000, totalInvested: 100000, currentValue: 118000 }],
      openFriendDebts: [],
      topMerchants: [{ merchant: 'Swiggy', spent: 3400, count: 5, category: 'Food & Dining' }],
      recentTransactions: [
        { date: '2026-11-18', title: 'Swiggy Dinner', merchant: 'Swiggy', amount: 420, type: 'expense', category: 'Food & Dining', tags: [] },
      ],
      trailingMonths: [{ monthKey: '2026-11', income: 80000, spent: 24500, invested: 15000 }],
      anomalies: [],
    };

    const foodAns = buildDeterministicFinanceAnswer('How much did I spend on Food?', context);
    const nwAns = buildDeterministicFinanceAnswer('What is my current Net Worth?', context);
    const crunchAns = buildDeterministicFinanceAnswer('Do I have any cash-flow crunch?', context);
    const sipAns = buildDeterministicFinanceAnswer('How are my SIPs doing?', context);
    const swiggyAns = buildDeterministicFinanceAnswer('Show my Swiggy orders', context);

    expect(foodAns).toContain('Food & Dining');
    expect(nwAns).toContain('₹2,45,000');
    expect(crunchAns).toContain('remaining obligations');
    expect(sipAns).toContain('Nifty 50 SIP');
    expect(swiggyAns).toContain('Swiggy Dinner');
    expect(new Set([foodAns, nwAns, crunchAns, sipAns, swiggyAns]).size).toBe(5);
  });

  test('12. updateEmiTracker edits loan details, clamps paidMonths, auto-completes, and bumps generationCounter', async () => {
    const store = useFinanceStore.getState();
    const emiCat = store.categories.find((c) => c.slug === 'emis-debt-repayment')!;
    const bankAcc = store.accounts.find((a) => a.type === 'bank')!;

    const emi = await store.addEmiTracker({
      loanName: 'Phone EMI',
      lenderName: 'Bajaj',
      principalAmount: 30000,
      interestRateAnnual: 0,
      emiAmount: 5000,
      tenureMonths: 6,
      paidMonths: 2,
      startDate: `${currentMonth}-01`,
      billingDayOfMonth: 5,
      categoryId: emiCat.id,
      accountId: bankAcc.id,
      autoCreateTaskReminder: false,
      status: 'active',
    });
    expect(emi.generationCounter).toBe(1);

    await useFinanceStore.getState().updateEmiTracker(emi.id, {
      loanName: 'MacBook EMI',
      lenderName: 'HDFC Bank',
      emiAmount: 5200,
      paidMonths: 6,
      billingDayOfMonth: 10,
      notes: 'Updated terms',
    });

    const updated = useFinanceStore
      .getState()
      .emiTrackers.find((e) => e.id === emi.id)!;
    expect(updated.loanName).toBe('MacBook EMI');
    expect(updated.lenderName).toBe('HDFC Bank');
    expect(updated.emiAmount).toBe(5200);
    expect(updated.paidMonths).toBe(6);
    expect(updated.billingDayOfMonth).toBe(10);
    expect(updated.status).toBe('completed');
    expect(updated.generationCounter).toBe(2);
  });

  test('13. updateDebtRecord recalculates remainingAmount, status, and direction color', async () => {
    const store = useFinanceStore.getState();
    const debt = await store.addDebtRecord({
      personName: 'Arjun',
      direction: 'borrowed',
      title: 'Concert Tickets',
      principalAmount: 3000,
      startDate: `${currentMonth}-01`,
      repaymentSchedule: 'lump_sum',
      color: '#f43f5e',
    });

    await useFinanceStore.getState().recordDebtInstallment({
      debtId: debt.id,
      amount: 1000,
      paymentMethod: 'upi',
      note: 'Part 1',
    });

    await useFinanceStore.getState().updateDebtRecord(debt.id, {
      personName: 'Arjun Verma',
      direction: 'lent',
      principalAmount: 2500,
      notes: 'Edited principal',
    });

    const edited = useFinanceStore
      .getState()
      .debtRecords.find((d) => d.id === debt.id)!;
    expect(edited.personName).toBe('Arjun Verma');
    expect(edited.direction).toBe('lent');
    expect(edited.color).toBe('#10b981');
    expect(edited.totalRepaidAmount).toBe(1000);
    expect(edited.remainingAmount).toBe(1500);
    expect(edited.status).toBe('active');
    expect(edited.generationCounter).toBe(3);

    // Lowering principal to match repaid amount settles the record automatically
    await useFinanceStore.getState().updateDebtRecord(debt.id, {
      principalAmount: 1000,
    });
    const settled = useFinanceStore
      .getState()
      .debtRecords.find((d) => d.id === debt.id)!;
    expect(settled.remainingAmount).toBe(0);
    expect(settled.status).toBe('settled');
  });

  test('14. updateDebtInstallment and deleteDebtInstallment sync balances, transactions, and parent debt', async () => {
    const store = useFinanceStore.getState();
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;
    await store.updateAccount(upiAcc.id, { balance: 10000 });

    const debt = await store.addDebtRecord({
      personName: 'Meera',
      direction: 'borrowed',
      title: 'Hotel Split',
      principalAmount: 4000,
      startDate: `${currentMonth}-01`,
      repaymentSchedule: 'monthly_partial',
      color: '#f43f5e',
    });

    const inst1 = await useFinanceStore.getState().recordDebtInstallment({
      debtId: debt.id,
      amount: 1000,
      date: `${currentMonth}-05`,
      paymentMethod: 'upi',
      accountId: upiAcc.id,
      note: '1st payment',
    });
    const inst2 = await useFinanceStore.getState().recordDebtInstallment({
      debtId: debt.id,
      amount: 1500,
      date: `${currentMonth}-10`,
      paymentMethod: 'upi',
      accountId: upiAcc.id,
      note: '2nd payment',
    });
    expect(inst1).not.toBeNull();
    expect(inst2).not.toBeNull();

    // Balance dropped by 1000 + 1500 = 2500 -> 7500
    expect(
      useFinanceStore.getState().accounts.find((a) => a.id === upiAcc.id)?.balance
    ).toBe(7500);

    // Edit inst1 from 1000 -> 1800 (+800 expense -> balance 6700, total repaid 3300, remaining 700)
    await useFinanceStore.getState().updateDebtInstallment(inst1!.id, {
      amount: 1800,
      note: 'Adjusted 1st payment',
    });

    const afterEditDebt = useFinanceStore
      .getState()
      .debtRecords.find((d) => d.id === debt.id)!;
    expect(afterEditDebt.totalRepaidAmount).toBe(3300);
    expect(afterEditDebt.remainingAmount).toBe(700);
    expect(
      useFinanceStore.getState().accounts.find((a) => a.id === upiAcc.id)?.balance
    ).toBe(6700);

    const updatedInst2 = useFinanceStore
      .getState()
      .debtInstallments.find((i) => i.id === inst2!.id)!;
    expect(updatedInst2.balanceAfterPayment).toBe(700);

    // Delete inst2 (1500 reversed back to account -> 8200; total repaid 1800; remaining 2200)
    await useFinanceStore.getState().deleteDebtInstallment(inst2!.id);
    const afterDeleteDebt = useFinanceStore
      .getState()
      .debtRecords.find((d) => d.id === debt.id)!;
    expect(afterDeleteDebt.totalRepaidAmount).toBe(1800);
    expect(afterDeleteDebt.remainingAmount).toBe(2200);
    expect(afterDeleteDebt.status).toBe('active');
    expect(
      useFinanceStore.getState().accounts.find((a) => a.id === upiAcc.id)?.balance
    ).toBe(8200);
    expect(
      useFinanceStore.getState().debtInstallments.find((i) => i.id === inst2!.id)
    ).toBeUndefined();
  });

  test('15. getFriendLedgerGroups keeps Everyday Splits and Long-Term Loans isolated per friend', async () => {
    const store = useFinanceStore.getState();

    // Friend Rahul: Loan of 10,000 borrowed (I owe him), and Everyday split of 400 lent (he owes me)
    await store.addDebtRecord({
      personName: 'Rahul',
      direction: 'borrowed',
      title: 'Laptop Loan',
      principalAmount: 10000,
      bucketType: 'long_term_loan',
      isEmi: true,
      emiAmount: 2000,
      startDate: `${currentMonth}-01`,
      repaymentSchedule: 'monthly_partial',
      color: '#f43f5e',
    });

    await store.addDebtRecord({
      personName: 'rahul ', // Test normalized name grouping
      direction: 'lent',
      title: 'Dinner at Social',
      principalAmount: 400,
      bucketType: 'everyday_split',
      startDate: `${currentMonth}-02`,
      repaymentSchedule: 'flexible',
      color: '#10b981',
    });

    const groups = store.getFriendLedgerGroups();
    expect(groups.length).toBe(1);

    const rahul = groups[0];
    expect(rahul.friendKey).toBe('rahul');
    expect(rahul.friendName).toBe('Rahul');

    // Everyday tab net: +400 (Rahul owes user)
    expect(rahul.everydayNet).toBe(400);
    expect(rahul.everydayLentRemaining).toBe(400);
    expect(rahul.everydayBorrowedRemaining).toBe(0);

    // Long-term loan remains untouched at 10,000 borrowed (user owes Rahul)
    expect(rahul.longTermBorrowedRemaining).toBe(10000);
    expect(rahul.longTermLentRemaining).toBe(0);
    expect(rahul.longTermLoans.length).toBe(1);
    expect(rahul.longTermLoans[0].title).toBe('Laptop Loan');
    expect(rahul.longTermLoans[0].remainingAmount).toBe(10000);

    // Opposite directions -> canOffsetAgainstLoan is true
    expect(rahul.canOffsetAgainstLoan).toBe(true);

    // Debt summary isolated breakdown
    const summary = store.getDebtSummary();
    expect(summary.everydayNetPosition).toBe(400);
    expect(summary.longTermNetPosition).toBe(-10000);
    expect(summary.netPosition).toBe(-9600);
  });

  test('16. settleEverydayTab settles mixed everyday entries and logs a single net transaction', async () => {
    const store = useFinanceStore.getState();
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;
    await store.updateAccount(upiAcc.id, { balance: 5000 });

    // Split 1: Rahul owes user 600
    await store.addDebtRecord({
      personName: 'Rahul',
      direction: 'lent',
      title: 'Lunch Split',
      principalAmount: 600,
      bucketType: 'everyday_split',
      startDate: `${currentMonth}-01`,
      repaymentSchedule: 'flexible',
      color: '#10b981',
    });

    // Split 2: User owes Rahul 200
    await store.addDebtRecord({
      personName: 'Rahul',
      direction: 'borrowed',
      title: 'Cab Share',
      principalAmount: 200,
      bucketType: 'everyday_split',
      startDate: `${currentMonth}-02`,
      repaymentSchedule: 'flexible',
      color: '#f43f5e',
    });

    const groupsBefore = store.getFriendLedgerGroups();
    expect(groupsBefore[0].everydayNet).toBe(400); // 600 - 200 = 400 net owed to user

    // Settle tab
    const tx = await store.settleEverydayTab('rahul', {
      accountId: upiAcc.id,
      paymentMethod: 'upi',
      note: 'Settled over UPI',
    });

    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(400);
    expect(tx!.type).toBe('income'); // User was owed 400 net -> income

    // Account balance increased by 400 (5000 -> 5400)
    const updatedAcc = useFinanceStore.getState().accounts.find((a) => a.id === upiAcc.id)!;
    expect(updatedAcc.balance).toBe(5400);

    // All everyday records for Rahul marked settled
    const activeDebts = useFinanceStore.getState().debtRecords.filter(
      (d) => d.personName.toLowerCase() === 'rahul' && d.status === 'active'
    );
    expect(activeDebts.length).toBe(0);

    const groupsAfter = useFinanceStore.getState().getFriendLedgerGroups();
    expect(groupsAfter[0].everydayNet).toBe(0);
  });

  test('17. offsetSplitAgainstLoan coordinates debt reduction without moving bank cash', async () => {
    const store = useFinanceStore.getState();
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;
    await store.updateAccount(upiAcc.id, { balance: 5000 });

    const loan = await store.addDebtRecord({
      personName: 'Rahul',
      direction: 'borrowed',
      title: 'Bike Loan',
      principalAmount: 5000,
      bucketType: 'long_term_loan',
      isEmi: true,
      paidInstallments: 0,
      startDate: `${currentMonth}-01`,
      repaymentSchedule: 'monthly_partial',
      color: '#f43f5e',
    });

    await store.addDebtRecord({
      personName: 'Rahul',
      direction: 'lent',
      title: 'Groceries Split',
      principalAmount: 1000,
      bucketType: 'everyday_split',
      startDate: `${currentMonth}-03`,
      repaymentSchedule: 'flexible',
      color: '#10b981',
    });

    // Offset ₹1000 everyday split against loan
    const success = await store.offsetSplitAgainstLoan('rahul', loan.id, 1000);
    expect(success).toBe(true);

    // Bank account remains exactly 5000 (no duplicate cash movement)
    expect(useFinanceStore.getState().accounts.find((a) => a.id === upiAcc.id)!.balance).toBe(5000);

    // Loan reduced to 4000, paid installments incremented to 1
    const updatedLoan = useFinanceStore.getState().debtRecords.find((d) => d.id === loan.id)!;
    expect(updatedLoan.remainingAmount).toBe(4000);
    expect(updatedLoan.totalRepaidAmount).toBe(1000);
    expect(updatedLoan.paidInstallments).toBe(1);

    // Installment recorded with offset_expense and null transactionId
    const installments = useFinanceStore.getState().getDebtInstallments(loan.id);
    expect(installments.length).toBe(1);
    expect(installments[0].paymentMethod).toBe('offset_expense');
    expect(installments[0].transactionId).toBeNull();

    // Everyday split reduced to 0 and settled
    const everydaySplit = useFinanceStore.getState().debtRecords.find(
      (d) => d.bucketType === 'everyday_split' && d.personName === 'Rahul'
    )!;
    expect(everydaySplit.remainingAmount).toBe(0);
    expect(everydaySplit.status).toBe('settled');
  });

  test('18. splitTransactionWithFriend defaults to everyday_split', async () => {
    const store = useFinanceStore.getState();
    const upiAcc = store.accounts.find((a) => a.type === 'upi')!;
    const foodCat = store.categories.find((c) => c.slug === 'food-dining')!;
    await store.updateAccount(upiAcc.id, { balance: 2000 });

    await store.splitTransactionWithFriend({
      txData: {
        title: 'Dinner at Bawarchi',
        amount: 800,
        type: 'expense',
        categoryId: foodCat.id,
        accountId: upiAcc.id,
        date: `${currentMonth}-05`,
      },
      friendName: 'Amit',
      friendShareAmount: 400,
    });

    // Created a new everyday split
    const friendSplit = useFinanceStore.getState().debtRecords.find(
      (d) => d.personName.toLowerCase() === 'amit' && d.bucketType === 'everyday_split'
    );
    expect(friendSplit).toBeDefined();
    expect(friendSplit!.remainingAmount).toBe(400);
    expect(friendSplit!.bucketType).toBe('everyday_split');
  });

  test('19. Multi-Card Credit Card Billing Cycle — Reconcile Statement & Dual-Bucket Summary', async () => {
    const store = useFinanceStore.getState();
    const foodCat = store.categories.find((c) => c.slug === 'food-dining')!;

    // 1. Create a Slice credit card account
    const sliceCard = await store.addAccount({
      name: 'Slice SuperCard',
      type: 'credit_card',
      balance: 0,
      creditLimit: 100000,
      billingDay: 21,
      dueDay: 5,
      currency: 'INR',
      color: '#f43f5e',
      icon: 'CreditCard',
      isDefault: false,
      archived: false,
    });

    // 2. Reconcile opening Nov 21 bill to ₹22,000
    const stmt = await store.reconcileCreditCardStatement({
      cardAccountId: sliceCard.id,
      cycleKey: '2026-11',
      actualStatementAmount: 22000,
      note: 'Nov 21 Statement',
    });
    expect(stmt.totalDue).toBe(22000);
    expect(stmt.remainingDue).toBe(22000);
    expect(stmt.dueDate).toBe('2026-12-05');

    // 3. Log a new spend in the unbilled cycle (Nov 23)
    await store.addTransaction({
      title: 'Zomato Group Order',
      amount: 20000,
      type: 'expense',
      categoryId: foodCat.id,
      accountId: sliceCard.id,
      date: '2026-11-23',
    });

    // 4. Compute summary on Nov 25
    const summary = store.getCreditCardSummary(sliceCard.id, '2026-11-25');
    expect(summary).not.toBeNull();
    expect(summary!.billedDueTotal).toBe(22000);
    expect(summary!.unbilledCycle.amount).toBe(20000);
    expect(summary!.totalOutstanding).toBe(42000);
    expect(summary!.availableCredit).toBe(58000);
    expect(summary!.utilizationPercent).toBe(42);
    expect(summary!.nextDueDate).toBe('2026-12-05');
  });

  test('20. Multi-Card Credit Card Bill Payment — Waterfall Allocation & Bank Balance Deduction', async () => {
    const store = useFinanceStore.getState();
    const bankAcc = store.accounts.find((a) => a.type === 'bank')!;
    const foodCat = store.categories.find((c) => c.slug === 'food-dining')!;

    // 1. Create a Slice card and set bank balance to ₹50,000
    const sliceCard = await store.addAccount({
      name: 'Slice SuperCard',
      type: 'credit_card',
      balance: 0,
      creditLimit: 100000,
      billingDay: 21,
      dueDay: 5,
      currency: 'INR',
      color: '#f43f5e',
      icon: 'CreditCard',
      isDefault: false,
      archived: false,
    });
    await store.updateAccount(bankAcc.id, { balance: 50000 });

    // 2. Reconcile opening Nov 21 bill to ₹22,000
    await store.reconcileCreditCardStatement({
      cardAccountId: sliceCard.id,
      cycleKey: '2026-11',
      actualStatementAmount: 22000,
    });

    // 3. Log ₹20,000 unbilled spend on Nov 23
    await store.addTransaction({
      title: 'Zomato Group Order',
      amount: 20000,
      type: 'expense',
      categoryId: foodCat.id,
      accountId: sliceCard.id,
      date: '2026-11-23',
    });

    // 4. Pay ₹10,000 towards the Slice bill from bank account
    const payTx1 = await store.payCreditCardBill({
      cardAccountId: sliceCard.id,
      fromAccountId: bankAcc.id,
      amount: 10000,
      date: '2026-11-26',
    });

    expect(payTx1.isCreditCardPayment).toBe(true);
    expect(payTx1.type).toBe('transfer');

    // Bank account reduced from ₹50,000 to ₹40,000
    const bankAfterPay1 = useFinanceStore.getState().accounts.find((a) => a.id === bankAcc.id)!;
    expect(bankAfterPay1.balance).toBe(40000);

    // Billed statement remaining due is now ₹12,000 (status: partial)
    const summary1 = useFinanceStore.getState().getCreditCardSummary(sliceCard.id, '2026-11-26')!;
    expect(summary1.billedDueTotal).toBe(12000);
    expect(summary1.currentBilledStatement?.status).toBe('partial');
    expect(summary1.totalOutstanding).toBe(32000); // 12000 + 20000

    // 5. Pay remaining ₹12,000 to clear the bill
    await store.payCreditCardBill({
      cardAccountId: sliceCard.id,
      fromAccountId: bankAcc.id,
      amount: 12000,
      date: '2026-11-27',
    });

    const summary2 = useFinanceStore.getState().getCreditCardSummary(sliceCard.id, '2026-11-27')!;
    expect(summary2.billedDueTotal).toBe(0);
    expect(summary2.currentBilledStatement).toBeNull(); // No unpaid billed statement remaining
    expect(summary2.totalOutstanding).toBe(20000); // Only unbilled spends remain
    expect(summary2.availableCredit).toBe(80000);
  });
});
