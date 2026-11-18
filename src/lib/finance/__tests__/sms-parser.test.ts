import { describe, test, expect } from 'vitest';
import {
  parseSingleSmsOrNotification,
  parseSmsOrNotificationBatch,
} from '../sms-parser';
import { DEFAULT_FINANCE_CATEGORIES } from '@/lib/stores/finance-store';
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
} from '@/lib/types';

const now = '2026-11-18T10:00:00.000Z';

const mockCategories: FinanceCategory[] = DEFAULT_FINANCE_CATEGORIES.map((c, idx) => ({
  ...c,
  id: `cat-${idx}`,
  userId: 'u1',
  createdAt: now,
  updatedAt: now,
}));

const mockAccounts: FinanceAccount[] = [
  {
    id: 'acc-upi',
    userId: 'u1',
    name: 'UPI / GPay',
    type: 'upi',
    balance: 0,
    currency: 'INR',
    color: '#6366f1',
    icon: 'Smartphone',
    isDefault: true,
    archived: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'acc-bank',
    userId: 'u1',
    name: 'Bank Account',
    type: 'bank',
    balance: 0,
    currency: 'INR',
    color: '#10b981',
    icon: 'Landmark',
    isDefault: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'acc-cc',
    userId: 'u1',
    name: 'Credit Card',
    type: 'credit_card',
    balance: 0,
    currency: 'INR',
    color: '#f59e0b',
    icon: 'CreditCard',
    isDefault: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  },
];

describe('SMS & Notification Expense Parser', () => {
  test('parses SBI UPI debit SMS with merchant, amount, date, and ref number', () => {
    const sms =
      'Dear UPI user A/C X1234 debited by 450.00 on date 18Nov26 trf to ZOMATO Refno 632145678912. -SBI';
    const result = parseSingleSmsOrNotification(sms, mockCategories, mockAccounts);

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(450);
    expect(result!.type).toBe('expense');
    expect(result!.title.toLowerCase()).toContain('zomato');
    expect(result!.date).toBe('2026-11-18');
    expect(result!.categorySlug).toBe('food-dining');
    expect(result!.accountId).toBe('acc-upi');
    expect(result!.referenceId).toBe('632145678912');
  });

  test('parses HDFC Credit Card SMS without confusing available balance for spend amount', () => {
    const sms =
      'Rs.1,249.00 spent on HDFC Bank Card xx4821 at BLINKIT on 18-11-26. Avl bal Rs.42,310.50';
    const result = parseSingleSmsOrNotification(sms, mockCategories, mockAccounts);

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(1249);
    expect(result!.type).toBe('expense');
    expect(result!.title.toLowerCase()).toContain('blinkit');
    expect(result!.categorySlug).toBe('groceries-household');
    expect(result!.accountId).toBe('acc-cc');
    expect(result!.date).toBe('2026-11-18');
  });

  test('parses bank credit / salary SMS as income', () => {
    const sms =
      'Credited Rs 25,000.00 to A/c **4567 by NEFT from ACME TECH on 01-11-26';
    const result = parseSingleSmsOrNotification(sms, mockCategories, mockAccounts);

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(25000);
    expect(result!.type).toBe('income');
    expect(result!.accountId).toBe('acc-bank');
    expect(result!.date).toBe('2026-11-01');
  });

  test('ignores OTP and failed transaction alerts', () => {
    const otpSms = 'Your OTP is 482910 for your transaction of Rs. 999. Do not share.';
    const failedSms = 'Your UPI payment of Rs. 500 to Swiggy failed due to timeout.';

    expect(parseSingleSmsOrNotification(otpSms, mockCategories, mockAccounts)).toBeNull();
    expect(parseSingleSmsOrNotification(failedSms, mockCategories, mockAccounts)).toBeNull();
  });

  test('parses bulk multi-SMS text, JSON notification logs, and flags duplicates', () => {
    const existing: FinanceTransaction[] = [
      {
        id: 'tx-existing',
        userId: 'u1',
        title: 'Uber India',
        amount: 320,
        type: 'expense',
        categoryId: 'cat-6',
        accountId: 'acc-upi',
        date: '2026-11-18',
        monthKey: '2026-11',
        notes: 'UPI Ref: 432198765432',
        tags: ['sms-import', 'ref:432198765432'],
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const batchText = [
      'Paid ₹320 to Uber India via Google Pay on 18-11-26. UPI Ref: 432198765432',
      'Alert: INR 850.00 debited from A/c XX9012 for Electricity Bill BBPS on 17-11-2026. Info: BESCOM',
    ].join('\n\n');

    const parsed = parseSmsOrNotificationBatch(
      batchText,
      mockCategories,
      mockAccounts,
      existing
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0].isDuplicate).toBe(true);
    expect(parsed[0].selected).toBe(false);
    expect(parsed[1].amount).toBe(850);
    expect(parsed[1].categorySlug).toBe('utilities-bills');
    expect(parsed[1].isDuplicate).toBe(false);
    expect(parsed[1].selected).toBe(true);

    const jsonLog = JSON.stringify([
      {
        title: 'PhonePe',
        body: 'Paid Rs. 240 to Apollo Pharmacy via PhonePe on 18-11-26',
      },
    ]);
    const jsonParsed = parseSmsOrNotificationBatch(jsonLog, mockCategories, mockAccounts);
    expect(jsonParsed).toHaveLength(1);
    expect(jsonParsed[0].amount).toBe(240);
    expect(jsonParsed[0].categorySlug).toBe('medical-supplements');
  });
});
