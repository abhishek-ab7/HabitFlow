import { db } from '@/lib/db';
import type {
  CreditCardStatement,
  FinanceAccount,
  FinanceCategorizationRule,
  FinanceCategory,
  FinanceNetWorthSnapshot,
  FinanceRecurringBill,
  FinanceSipPlan,
} from '@/lib/types';

const SAMPLE_NAME_MAP: Record<string, string> = {
  'GPay / HDFC UPI': 'UPI',
  'HDFC Salary Account': 'Bank Account',
  'Cash in Wallet': 'Cash',
  'ICICI Amazon Pay Card': 'Credit Card',
};

const LEGACY_SAMPLE_TITLES = [
  'Lakme Matte Lipstick for Mother',
  'Home Electricity Bill (Paid for Mother)',
  'Optimum Nutrition Gold Standard Whey Protein (2lb)',
  'Monthly Salary Credit',
];

async function deleteUserFinanceRecords(userId: string, includeOptional: boolean): Promise<void> {
  const coreDeletes = [
    db.financeTransactions.where('userId').equals(userId).delete(),
    db.financeBudgets.where('userId').equals(userId).delete(),
    db.monthlyCommitments.where('userId').equals(userId).delete(),
    db.debtRecords.where('userId').equals(userId).delete(),
    db.debtInstallments.where('userId').equals(userId).delete(),
    db.emiTrackers.where('userId').equals(userId).delete(),
  ];

  if (!includeOptional) {
    await Promise.all(coreDeletes);
    return;
  }

  const optionalTables = [
    db.financeSipPlans,
    db.financeCategorizationRules,
    db.financeRecurringBills,
    db.financeNetWorthSnapshots,
    db.creditCardStatements,
  ];
  await Promise.all([
    ...coreDeletes,
    ...optionalTables.map((t) => (t ? t.where('userId').equals(userId).delete() : Promise.resolve())),
  ]);
}

interface ResetContext {
  userId: string;
  now: string;
  keepCategories: boolean;
  markDirty: boolean;
}

async function resetAccountsAndCategories(ctx: ResetContext): Promise<void> {
  const { userId, now, keepCategories, markDirty } = ctx;
  const userAccounts = await db.financeAccounts.where('userId').equals(userId).toArray();
  for (const acc of userAccounts) {
    await db.financeAccounts.update(acc.id, {
      balance: 0,
      name: SAMPLE_NAME_MAP[acc.name] || acc.name,
      ...(markDirty ? { isDirty: true } : {}),
      updatedAt: now,
    });
  }

  if (!keepCategories) {
    await db.financeCategories.where('userId').equals(userId).delete();
    return;
  }

  const cats = await db.financeCategories.where('userId').equals(userId).toArray();
  for (const cat of cats) {
    await db.financeCategories.update(cat.id, {
      monthlyBudgetLimit: 0,
      ...(markDirty ? { isDirty: true } : {}),
      updatedAt: now,
    });
  }
}

export async function resetAllFinanceDataImpl(
  userId: string,
  keepCategories = true
): Promise<void> {
  const now = new Date().toISOString();
  await deleteUserFinanceRecords(userId, true);
  await resetAccountsAndCategories({ userId, now, keepCategories, markDirty: true });
}

async function detectLegacySampleData(userId: string): Promise<boolean> {
  const existingCats = await db.financeCategories.where('userId').equals(userId).count();
  if (existingCats === 0) return false;

  const sampleAccs = await db.financeAccounts.where('userId').equals(userId).toArray();
  const hasLegacyAcc = sampleAccs.some((a) =>
    ['GPay / HDFC UPI', 'HDFC Salary Account', 'ICICI Amazon Pay Card'].includes(a.name)
  );
  if (hasLegacyAcc) return true;

  const legacyTxCount = await db.financeTransactions
    .where('userId')
    .equals(userId)
    .filter((t) => LEGACY_SAMPLE_TITLES.includes(t.title))
    .count();
  return legacyTxCount > 0;
}

export async function runFreshStartMigrationIfNeeded(userId: string): Promise<void> {
  if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') return;
  const migrationKey = `flowfinance_fresh_start_v2_${userId}`;
  if (window.localStorage.getItem(migrationKey)) return;

  if (await detectLegacySampleData(userId)) {
    await deleteUserFinanceRecords(userId, false);
    await resetAccountsAndCategories({
      userId,
      now: new Date().toISOString(),
      keepCategories: true,
      markDirty: false,
    });
  }
  window.localStorage.setItem(migrationKey, '1');
}

function deduplicateByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function queryOptionalTable<T>(params: {
  table: any;
  userId: string;
  sortByKey?: string;
}): Promise<T[]> {
  if (!params.table) return [];
  const q = params.table
    .where('userId')
    .equals(params.userId)
    .filter((r: { deletedAt?: string | null }) => !r.deletedAt);
  return params.sortByKey && q.sortBy ? q.sortBy(params.sortByKey) : q.toArray();
}

export async function loadAllFinanceTables(userId: string) {
  const [
    categories,
    accounts,
    transactions,
    budgets,
    commitments,
    debtRecords,
    debtInstallments,
    emiTrackers,
    sipPlans,
    categorizationRules,
    recurringBills,
    netWorthSnapshots,
    creditCardStatements,
  ] = await Promise.all([
    db.financeCategories.where('userId').equals(userId).filter((c) => !c.archived && !c.deletedAt).sortBy('order'),
    db.financeAccounts.where('userId').equals(userId).filter((a) => !a.archived && !a.deletedAt).toArray(),
    db.financeTransactions.where('userId').equals(userId).filter((t) => !t.deletedAt).reverse().sortBy('date'),
    db.financeBudgets.where('userId').equals(userId).filter((b) => !b.deletedAt).toArray(),
    db.monthlyCommitments.where('userId').equals(userId).filter((c) => !c.deletedAt).toArray(),
    db.debtRecords.where('userId').equals(userId).filter((d) => !d.deletedAt).toArray(),
    db.debtInstallments.where('userId').equals(userId).filter((i) => !i.deletedAt).reverse().sortBy('date'),
    db.emiTrackers.where('userId').equals(userId).filter((e) => !e.deletedAt).toArray(),
    queryOptionalTable<FinanceSipPlan>({ table: db.financeSipPlans, userId }),
    queryOptionalTable<FinanceCategorizationRule>({ table: db.financeCategorizationRules, userId }),
    queryOptionalTable<FinanceRecurringBill>({ table: db.financeRecurringBills, userId }),
    queryOptionalTable<FinanceNetWorthSnapshot>({
      table: db.financeNetWorthSnapshots,
      userId,
      sortByKey: 'monthKey',
    }),
    queryOptionalTable<CreditCardStatement>({ table: db.creditCardStatements, userId }),
  ]);

  return {
    categories: deduplicateByKey<FinanceCategory>(categories, (c) => c.slug || c.id),
    accounts: deduplicateByKey<FinanceAccount>(
      accounts,
      (a) => `${a.name.trim().toLowerCase()}_${a.type}`
    ),
    transactions: transactions.map((tx) => ({
      ...tx,
      tags: Array.isArray(tx.tags) ? tx.tags : [],
    })),
    budgets,
    commitments,
    debtRecords,
    debtInstallments,
    emiTrackers,
    sipPlans,
    categorizationRules,
    recurringBills,
    netWorthSnapshots,
    creditCardStatements,
  };
}
