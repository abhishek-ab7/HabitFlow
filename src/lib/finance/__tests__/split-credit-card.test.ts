import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { useFinanceStore, getCurrentMonthKey } from '@/lib/stores/finance-store';
import {
  repairLegacySplitTransactions,
  parseSplitNote,
  resetSplitRepairMigration,
} from '../split-repair-migration';
import { computeCreditCardSummary } from '../credit-card-cycles';
import type { FinanceAccount, FinanceCategory } from '@/lib/types';

// Mock mediator to avoid gamification side-effects
vi.mock('@/lib/stores/mediator', () => ({
  CrossDomainActionMediator: {
    onFinanceEvent: vi.fn().mockResolvedValue(undefined),
    evaluateNoSpendDayRules: vi.fn().mockResolvedValue(undefined),
    dispatch: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Split Credit Card Spends & Statement Reconciliation', () => {
  const testUserId = 'local-demo-user';
  const currentMonth = getCurrentMonthKey();
  const txDate = `${currentMonth}-10`;

  let sliceCard: FinanceAccount;
  let foodCategory: FinanceCategory;
  let debtCategory: FinanceCategory;

  beforeEach(async () => {
    await db.financeCategories.clear();
    await db.financeAccounts.clear();
    await db.financeTransactions.clear();
    await db.financeBudgets.clear();
    await db.monthlyCommitments.clear();
    await db.debtRecords.clear();
    await db.debtInstallments.clear();
    await db.emiTrackers.clear();
    await db.creditCardStatements.clear();
    resetSplitRepairMigration();

    const store = useFinanceStore.getState();
    await store.loadFinanceData(testUserId);

    // Create Slice Credit Card
    sliceCard = await store.addAccount({
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

    const refreshedStore = useFinanceStore.getState();
    foodCategory = refreshedStore.categories.find((c) => c.slug === 'food-dining')!;
    debtCategory = refreshedStore.categories.find((c) => c.slug === 'emis-debt-repayment')!;

    // Set a monthly budget limit on Food & Dining
    await store.updateCategory(foodCategory.id, { monthlyBudgetLimit: 5000 });
  });

  test('1. Splitting an expense of ₹100 (50/50) on a credit card generates two transactions totaling ₹100 on the card', async () => {
    const store = useFinanceStore.getState();

    const result = await store.splitTransactionWithFriend({
      txData: {
        title: 'Dinner with Rahul',
        amount: 100,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Rahul',
      friendShareAmount: 50,
    });

    const state = useFinanceStore.getState();
    const cardTxs = state.transactions.filter((t) => t.accountId === sliceCard.id);

    // Two transactions created on the card
    expect(cardTxs.length).toBe(2);

    // Shared splitGroupId
    expect(cardTxs[0].splitGroupId).toBeDefined();
    expect(cardTxs[0].splitGroupId).toBe(cardTxs[1].splitGroupId);

    // Leg 1: User's personal share
    const userLeg = cardTxs.find((t) => t.categoryId === foodCategory.id);
    expect(userLeg).toBeDefined();
    expect(userLeg!.amount).toBe(50);
    expect(userLeg!.tags).toContain('split');
    expect(userLeg!.tags).toContain('rahul');

    // Leg 2: Friend's share
    const friendLeg = cardTxs.find((t) => t.categoryId === debtCategory.id);
    expect(friendLeg).toBeDefined();
    expect(friendLeg!.amount).toBe(50);
    expect(friendLeg!.subcategory).toBe('Friend Split');
    expect(friendLeg!.tags).toContain('friend-share');

    // Card balance is -100 (liability of 100)
    const updatedCard = state.accounts.find((a) => a.id === sliceCard.id)!;
    expect(updatedCard.balance).toBe(-100);

    // Returned primary transaction is user's leg
    expect(result.transaction.amount).toBe(50);
    expect(result.transaction.categoryId).toBe(foodCategory.id);
  });

  test('2. Credit card unbilledSpend and cycle summary reflect full swipe (User ₹373 + Friend ₹54 = ₹427)', async () => {
    const store = useFinanceStore.getState();

    // User's exact live scenario: Spent ₹427 on Slice CC, split ₹54 with Rahul
    await store.splitTransactionWithFriend({
      txData: {
        title: 'Team Lunch at Social',
        amount: 427,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Rahul',
      friendShareAmount: 54,
    });

    const state = useFinanceStore.getState();
    const summary = state.getCreditCardSummary(sliceCard.id, txDate);

    expect(summary).not.toBeNull();
    // Credit card unbilled spend MUST equal full ₹427 swipe, not ₹373!
    expect(summary!.unbilledSpend).toBe(427);

    // Total spends on the card
    const cardTxs = state.transactions.filter((t) => t.accountId === sliceCard.id);
    const totalSwipe = cardTxs.reduce((sum, t) => sum + t.amount, 0);
    expect(totalSwipe).toBe(427);
  });

  test('3. The user category budget is debited only for the user share (₹373)', async () => {
    const store = useFinanceStore.getState();

    await store.splitTransactionWithFriend({
      txData: {
        title: 'Food Swiped on Card',
        amount: 427,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Rahul',
      friendShareAmount: 54,
    });

    const state = useFinanceStore.getState();

    // Food & Dining category should only reflect the user's ₹373 share
    const foodSpent = state.transactions
      .filter((t) => t.type === 'expense' && t.categoryId === foodCategory.id && t.monthKey === currentMonth)
      .reduce((sum, t) => sum + t.amount, 0);

    expect(foodSpent).toBe(373);

    // EMIs & Debt reflects the friend's ₹54 share
    const debtSpent = state.transactions
      .filter((t) => t.type === 'expense' && t.categoryId === debtCategory.id && t.monthKey === currentMonth)
      .reduce((sum, t) => sum + t.amount, 0);

    expect(debtSpent).toBe(54);
  });

  test('4. The lent debt record shows the friend owes ₹54', async () => {
    const store = useFinanceStore.getState();

    const { debt } = await store.splitTransactionWithFriend({
      txData: {
        title: 'Cafe bill',
        amount: 427,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Rahul',
      friendShareAmount: 54,
    });

    expect(debt).toBeDefined();
    expect(debt.personName).toBe('Rahul');
    expect(debt.direction).toBe('lent');
    expect(debt.remainingAmount).toBe(54);
    expect(debt.principalAmount).toBe(54);
    expect(debt.bucketType).toBe('everyday_split');
    expect(debt.status).toBe('active');
  });

  test('5. Boundary case: user pays 100% for friend (myShare === 0) creates only the friend transaction', async () => {
    const store = useFinanceStore.getState();

    const result = await store.splitTransactionWithFriend({
      txData: {
        title: "Friend's Birthday Present",
        amount: 500,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Ananya',
      friendShareAmount: 500,
    });

    const state = useFinanceStore.getState();
    const cardTxs = state.transactions.filter((t) => t.accountId === sliceCard.id);

    // Only 1 transaction created (Friend's Share: 500)
    expect(cardTxs.length).toBe(1);
    expect(cardTxs[0].amount).toBe(500);
    expect(cardTxs[0].categoryId).toBe(debtCategory.id);
    expect(cardTxs[0].subcategory).toBe('Friend Split');

    // No ₹0 phantom entry was created for Food
    const zeroTxs = cardTxs.filter((t) => t.amount === 0);
    expect(zeroTxs.length).toBe(0);

    // Returned transaction is the friend leg
    expect(result.transaction.amount).toBe(500);

    // Card unbilled spend is ₹500
    const summary = state.getCreditCardSummary(sliceCard.id, txDate);
    expect(summary!.unbilledSpend).toBe(500);
  });

  test('6. Boundary case: friend portion is 0 (friendPortion === 0) creates only the user transaction', async () => {
    const store = useFinanceStore.getState();

    const result = await store.splitTransactionWithFriend({
      txData: {
        title: 'Solo Coffee',
        amount: 150,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Rahul',
      friendShareAmount: 0,
    });

    const state = useFinanceStore.getState();
    const cardTxs = state.transactions.filter((t) => t.accountId === sliceCard.id);

    // Only 1 transaction created (User's Share: 150)
    expect(cardTxs.length).toBe(1);
    expect(cardTxs[0].amount).toBe(150);
    expect(cardTxs[0].categoryId).toBe(foodCategory.id);

    // Returned transaction is user leg
    expect(result.transaction.amount).toBe(150);

    const summary = state.getCreditCardSummary(sliceCard.id, txDate);
    expect(summary!.unbilledSpend).toBe(150);
  });

  test('7. Splitting when user owes friend (direction === borrowed) records installment on swipe account', async () => {
    const store = useFinanceStore.getState();

    // Setup: User owes Vikram ₹200
    const borrowedDebt = await store.addDebtRecord({
      personName: 'Vikram',
      direction: 'borrowed',
      title: 'Borrowed for Groceries',
      principalAmount: 200,
      startDate: txDate,
      repaymentSchedule: 'flexible',
      bucketType: 'everyday_split',
      color: '#ef4444',
    });

    expect(borrowedDebt.remainingAmount).toBe(200);

    // User swipes ₹100 on Slice Card, splitting ₹50 with Vikram
    await store.splitTransactionWithFriend({
      txData: {
        title: 'Dinner Swipe',
        amount: 100,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Vikram',
      friendShareAmount: 50,
      existingDebtId: borrowedDebt.id,
    });

    const state = useFinanceStore.getState();

    // Debt remaining should decrease from 200 to 150
    const updatedDebt = state.debtRecords.find((d) => d.id === borrowedDebt.id)!;
    expect(updatedDebt.remainingAmount).toBe(150);
    expect(updatedDebt.totalRepaidAmount).toBe(50);

    // Two transactions on the card totaling 100
    const cardTxs = state.transactions.filter((t) => t.accountId === sliceCard.id);
    expect(cardTxs.length).toBe(2);

    const totalSwipe = cardTxs.reduce((sum, t) => sum + t.amount, 0);
    expect(totalSwipe).toBe(100);

    // Card balance is -100
    const card = state.accounts.find((a) => a.id === sliceCard.id)!;
    expect(card.balance).toBe(-100);

    // Credit card unbilled spend is ₹100
    const summary = state.getCreditCardSummary(sliceCard.id, txDate);
    expect(summary!.unbilledSpend).toBe(100);
  });

  test('8. Note parser correctly extracts friend name and amount from legacy formats', () => {
    expect(parseSplitNote('Split with Rahul (Your share: ₹373, Rahul owes: ₹54)')).toEqual({
      friendName: 'Rahul',
      amount: 54,
    });

    expect(parseSplitNote('Dinner at Social · Split with Amit (Your share: ₹400, Amit owes: ₹400)')).toEqual({
      friendName: 'Amit',
      amount: 400,
    });

    expect(parseSplitNote('Split with Bob (Bob owes: ₹1,250.50)')).toEqual({
      friendName: 'Bob',
      amount: 1250.5,
    });

    expect(parseSplitNote('Split with Alice (owes: ₹50)')).toEqual({
      friendName: 'Alice',
      amount: 50,
    });

    expect(parseSplitNote('Rahul owes: ₹54')).toEqual({
      friendName: 'Rahul',
      amount: 54,
    });

    expect(parseSplitNote('Regular transaction note without split')).toBeNull();
  });

  test('9. Retroactive repair migration fixes legacy single-legged split without double-mutating balance', async () => {
    const splitGroupId = crypto.randomUUID();
    const now = new Date().toISOString();
    const activeUserId = useFinanceStore.getState().currentUserId || testUserId;

    // Simulate legacy state:
    // User swiped ₹427 on Slice card, split ₹54 with Rahul.
    // Legacy code only inserted userTx (₹373) and mutated card balance by -427.
    await db.financeAccounts.update(sliceCard.id, {
      balance: -427,
      updatedAt: now,
    });

    await db.financeTransactions.add({
      id: crypto.randomUUID(),
      userId: activeUserId,
      title: 'Dinner at Social',
      amount: 373,
      type: 'expense',
      categoryId: foodCategory.id,
      accountId: sliceCard.id,
      date: txDate,
      monthKey: txDate.slice(0, 7),
      notes: 'Split with Rahul (Your share: ₹373, Rahul owes: ₹54)',
      tags: ['split', 'rahul'],
      splitGroupId,
      isRecurring: false,
      createdAt: now,
      updatedAt: now,
    });

    // Before repair: check that computeCreditCardSummary only sees ₹373
    const cardBefore = await db.financeAccounts.get(sliceCard.id);
    const txsBefore = await db.financeTransactions.where('userId').equals(activeUserId).toArray();
    const summaryBefore = computeCreditCardSummary({
      account: cardBefore!,
      transactions: txsBefore,
      referenceDate: txDate,
    });
    expect(summaryBefore.unbilledSpend).toBe(373); // The exact bug!

    // Run repair migration
    const repairResult = await repairLegacySplitTransactions(activeUserId);
    expect(repairResult.repairedCount).toBe(1);
    expect(repairResult.affectedCardIds).toContain(sliceCard.id);

    // Verify Dexie state:
    // 1. Missing transaction was inserted with splitGroupId
    const txsAfter = await db.financeTransactions.where('userId').equals(activeUserId).toArray();
    expect(txsAfter.length).toBe(2);

    const repairedLeg = txsAfter.find((t) => t.amount === 54);
    expect(repairedLeg).toBeDefined();
    expect(repairedLeg!.splitGroupId).toBe(splitGroupId);
    expect(repairedLeg!.categoryId).toBe(debtCategory.id);
    expect(repairedLeg!.subcategory).toBe('Friend Split');
    expect(repairedLeg!.accountId).toBe(sliceCard.id);

    // 2. Account balance is NOT double-mutated! It remains -427
    const cardAfter = await db.financeAccounts.get(sliceCard.id);
    expect(cardAfter!.balance).toBe(-427);

    // 3. Credit card unbilled spend now reflects full ₹427!
    const summaryAfter = computeCreditCardSummary({
      account: cardAfter!,
      transactions: txsAfter,
      referenceDate: txDate,
    });
    expect(summaryAfter.unbilledSpend).toBe(427); // Fixed!

    // 4. Test idempotence: Running again repairs 0 records
    const secondRun = await repairLegacySplitTransactions(activeUserId);
    expect(secondRun.repairedCount).toBe(0);
    expect(secondRun.affectedCardIds).toEqual([]);

    const txsFinal = await db.financeTransactions.where('userId').equals(activeUserId).toArray();
    expect(txsFinal.length).toBe(2);
  });

  test('10. loadFinanceData automatically repairs legacy split on initial load and syncs credit card unbilled spends to 427', async () => {
    const splitGroupId = crypto.randomUUID();
    const now = new Date().toISOString();
    const activeUserId = useFinanceStore.getState().currentUserId || testUserId;

    // Reset migration tracker to simulate fresh app startup
    resetSplitRepairMigration();

    // Setup legacy single-legged transaction in Dexie directly
    await db.financeAccounts.update(sliceCard.id, {
      balance: -427,
      updatedAt: now,
    });

    await db.financeTransactions.add({
      id: crypto.randomUUID(),
      userId: activeUserId,
      title: 'Dinner at Social',
      amount: 373,
      type: 'expense',
      categoryId: foodCategory.id,
      accountId: sliceCard.id,
      date: txDate,
      monthKey: txDate.slice(0, 7),
      notes: 'Split with Rahul (Your share: ₹373, Rahul owes: ₹54)',
      tags: ['split', 'rahul'],
      splitGroupId,
      isRecurring: false,
      createdAt: now,
      updatedAt: now,
    });

    // Fresh startup: call loadFinanceData
    await useFinanceStore.getState().loadFinanceData(activeUserId);

    const state = useFinanceStore.getState();
    const cardTxs = state.transactions.filter((t) => t.accountId === sliceCard.id);

    // Both legs are loaded into state
    expect(cardTxs.length).toBe(2);

    const userLeg = cardTxs.find((t) => t.amount === 373);
    const friendLeg = cardTxs.find((t) => t.amount === 54);
    expect(userLeg).toBeDefined();
    expect(friendLeg).toBeDefined();
    expect(friendLeg!.categoryId).toBe(debtCategory.id);
    expect(friendLeg!.subcategory).toBe('Friend Split');

    // Credit card unbilled spend is immediately ₹427!
    const summary = state.getCreditCardSummary(sliceCard.id, txDate);
    expect(summary).not.toBeNull();
    expect(summary!.unbilledSpend).toBe(427);
  });

  test('11. Deleting one leg of a 2-legged split group does not get resurrected by repairLegacySplitTransactions', async () => {
    const store = useFinanceStore.getState();
    const activeUserId = store.currentUserId || testUserId;

    // Create 2-legged split
    await store.splitTransactionWithFriend({
      txData: {
        title: 'Team Dinner',
        amount: 200,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Priya',
      friendShareAmount: 100,
    });

    const stateBeforeDelete = useFinanceStore.getState();
    const cardTxsBefore = stateBeforeDelete.transactions.filter((t) => t.accountId === sliceCard.id);
    expect(cardTxsBefore.length).toBe(2);

    const friendLeg = cardTxsBefore.find((t) => t.subcategory === 'Friend Split')!;
    expect(friendLeg).toBeDefined();

    // User explicitly deletes the friend leg
    await store.deleteTransaction(friendLeg.id);

    const stateAfterDelete = useFinanceStore.getState();
    const cardTxsAfter = stateAfterDelete.transactions.filter((t) => t.accountId === sliceCard.id);
    expect(cardTxsAfter.length).toBe(1);

    // Reset in-memory migration flag to simulate next startup/load
    resetSplitRepairMigration();

    // Run repair migration
    const repairResult = await repairLegacySplitTransactions(activeUserId);

    // MUST NOT resurrect the deleted friend leg!
    expect(repairResult.repairedCount).toBe(0);

    const stateAfterMigration = useFinanceStore.getState();
    const finalCardTxs = stateAfterMigration.transactions.filter((t) => t.accountId === sliceCard.id);
    expect(finalCardTxs.length).toBe(1);
  });

  test('12. Note parser handles Unicode names, dots, apostrophes, and currency symbols', () => {
    // Unicode names
    expect(parseSplitNote('Split with José (Your share: ₹100, José owes: ₹50)')).toEqual({
      friendName: 'José',
      amount: 50,
    });
    expect(parseSplitNote('José owes: ₹50')).toEqual({
      friendName: 'José',
      amount: 50,
    });

    // Titles with dots like Dr. Smith
    expect(parseSplitNote('Split with Dr. Smith (Your share: ₹100, Dr. Smith owes: ₹50)')).toEqual({
      friendName: 'Dr. Smith',
      amount: 50,
    });
    expect(parseSplitNote('Dr. Smith owes: ₹50')).toEqual({
      friendName: 'Dr. Smith',
      amount: 50,
    });

    // Names with apostrophes
    expect(parseSplitNote("Split with O'Connor (Your share: ₹100, O'Connor owes: ₹50)")).toEqual({
      friendName: "O'Connor",
      amount: 50,
    });
    expect(parseSplitNote("O'Connor owes: ₹50")).toEqual({
      friendName: "O'Connor",
      amount: 50,
    });

    // Devanagari Unicode names
    expect(parseSplitNote('Split with शर्मा (शर्मा owes: ₹100)')).toEqual({
      friendName: 'शर्मा',
      amount: 100,
    });

    // Multiline notes
    expect(
      parseSplitNote(`Split with Rahul (Your share: ₹373, Rahul owes: ₹54)\nOrdered via Zomato`)
    ).toEqual({
      friendName: 'Rahul',
      amount: 54,
    });

    // Rs. currency notation
    expect(parseSplitNote('Split with Alice (Alice owes: Rs. 150)')).toEqual({
      friendName: 'Alice',
      amount: 150,
    });
  });

  test('13. Clamps friend share exceeding total swipe and handles floating decimal division cleanly', async () => {
    const store = useFinanceStore.getState();

    // Friend share entered as 150 for a 100 swipe
    const result = await store.splitTransactionWithFriend({
      txData: {
        title: 'Overallocated split',
        amount: 100,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Rohan',
      friendShareAmount: 150,
    });

    const state = useFinanceStore.getState();
    const cardTxs = state.transactions.filter((t) => t.accountId === sliceCard.id);
    const rohanTx = cardTxs.find((t) => t.tags?.includes('rohan'));
    expect(rohanTx).toBeDefined();
    // Clamped to 100 (cannot exceed total outflow)
    expect(rohanTx!.amount).toBe(100);

    // Floating decimal split
    await store.splitTransactionWithFriend({
      txData: {
        title: 'Decimals Bill',
        amount: 100.55,
        type: 'expense',
        categoryId: foodCategory.id,
        accountId: sliceCard.id,
        date: txDate,
      },
      friendName: 'Kavita',
      friendShareAmount: 50.27,
    });

    const refreshedState = useFinanceStore.getState();
    const kavitaFriendLeg = refreshedState.transactions.find((t) => t.tags?.includes('kavita') && t.subcategory === 'Friend Split');
    const kavitaUserLeg = refreshedState.transactions.find((t) => t.tags?.includes('kavita') && t.categoryId === foodCategory.id);
    expect(kavitaFriendLeg).toBeDefined();
    expect(kavitaUserLeg).toBeDefined();
    expect(kavitaFriendLeg!.amount).toBe(50.27);
    expect(kavitaUserLeg!.amount).toBe(50.28);
    expect(Math.round((kavitaFriendLeg!.amount + kavitaUserLeg!.amount) * 100) / 100).toBe(100.55);
  });
});
