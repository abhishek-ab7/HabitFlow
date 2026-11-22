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
  Habit,
  HabitCompletion,
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
});
