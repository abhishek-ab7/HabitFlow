import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateUpiId,
  generateUpiPayUri,
  formatSettlementShareText,
  generateWhatsAppShareUrl,
  getSavedUpiId,
  setSavedUpiId,
} from '../settlement-share';
import type { FriendLedgerGroup, DebtRecord } from '@/lib/types';

describe('settlement-share utilities', () => {
  describe('validateUpiId', () => {
    it('validates common valid UPI formats', () => {
      expect(validateUpiId('alex@okhdfcbank')).toBe(true);
      expect(validateUpiId('9876543210@paytm')).toBe(true);
      expect(validateUpiId('john.doe@icici')).toBe(true);
      expect(validateUpiId('user_name-123@axisbank')).toBe(true);
    });

    it('rejects invalid UPI formats', () => {
      expect(validateUpiId('')).toBe(false);
      expect(validateUpiId('invalid')).toBe(false);
      expect(validateUpiId('@paytm')).toBe(false);
      expect(validateUpiId('user@')).toBe(false);
      expect(validateUpiId('user@bank@extra')).toBe(false);
      expect(validateUpiId('user space@bank')).toBe(false);
    });
  });

  describe('generateUpiPayUri', () => {
    it('generates compliant upi://pay URI', () => {
      const uri = generateUpiPayUri({
        upiId: 'alex@okhdfcbank',
        payeeName: 'Alex Smith',
        amount: 450.5,
        note: 'Dinner split',
      });
      expect(uri).toContain('upi://pay?');
      expect(uri).toContain('pa=alex%40okhdfcbank');
      expect(uri).toContain('pn=Alex+Smith');
      expect(uri).toContain('am=450.50');
      expect(uri).toContain('cu=INR');
      expect(uri).toContain('tn=Dinner+split');
    });

    it('returns empty string if UPI ID is invalid', () => {
      const uri = generateUpiPayUri({
        upiId: 'invalid-id',
        amount: 100,
      });
      expect(uri).toBe('');
    });
  });

  describe('formatSettlementShareText', () => {
    const mockEverydaySplit: DebtRecord = {
      id: 'd1',
      userId: 'test-user',
      personName: 'Rahul',
      direction: 'lent',
      title: 'Lunch',
      principalAmount: 300,
      remainingAmount: 300,
      totalRepaidAmount: 0,
      startDate: '2026-11-01',
      repaymentSchedule: 'flexible',
      bucketType: 'everyday_split',
      status: 'active',
      color: '#10b981',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockLoan: DebtRecord = {
      id: 'd2',
      userId: 'test-user',
      personName: 'Rahul',
      direction: 'borrowed',
      title: 'Laptop Loan',
      principalAmount: 5000,
      remainingAmount: 2000,
      totalRepaidAmount: 3000,
      startDate: '2026-10-01',
      repaymentSchedule: 'monthly_partial',
      bucketType: 'long_term_loan',
      status: 'active',
      color: '#f43f5e',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockGroup: FriendLedgerGroup = {
      friendKey: 'rahul',
      friendName: 'Rahul',
      contactInfo: '+919876543210',
      everydayRecords: [mockEverydaySplit],
      everydayBorrowedRemaining: 0,
      everydayLentRemaining: 300,
      everydayNet: 300,
      longTermLoans: [mockLoan],
      longTermBorrowedRemaining: 2000,
      longTermLentRemaining: 0,
      longTermNetPosition: -2000,
      canOffsetAgainstLoan: true,
      hasActiveEntries: true,
    };

    it('formats isolated buckets and net settle-up correctly', () => {
      const text = formatSettlementShareText(mockGroup, {
        userUpiId: 'myname@okhdfcbank',
        includeUpiLink: true,
      });

      expect(text).toContain('*HabitFlow Settlement Summary: Rahul*');
      expect(text).toContain('*1. Everyday Splits Tab*');
      expect(text).toContain('You owe me: ₹300');
      expect(text).toContain('*2. Long-Term Loans & EMIs*');
      expect(text).toContain('Laptop Loan: I owe ₹2,000');
      expect(text).toContain('*Net Settle-Up*');
      expect(text).toContain('I owe you ₹1,700 net');
    });

    it('includes UPI payment link when friend owes user net', () => {
      const owedGroup: FriendLedgerGroup = {
        ...mockGroup,
        everydayNet: 800,
        everydayLentRemaining: 800,
        longTermBorrowedRemaining: 0,
        longTermLoans: [],
        longTermNetPosition: 0,
      };

      const text = formatSettlementShareText(owedGroup, {
        userUpiId: 'alex@okhdfcbank',
        includeUpiLink: true,
      });

      expect(text).toContain('You owe ₹800 net');
      expect(text).toContain('UPI ID: alex@okhdfcbank');
      expect(text).toContain('upi://pay?pa=alex%40okhdfcbank');
    });

    it('scopes net settlement and UPI link strictly to target: everyday_only', () => {
      // In mockGroup: everydayNet = +300, longTermNetPosition = -2000.
      // Combined total is -1700 (I owe), but everyday_only target should be +300 (You owe) with UPI link for 300!
      const text = formatSettlementShareText(mockGroup, {
        userUpiId: 'myname@okhdfcbank',
        includeUpiLink: true,
        target: 'everyday_only',
      });

      expect(text).toContain('*1. Everyday Splits Tab*');
      expect(text).not.toContain('*2. Long-Term Loans & EMIs*');
      expect(text).toContain('👉 Total: You owe ₹300 net');
      expect(text).toContain('am=300.00');
    });

    it('scopes net settlement strictly to target: loans_only', () => {
      const text = formatSettlementShareText(mockGroup, {
        userUpiId: 'myname@okhdfcbank',
        includeUpiLink: true,
        target: 'loans_only',
      });

      expect(text).not.toContain('*1. Everyday Splits Tab*');
      expect(text).toContain('*2. Long-Term Loans & EMIs*');
      expect(text).toContain('👉 Total: I owe you ₹2,000 net');
      expect(text).not.toContain('upi://pay'); // User owes, no UPI request link
    });

    it('filters out already-settled loans from the formatted loan breakdown', () => {
      const settledLoan: DebtRecord = {
        ...mockLoan,
        id: 'd-settled',
        title: 'Old Bike Loan',
        remainingAmount: 0,
        status: 'settled',
      };

      const groupWithSettled: FriendLedgerGroup = {
        ...mockGroup,
        longTermLoans: [mockLoan, settledLoan],
      };

      const text = formatSettlementShareText(groupWithSettled, {
        target: 'loans_only',
      });

      expect(text).toContain('Laptop Loan: I owe ₹2,000');
      expect(text).not.toContain('Old Bike Loan');
    });
  });

  describe('generateWhatsAppShareUrl', () => {
    it('generates valid WhatsApp URL with text and phone', () => {
      const url = generateWhatsAppShareUrl('Hello Rahul', '+91 98765-43210');
      expect(url).toContain('https://wa.me/919876543210?text=Hello%20Rahul');
    });

    it('generates valid generic WhatsApp URL without phone', () => {
      const url = generateWhatsAppShareUrl('Hello Rahul');
      expect(url).toContain('https://wa.me/?text=Hello%20Rahul');
    });
  });

  describe('UPI storage helpers', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('saves and retrieves valid UPI ID', () => {
      setSavedUpiId('alex@okhdfcbank');
      expect(getSavedUpiId()).toBe('alex@okhdfcbank');
    });

    it('removes UPI ID when empty', () => {
      setSavedUpiId('alex@okhdfcbank');
      setSavedUpiId('');
      expect(getSavedUpiId()).toBe('');
    });
  });
});
