import { describe, it, expect } from 'vitest';
import {
  encryptBackupData,
  decryptBackupData,
} from '../backup-crypto';
import {
  sanitizeCsvCell,
  exportTransactionsCSV,
  exportFriendsDebtCSV,
  exportHabitsCSV,
} from '../export-helpers';
import type {
  FinanceTransaction,
  FinanceAccount,
  FinanceCategory,
  DebtRecord,
} from '@/lib/types';

describe('Data Vault backup crypto', () => {
  const sampleTables = {
    habits: [
      { id: 'h1', name: 'Morning Meditation', category: 'mindfulness' },
      { id: 'h2', name: 'Workout', category: 'health' },
    ],
    financeTransactions: [
      { id: 't1', amount: 500, title: 'Dinner at Social' },
    ],
  };

  it('encrypts and decrypts database tables round-trip with correct password', async () => {
    const password = 'StrongPassword123!';
    const encrypted = await encryptBackupData(sampleTables, password);

    expect(encrypted.version).toBe(2);
    expect(encrypted.encrypted).toBe(true);
    expect(encrypted.algorithm).toBe('AES-256-GCM');
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    const decrypted = await decryptBackupData(encrypted, password);
    expect(decrypted.tables).toEqual(sampleTables);
  });

  it('honors custom payload.iterations from encrypted envelope during decryption', async () => {
    const password = 'CustomIterationsPassword1!';
    const encrypted = await encryptBackupData(sampleTables, password);
    // Simulate envelope with custom iterations
    const customEncrypted = {
      ...encrypted,
      iterations: 100000,
    };

    const decrypted = await decryptBackupData(customEncrypted, password);
    expect(decrypted.tables).toEqual(sampleTables);
  });

  it('fails decryption cleanly when given incorrect password', async () => {
    const password = 'CorrectPassword123!';
    const encrypted = await encryptBackupData(sampleTables, password);

    await expect(decryptBackupData(encrypted, 'WrongPassword')).rejects.toThrow(
      'Incorrect passphrase or corrupted backup file'
    );
  });
});

describe('CSV sanitization & exports', () => {
  describe('sanitizeCsvCell', () => {
    it('escapes dangerous spreadsheet formula characters', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe(`'=SUM(A1:A10)`);
      expect(sanitizeCsvCell('+12345')).toBe(`'+12345`);
      expect(sanitizeCsvCell('-500')).toBe(`'-500`);
      expect(sanitizeCsvCell('@admin')).toBe(`'@admin`);
    });

    it('wraps and escapes commas and double quotes correctly', () => {
      expect(sanitizeCsvCell('Coffee, Tea & Snacks')).toBe('"Coffee, Tea & Snacks"');
      expect(sanitizeCsvCell('He said "hello"')).toBe('"He said ""hello"""');
    });

    it('handles normal strings and numbers unchanged', () => {
      expect(sanitizeCsvCell('General Expense')).toBe('General Expense');
      expect(sanitizeCsvCell(250)).toBe('250');
    });
  });

  describe('exportTransactionsCSV', () => {
    it('generates valid RFC 4180 CSV with sanitized cells', () => {
      const mockTxs: FinanceTransaction[] = [
        {
          id: 'tx1',
          userId: 'u1',
          accountId: 'acc1',
          categoryId: 'cat1',
          amount: 250,
          title: '=Dangerous formula',
          type: 'expense',
          date: '2026-11-20',
          monthKey: '2026-11',
          tags: [],
          isRecurring: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      const mockAccs: FinanceAccount[] = [
        {
          id: 'acc1',
          userId: 'u1',
          name: 'HDFC Bank',
          type: 'bank',
          balance: 10000,
          currency: 'INR',
          color: '#000',
          icon: 'Wallet',
          isDefault: true,
          archived: false,
          createdAt: '',
          updatedAt: '',
        },
      ];
      const mockCats: FinanceCategory[] = [
        {
          id: 'cat1',
          userId: 'u1',
          name: 'Dining',
          slug: 'dining',
          type: 'expense',
          icon: 'Utensils',
          color: '#fff',
          monthlyBudgetLimit: 5000,
          subcategories: [],
          order: 1,
          isSystem: false,
          archived: false,
          createdAt: '',
          updatedAt: '',
        },
      ];

      const csv = exportTransactionsCSV(mockTxs, mockAccs, mockCats);
      expect(csv).toContain('ID,Date,Title,Merchant,Type,Amount,Category,Account,AccountType,Notes');
      expect(csv).toContain(`'=Dangerous formula`);
      expect(csv).toContain('250.00');
      expect(csv).toContain('HDFC Bank');
      expect(csv).toContain('Dining');
    });
  });

  describe('exportFriendsDebtCSV', () => {
    it('defaults missing bucketType to long_term_loan and excludes soft-deleted rows', () => {
      const mockDebts: DebtRecord[] = [
        {
          id: 'debt-legacy',
          userId: 'u1',
          personName: 'Rohan',
          title: 'Legacy Loan',
          direction: 'lent',
          principalAmount: 5000,
          remainingAmount: 5000,
          totalRepaidAmount: 0,
          startDate: '2026-01-01',
          repaymentSchedule: 'flexible',
          // bucketType intentionally undefined to test migration/export default
          status: 'active',
          color: '#10b981',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'debt-deleted',
          userId: 'u1',
          personName: 'Deleted Person',
          title: 'Deleted Split',
          direction: 'borrowed',
          principalAmount: 200,
          remainingAmount: 200,
          totalRepaidAmount: 0,
          startDate: '2026-02-01',
          repaymentSchedule: 'flexible',
          bucketType: 'everyday_split',
          deletedAt: '2026-02-15T00:00:00Z',
          status: 'settled',
          color: '#ef4444',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const csv = exportFriendsDebtCSV(mockDebts);
      expect(csv).toContain('ID,PersonName,Bucket,Title,Direction,PrincipalAmount,RemainingAmount,RepaidAmount,StartDate,IsEmi,Status,Notes');
      expect(csv).toContain('long_term_loan');
      expect(csv).toContain('Legacy Loan');
      expect(csv).not.toContain('Deleted Person');
    });
  });

  describe('exportHabitsCSV', () => {
    it('excludes archived habits so export matches active count', () => {
      const mockHabits = [
        {
          id: 'h-active',
          userId: 'u1',
          name: 'Active Habit',
          category: 'health' as const,
          targetDaysPerWeek: 5,
          createdAt: '2026-01-01',
          archived: false,
          order: 1,
        },
        {
          id: 'h-archived',
          userId: 'u1',
          name: 'Archived Habit',
          category: 'work' as const,
          targetDaysPerWeek: 3,
          createdAt: '2026-01-01',
          archived: true,
          order: 2,
        },
      ];

      const csv = exportHabitsCSV(mockHabits as any, []);
      expect(csv).toContain('Active Habit');
      expect(csv).not.toContain('Archived Habit');
    });
  });
});
