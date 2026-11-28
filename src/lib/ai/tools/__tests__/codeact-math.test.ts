import { describe, expect, it } from 'vitest';
import { calculateEmi, calculateSipFutureValue, evaluateFinanceMath } from '../codeact-math';

describe('codeact-math (pure TS, no eval)', () => {
  it('evaluates arithmetic expressions with precedence, parentheses, and variables', () => {
    expect(evaluateFinanceMath('(income - emis - sips) / 30', { income: 120000, emis: 15000, sips: 30000 })).toBe(2500);
    expect(evaluateFinanceMath('((18400 + 45000) / 200000) * 100')).toBe(31.7);
    expect(evaluateFinanceMath('2 ^ 3 + -4 * 2')).toBe(0);
  });

  it('rejects injection attempts, unknown variables, and division by zero', () => {
    expect(() => evaluateFinanceMath('process.exit(1)')).toThrow();
    expect(() => evaluateFinanceMath('10 / 0')).toThrow(/Division by zero/);
    expect(() => evaluateFinanceMath('foo + 1')).toThrow(/Unknown variable/);
  });

  it('computes exact EMI and SIP future value', () => {
    const emi = calculateEmi(45000, 0, 6);
    expect(emi.monthlyEmi).toBe(7500);
    expect(emi.totalInterest).toBe(0);

    const emiWithInterest = calculateEmi(100000, 12, 12);
    expect(emiWithInterest.monthlyEmi).toBeCloseTo(8884.88, 1);

    const sip = calculateSipFutureValue(10000, 12, 12);
    expect(sip.invested).toBe(120000);
    expect(sip.futureValue).toBeGreaterThan(128000);
  });
});
