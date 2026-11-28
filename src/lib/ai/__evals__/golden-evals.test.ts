import { describe, expect, it } from 'vitest';
import {
  detectCategorySlug,
  detectPaymentMethodType,
  extractMerchantOrTitle,
  extractTransactionAmount,
  isLikelyOtpOrNonTransaction,
} from '@/lib/finance/sms-extractors';
import { routeCaptureDomains } from '@/lib/ai/graphs/capture-extractors';
import { validateCaptureActions } from '@/lib/ai/graphs/capture-validator';
import {
  calculateEmi,
  calculateSipFutureValue,
  evaluateFinanceMath,
} from '@/lib/ai/tools/codeact-math';
import { clearAiTelemetry, getRecentAiTelemetry, recordAiTelemetry } from '@/lib/ai/telemetry';

describe('HabitFlow AI 2.0 — 30-Case Golden Eval Suite', () => {
  // =========================================================================
  // 1. 10 Indian Bank / UPI SMS Golden Cases
  // =========================================================================
  const SMS_CASES = [
    {
      name: 'HDFC UPI Swiggy debit',
      sms: 'Rs.450.00 debited from A/c XX1234 on 28-11-26 to Swiggy via UPI Ref 432198765432. Avl Bal Rs.25,000.',
      amount: 450,
      method: 'upi',
      category: 'food-dining',
      otp: false,
    },
    {
      name: 'ICICI Credit Card Amazon spend',
      sms: 'INR 2,499.00 spent on ICICI Bank Card XX9012 at Amazon on 27-11-26. Avl Limit INR 80,000.',
      amount: 2499,
      method: 'credit_card',
      category: 'shopping-personal-care',
      otp: false,
    },
    {
      name: 'SBI UPI Blinkit groceries',
      sms: 'Dear UPI user A/C X5678 debited by Rs 685.50 on 28Nov26 trf to Blinkit Refno 9988776655.',
      amount: 685.5,
      method: 'upi',
      category: 'groceries-household',
      otp: false,
    },
    {
      name: 'Axis CC Uber ride',
      sms: 'Spent INR 310 on Axis Bank Credit Card XX4455 at Uber on 28-11-2026.',
      amount: 310,
      method: 'credit_card',
      category: 'transport-fuel',
      otp: false,
    },
    {
      name: 'Kotak NEFT Airtel broadband bill',
      sms: 'Rs 999 debited from A/c XX7788 via NEFT for Airtel Broadband on 25-11-26.',
      amount: 999,
      method: 'bank',
      category: 'utilities-bills',
      otp: false,
    },
    {
      name: 'HDFC UPI Apollo Pharmacy',
      sms: 'Rs.1,250 paid to Apollo Pharmacy via GPay UPI Ref 1122334455.',
      amount: 1250,
      method: 'upi',
      category: 'medical-supplements',
      otp: false,
    },
    {
      name: 'ICICI CC Netflix subscription',
      sms: 'INR 649 spent on ICICI Card XX1122 at Netflix on 20-11-26.',
      amount: 649,
      method: 'credit_card',
      category: 'entertainment-subscriptions',
      otp: false,
    },
    {
      name: 'UPI Dominos junk food',
      sms: 'Rs 399 debited from A/c XX3344 trf to Dominos via PhonePe UPI.',
      amount: 399,
      method: 'upi',
      category: 'junk-food',
      otp: false,
    },
    {
      name: 'Bank OTP message ignored',
      sms: '482910 is your OTP for HDFC Bank login. Do not share with anyone.',
      amount: 0,
      method: 'upi',
      category: 'shopping-personal-care',
      otp: true,
    },
    {
      name: 'Failed UPI payment ignored',
      sms: 'Your UPI payment of Rs 500 to Zomato failed. Amount not debited.',
      amount: 500,
      method: 'upi',
      category: 'food-dining',
      otp: true,
    },
  ];

  it.each(SMS_CASES)('SMS Golden [$name]', (tc) => {
    expect(isLikelyOtpOrNonTransaction(tc.sms)).toBe(tc.otp);
    if (!tc.otp) {
      expect(extractTransactionAmount(tc.sms)).toBe(tc.amount);
      expect(detectPaymentMethodType(tc.sms)).toBe(tc.method);
      expect(detectCategorySlug(tc.sms, 'expense')).toBe(tc.category);
      expect(extractMerchantOrTitle(tc.sms, 'expense').length).toBeGreaterThan(1);
    }
  });

  // =========================================================================
  // 2. 10 Universal Capture Routing & Validation Golden Cases
  // =========================================================================
  const CAPTURE_ROUTE_CASES: Array<{ name: string; text: string; expected: string[] }> = [
    { name: 'Single expense + junk food', text: 'momo 60 slice', expected: ['finance_food'] },
    { name: 'Pure meal log', text: '4 boiled eggs + oats + milk', expected: ['finance_food'] },
    { name: 'Pure workout', text: 'push workout 45m', expected: ['fitness_bio'] },
    { name: 'Pure bio check-in', text: 'slept 7.5 hours and drank 500ml water', expected: ['fitness_bio'] },
    { name: 'Pure task', text: 'remind me to call dentist tomorrow', expected: ['tasks'] },
    { name: 'Finance + Workout', text: 'paid 850 whey protein + gym push day', expected: ['finance_food', 'fitness_bio'] },
    { name: 'Finance + Task', text: 'spent 320 coffee upi and remind me to pay rent Friday', expected: ['finance_food', 'tasks'] },
    { name: 'All 3 domains', text: 'paid 500 swiggy + 8000 steps + urgent task submit tax form', expected: ['finance_food', 'fitness_bio', 'tasks'] },
    { name: 'Vague Hinglish fallback', text: 'aaj bahut acha din tha', expected: ['finance_food', 'fitness_bio', 'tasks'] },
  ];

  it.each(CAPTURE_ROUTE_CASES)('Capture Routing Golden [$name]', (tc) => {
    const domains = routeCaptureDomains(tc.text, []);
    expect(domains).toEqual(expect.arrayContaining(tc.expected));
    expect(domains).toHaveLength(tc.expected.length);
  });

  it('Capture Validator Golden [Flags ambiguous account & 24h duplicate together]', () => {
    const res = validateCaptureActions({
      actions: [
        {
          id: 'exp_1',
          kind: 'expense',
          enabled: true,
          title: 'Zomato',
          amount: 420,
          txType: 'expense',
          accountName: 'Select account',
          categorySlug: 'food-dining',
          categoryName: 'Food',
          date: '2026-11-28',
          isJunkFood: false,
        },
      ],
      context: {
        accounts: [
          { id: 'a1', name: 'Slice CC', type: 'credit_card' },
          { id: 'a2', name: 'HDFC UPI', type: 'upi' },
        ],
      },
      recentTransactions: [{ id: 't_old', title: 'Zomato', amount: 420, date: '2026-11-28' }],
    });
    expect(res.status).toBe('AWAITING_HUMAN');
    expect(res.ambiguities).toHaveLength(1);
    expect(res.duplicateWarnings).toHaveLength(1);
  });

  // =========================================================================
  // 3. 10 Finance CodeAct Math & Telemetry Golden Cases
  // =========================================================================
  const MATH_CASES: Array<{ name: string; expr: string; vars?: Record<string, number>; expected: number }> = [
    { name: 'Daily safe spend', expr: '(income - fixed) / 30', vars: { income: 120000, fixed: 60000 }, expected: 2000 },
    { name: 'CC utilization %', expr: '((bal + purchase) / limit) * 100', vars: { bal: 18400, purchase: 45000, limit: 200000 }, expected: 31.7 },
    { name: 'Split bill 2 ways', expr: '850 / 2', expected: 425 },
    { name: 'Fat-loss drag kg (3080 kcal)', expr: '3080 / 7700', expected: 0.4 },
    { name: 'Savings rate %', expr: '(saved / income) * 100', vars: { saved: 36000, income: 120000 }, expected: 30 },
    { name: 'Annualized subscription cost', expr: '499 * 12 + 199 * 12', expected: 8376 },
    { name: 'Compound growth 2 years @12%', expr: '100000 * (1.12 ^ 2)', expected: 125440 },
    { name: 'Negative cashflow delta', expr: '31800 - 45000', expected: -13200 },
  ];

  it.each(MATH_CASES)('CodeAct Math Golden [$name]', (tc) => {
    expect(evaluateFinanceMath(tc.expr, tc.vars)).toBe(tc.expected);
  });

  it('CodeAct EMI & SIP Golden [No-cost EMI + 12% SIP]', () => {
    expect(calculateEmi(45000, 0, 6).monthlyEmi).toBe(7500);
    const sip = calculateSipFutureValue(25000, 12, 12);
    expect(sip.invested).toBe(300000);
    expect(sip.estimatedGain).toBeGreaterThan(20000);
  });

  it('Telemetry Golden [Records and caps structured AI metrics]', () => {
    clearAiTelemetry();
    const ev = recordAiTelemetry({
      route: '/api/ai/universal-capture',
      modelTier: 'balanced',
      latencyMs: 180,
      source: 'gemini',
      hitlTriggered: false,
    });
    expect(ev.timestamp).toBeTruthy();
    expect(getRecentAiTelemetry(5)).toHaveLength(1);
  });
});
