import { describe, it, expect } from 'vitest';
import {
  calculateTransactionBalanceDeltas,
  calculateReversedTransactionBalanceDeltas,
} from '../sync-helpers';
import { calculateFriendLedgerGroups, calculateNetWorthSummary } from '@/lib/finance/shared-analytics';

describe('MCP Finance Mutations & Isolated Ledgers', () => {
  it('calculateTransactionBalanceDeltas correctly adjusts account balances by transaction type', () => {
    // 1. Income increases balance
    const incomeDeltas = calculateTransactionBalanceDeltas({
      amount: 50000,
      type: 'income',
      account_id: 'acc-bank-1',
    });
    expect(incomeDeltas).toEqual([{ accountId: 'acc-bank-1', delta: 50000 }]);

    // 2. Expense decreases balance
    const expenseDeltas = calculateTransactionBalanceDeltas({
      amount: 1500,
      type: 'expense',
      account_id: 'acc-bank-1',
    });
    expect(expenseDeltas).toEqual([{ accountId: 'acc-bank-1', delta: -1500 }]);

    // 3. Investment decreases source balance
    const investmentDeltas = calculateTransactionBalanceDeltas({
      amount: 5000,
      type: 'investment',
      account_id: 'acc-bank-1',
    });
    expect(investmentDeltas).toEqual([{ accountId: 'acc-bank-1', delta: -5000 }]);

    // 4. Transfer moves money from source to destination account
    const transferDeltas = calculateTransactionBalanceDeltas({
      amount: 10000,
      type: 'transfer',
      account_id: 'acc-bank-1',
      to_account_id: 'acc-upi-2',
    });
    expect(transferDeltas).toEqual([
      { accountId: 'acc-bank-1', delta: -10000 },
      { accountId: 'acc-upi-2', delta: 10000 },
    ]);
  });

  it('calculateReversedTransactionBalanceDeltas accurately inverts balances for edits and deletes', () => {
    const rev = calculateReversedTransactionBalanceDeltas({
      amount: 2500,
      type: 'expense',
      account_id: 'acc-bank-1',
    });
    // Inverted delta restores +2500 back to the account
    expect(rev).toEqual([{ accountId: 'acc-bank-1', delta: 2500 }]);
  });

  it('calculateFriendLedgerGroups strictly isolates Everyday Tab from Long-Term Loans', () => {
    const records: any[] = [
      {
        id: 'debt-1',
        personName: 'Rohan Sharma',
        direction: 'lent',
        bucketType: 'everyday_split',
        principalAmount: 500,
        remainingAmount: 500,
        status: 'active',
      },
      {
        id: 'debt-2',
        personName: 'Rohan Sharma',
        direction: 'borrowed',
        bucketType: 'long_term_loan',
        principalAmount: 20000,
        remainingAmount: 20000,
        status: 'active',
      },
    ];

    const groups = calculateFriendLedgerGroups(records);
    expect(groups).toHaveLength(1);

    const rohan = groups[0];
    expect(rohan.friendName).toBe('Rohan Sharma');

    // Everyday tab is isolated: Rohan owes user ₹500
    expect(rohan.everydayLentRemaining).toBe(500);
    expect(rohan.everydayBorrowedRemaining).toBe(0);
    expect(rohan.everydayNet).toBe(500);

    // Long term loan is isolated: User owes Rohan ₹20,000
    expect(rohan.longTermBorrowedRemaining).toBe(20000);
    expect(rohan.longTermLentRemaining).toBe(0);
    expect(rohan.longTermNetPosition).toBe(-20000);

    // They are NOT merged into a single pooled net number!
    expect(rohan.everydayNet).not.toBe(rohan.everydayNet + rohan.longTermNetPosition);
  });
});
