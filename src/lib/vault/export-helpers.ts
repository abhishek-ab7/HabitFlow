import { db } from '@/lib/db';
import type {
  FinanceTransaction,
  FinanceAccount,
  FinanceCategory,
  DebtRecord,
  Habit,
  HabitCompletion,
} from '@/lib/types';

/**
 * Prevents CSV formula injection by prepending a quote if the cell begins with =, +, -, @, or tab/return.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // If the string starts with characters that could trigger formulas in Excel/Google Sheets
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 escaping: if contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvDocument(headers: string[], rows: unknown[][]): string {
  const body = rows.map((row) => row.map(sanitizeCsvCell).join(','));
  return [headers.join(','), ...body].join('\r\n');
}

function formatTransactionCsvRow(
  t: FinanceTransaction,
  accountMap: Map<string, FinanceAccount>,
  categoryMap: Map<string, string>
): unknown[] {
  const acc = accountMap.get(t.accountId);
  return [
    t.id,
    t.date,
    t.title,
    t.merchantName ?? '',
    t.type,
    t.amount.toFixed(2),
    categoryMap.get(t.categoryId) ?? 'General',
    acc?.name ?? '',
    acc?.type ?? '',
    t.notes ?? '',
  ];
}

export function exportTransactionsCSV(
  transactions: FinanceTransaction[],
  accounts: FinanceAccount[],
  categories: FinanceCategory[]
): string {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const headers = ['ID', 'Date', 'Title', 'Merchant', 'Type', 'Amount', 'Category', 'Account', 'AccountType', 'Notes'];
  const rows = transactions
    .filter((t) => !t.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => formatTransactionCsvRow(t, accountMap, categoryMap));
  return toCsvDocument(headers, rows);
}

export function exportFriendsDebtCSV(debts: DebtRecord[]): string {
  const headers = [
    'ID', 'PersonName', 'Bucket', 'Title', 'Direction',
    'PrincipalAmount', 'RemainingAmount', 'RepaidAmount', 'StartDate', 'IsEmi', 'Status', 'Notes',
  ];
  const rows = debts
    .filter((d) => !d.deletedAt)
    .sort((a, b) => a.personName.localeCompare(b.personName) || b.startDate.localeCompare(a.startDate))
    .map((d) => [
      d.id,
      d.personName,
      d.bucketType ?? 'long_term_loan',
      d.title,
      d.direction === 'borrowed' ? 'I Borrowed (I Owe)' : 'I Lent (They Owe)',
      d.principalAmount.toFixed(2),
      d.remainingAmount.toFixed(2),
      (d.totalRepaidAmount ?? 0).toFixed(2),
      d.startDate,
      d.isEmi ? 'Yes' : 'No',
      d.status,
      d.notes ?? '',
    ]);
  return toCsvDocument(headers, rows);
}

export function exportHabitsCSV(
  habits: Habit[],
  completions: HabitCompletion[]
): string {
  const completionCounts = new Map<string, number>();
  for (const c of completions) {
    if (c.completed) completionCounts.set(c.habitId, (completionCounts.get(c.habitId) ?? 0) + 1);
  }
  const headers = [
    'ID', 'Name', 'Category', 'TargetDaysPerWeek', 'FrequencyType',
    'Difficulty', 'AutoTrackRule', 'Archived', 'TotalCompletions', 'CreatedAt',
  ];
  const rows = habits
    .filter((h) => !h.archived)
    .map((h) => [
      h.id,
      h.name,
      h.category,
      h.targetDaysPerWeek,
      h.frequencyType ?? 'daily',
      h.difficulty ?? 'medium',
      h.autoTrackRule ?? 'none',
      h.archived ? 'Yes' : 'No',
      completionCounts.get(h.id) ?? 0,
      h.createdAt,
    ]);
  return toCsvDocument(headers, rows);
}

export const ALL_WORKSPACE_TABLES = [
  'habits',
  'completions',
  'goals',
  'milestones',
  'userSettings',
  'tasks',
  'moodLogs',
  'financeCategories',
  'financeAccounts',
  'financeTransactions',
  'financeBudgets',
  'monthlyCommitments',
  'debtRecords',
  'debtInstallments',
  'emiTrackers',
  'financeSipPlans',
  'financeCategorizationRules',
  'financeRecurringBills',
  'financeNetWorthSnapshots',
  'creditCardStatements',
  'fitnessProfiles',
  'fitnessDailyLogs',
  'mealTemplates',
  'mealLogs',
  'workoutSessions',
  'supplementInventory',
  'supplementLogs',
] as const;

/**
 * Creates a full JSON snapshot of all workspace Dexie IndexedDB tables.
 */
export async function generateFullDatabaseSnapshot(): Promise<Record<string, any[]>> {
  const snapshot: Record<string, any[]> = {};
  for (const tableName of ALL_WORKSPACE_TABLES) {
    try {
      const records = await db.table(tableName).toArray();
      snapshot[tableName] = records;
    } catch {
      snapshot[tableName] = [];
    }
  }
  return snapshot;
}

/**
 * Safely restores full JSON database snapshot into Dexie.
 */
async function putBackupTableRows(tableName: string, records: unknown): Promise<number> {
  if (!Array.isArray(records) || records.length === 0) return 0;
  await db.table(tableName).bulkPut(records);
  return records.length;
}

export async function restoreDatabaseSnapshot(
  tables: Record<string, any[]>
): Promise<{ restoredTables: number; totalRecords: number }> {
  let totalRecords = 0;
  let restoredTables = 0;

  if (!tables || typeof tables !== 'object') {
    throw new Error('Invalid backup data format');
  }

  const validTableNames = ALL_WORKSPACE_TABLES.filter((t) => Array.isArray(tables[t]));
  if (validTableNames.length === 0) {
    throw new Error('No recognized database tables found in backup');
  }

  await db.transaction('rw', ALL_WORKSPACE_TABLES as any, async () => {
    for (const tableName of validTableNames) {
      const count = await putBackupTableRows(tableName, tables[tableName]);
      if (count > 0) {
        totalRecords += count;
        restoredTables++;
      }
    }
  });

  return { restoredTables, totalRecords };
}

/**
 * Triggers a client-side file download for string content.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
