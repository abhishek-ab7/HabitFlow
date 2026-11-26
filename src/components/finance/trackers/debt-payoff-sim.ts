import type { DebtRecord, EmiTracker, FinanceAccount } from '@/lib/types';

export interface DebtPayoffItem {
  id: string;
  name: string;
  remainingBalance: number;
  monthlyPayment: number;
  apr: number;
}

function settleIfPaidOff(item: DebtPayoffItem, order: string[]) {
  if (item.remainingBalance <= 0.5) {
    item.remainingBalance = 0;
    if (!order.includes(item.name)) order.push(item.name);
  }
}

function applyMonthlyMinimums(state: DebtPayoffItem[], extraMonthly: number, order: string[]) {
  let freedPool = extraMonthly;
  let interestAccrued = 0;

  for (const d of state) {
    if (d.remainingBalance <= 0.5) {
      freedPool += d.monthlyPayment;
      continue;
    }
    const monthlyRate = d.apr > 0 ? d.apr / 100 / 12 : 0;
    const interest = d.remainingBalance * monthlyRate;
    interestAccrued += interest;
    d.remainingBalance += interest;

    const pay = Math.min(d.remainingBalance, Math.max(d.monthlyPayment, 500));
    d.remainingBalance -= pay;
    settleIfPaidOff(d, order);
  }
  return { freedPool, interestAccrued };
}

function applySnowballPool(active: DebtPayoffItem[], initialPool: number, order: string[]) {
  let freedPool = initialPool;
  for (const target of active) {
    if (freedPool <= 0) break;
    if (target.remainingBalance <= 0.5) continue;
    const extraPay = Math.min(target.remainingBalance, freedPool);
    target.remainingBalance -= extraPay;
    freedPool -= extraPay;
    settleIfPaidOff(target, order);
  }
}

export function simulatePayoff(items: DebtPayoffItem[], extraMonthly: number, strategy: 'avalanche' | 'snowball') {
  if (items.length === 0) return { months: 0, totalInterest: 0, order: [] as string[] };
  const state = items.map((i) => ({ ...i }));
  let months = 0;
  let totalInterest = 0;
  const order: string[] = [];

  while (months < 360 && state.some((s) => s.remainingBalance > 0.5)) {
    months += 1;
    const active = state
      .filter((s) => s.remainingBalance > 0.5)
      .sort((a, b) =>
        strategy === 'avalanche'
          ? b.apr - a.apr || a.remainingBalance - b.remainingBalance
          : a.remainingBalance - b.remainingBalance || b.apr - a.apr
      );
    const { freedPool, interestAccrued } = applyMonthlyMinimums(state, extraMonthly, order);
    totalInterest += interestAccrued;
    applySnowballPool(active, freedPool, order);
  }
  return { months, totalInterest: Math.round(totalInterest), order };
}

function mapEmisToPayoffItems(activeEmis: EmiTracker[]): DebtPayoffItem[] {
  const list: DebtPayoffItem[] = [];
  for (const emi of activeEmis) {
    if (emi.status !== 'active') continue;
    const remMonths = Math.max(0, emi.tenureMonths - emi.paidMonths);
    if (remMonths <= 0) continue;
    const approxBal =
      emi.tenureMonths > 0 ? Math.round((remMonths / emi.tenureMonths) * emi.principalAmount) : emi.emiAmount * remMonths;
    if (approxBal > 0) {
      list.push({ id: `emi-${emi.id}`, name: emi.loanName, remainingBalance: approxBal, monthlyPayment: emi.emiAmount, apr: emi.interestRateAnnual || 12 });
    }
  }
  return list;
}

function mapCardsToPayoffItems(accounts: FinanceAccount[]): DebtPayoffItem[] {
  const list: DebtPayoffItem[] = [];
  for (const acc of accounts) {
    if (acc.type !== 'credit_card') continue;
    if (acc.archived || acc.deletedAt) continue;
    const bal = Math.abs(acc.balance);
    if (bal > 0) {
      list.push({ id: `cc-${acc.id}`, name: acc.name, remainingBalance: bal, monthlyPayment: Math.max(1500, Math.round(bal * 0.1)), apr: 36 });
    }
  }
  return list;
}

function mapDebtsToPayoffItems(debtRecords: DebtRecord[]): DebtPayoffItem[] {
  return debtRecords
    .filter((d) => d.direction === 'borrowed' && d.status === 'active' && !d.deletedAt && d.remainingAmount > 0)
    .map((debt) => ({
      id: `debt-${debt.id}`,
      name: `${debt.personName} (${debt.title})`,
      remainingBalance: debt.remainingAmount,
      monthlyPayment: debt.plannedMonthlyInstallment ?? Math.max(1000, Math.round(debt.remainingAmount * 0.15)),
      apr: 0,
    }));
}

export function buildDebtPayoffItems(
  activeEmis: EmiTracker[],
  accounts: FinanceAccount[],
  debtRecords: DebtRecord[]
): DebtPayoffItem[] {
  return [...mapEmisToPayoffItems(activeEmis), ...mapCardsToPayoffItems(accounts), ...mapDebtsToPayoffItems(debtRecords)];
}

export function runPayoffSimulation(payoffItems: DebtPayoffItem[], extraPayment: number, strategy: 'avalanche' | 'snowball') {
  const baseline = simulatePayoff(payoffItems, 0, strategy);
  const accelerated = simulatePayoff(payoffItems, extraPayment, strategy);
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + accelerated.months);
  const debtFreeLabel = accelerated.months > 0 ? targetDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Debt Free';

  return {
    totalDebt: payoffItems.reduce((s, i) => s + i.remainingBalance, 0),
    baseline,
    accelerated,
    monthsSaved: Math.max(0, baseline.months - accelerated.months),
    interestSaved: Math.max(0, baseline.totalInterest - accelerated.totalInterest),
    debtFreeLabel,
  };
}
