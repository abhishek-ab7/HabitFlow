import { db } from '@/lib/db';
import type {
  FinanceTransaction,
  FinanceAccount,
  FinanceCategory,
  DebtRecord,
  FriendLedgerGroup,
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

export function exportTransactionsCSV(
  transactions: FinanceTransaction[],
  accounts: FinanceAccount[],
  categories: FinanceCategory[]
): string {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const headers = [
    'ID',
    'Date',
    'Title',
    'Merchant',
    'Type',
    'Amount',
    'Category',
    'Account',
    'AccountType',
    'Notes',
  ];

  const rows = transactions
    .filter((t) => !t.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => {
      const acc = accountMap.get(t.accountId);
      return [
        sanitizeCsvCell(t.id),
        sanitizeCsvCell(t.date),
        sanitizeCsvCell(t.title),
        sanitizeCsvCell(t.merchantName || ''),
        sanitizeCsvCell(t.type),
        sanitizeCsvCell(t.amount.toFixed(2)),
        sanitizeCsvCell(categoryMap.get(t.categoryId) || 'General'),
        sanitizeCsvCell(acc?.name || ''),
        sanitizeCsvCell(acc?.type || ''),
        sanitizeCsvCell(t.notes || ''),
      ];
    });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function exportFriendsDebtCSV(debts: DebtRecord[]): string {
  const headers = [
    'ID',
    'PersonName',
    'Bucket',
    'Title',
    'Direction',
    'PrincipalAmount',
    'RemainingAmount',
    'RepaidAmount',
    'StartDate',
    'IsEmi',
    'Status',
    'Notes',
  ];

  const rows = debts
    .filter((d) => !d.deletedAt)
    .sort((a, b) => a.personName.localeCompare(b.personName) || b.startDate.localeCompare(a.startDate))
    .map((d) => [
      sanitizeCsvCell(d.id),
      sanitizeCsvCell(d.personName),
      sanitizeCsvCell(d.bucketType || 'everyday_split'),
      sanitizeCsvCell(d.title),
      sanitizeCsvCell(d.direction === 'borrowed' ? 'I Borrowed (I Owe)' : 'I Lent (They Owe)'),
      sanitizeCsvCell(d.principalAmount.toFixed(2)),
      sanitizeCsvCell(d.remainingAmount.toFixed(2)),
      sanitizeCsvCell((d.totalRepaidAmount || 0).toFixed(2)),
      sanitizeCsvCell(d.startDate),
      sanitizeCsvCell(d.isEmi ? 'Yes' : 'No'),
      sanitizeCsvCell(d.status),
      sanitizeCsvCell(d.notes || ''),
    ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function exportHabitsCSV(
  habits: Habit[],
  completions: HabitCompletion[]
): string {
  const completionCounts = new Map<string, number>();
  completions.forEach((c) => {
    if (c.completed) {
      completionCounts.set(c.habitId, (completionCounts.get(c.habitId) || 0) + 1);
    }
  });

  const headers = [
    'ID',
    'Name',
    'Category',
    'TargetDaysPerWeek',
    'FrequencyType',
    'Difficulty',
    'AutoTrackRule',
    'Archived',
    'TotalCompletions',
    'CreatedAt',
  ];

  const rows = habits.map((h) => [
    sanitizeCsvCell(h.id),
    sanitizeCsvCell(h.name),
    sanitizeCsvCell(h.category),
    sanitizeCsvCell(h.targetDaysPerWeek),
    sanitizeCsvCell(h.frequencyType || 'daily'),
    sanitizeCsvCell(h.difficulty || 'medium'),
    sanitizeCsvCell(h.autoTrackRule || 'none'),
    sanitizeCsvCell(h.archived ? 'Yes' : 'No'),
    sanitizeCsvCell(completionCounts.get(h.id) || 0),
    sanitizeCsvCell(h.createdAt),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
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
] as const;

/**
 * Creates a full JSON snapshot of all 20 Dexie IndexedDB tables.
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
export async function restoreDatabaseSnapshot(
  tables: Record<string, any[]>
): Promise<{ restoredTables: number; totalRecords: number }> {
  let totalRecords = 0;
  let restoredTables = 0;

  // Validate that tables object is valid
  if (!tables || typeof tables !== 'object') {
    throw new Error('Invalid backup data format');
  }

  // Filter to known valid tables
  const validTableNames = ALL_WORKSPACE_TABLES.filter((t) => Array.isArray(tables[t]));
  if (validTableNames.length === 0) {
    throw new Error('No recognized database tables found in backup');
  }

  await db.transaction('rw', ALL_WORKSPACE_TABLES as any, async () => {
    for (const tableName of validTableNames) {
      const records = tables[tableName];
      if (Array.isArray(records)) {
        await db.table(tableName).clear();
        if (records.length > 0) {
          await db.table(tableName).bulkAdd(records);
          totalRecords += records.length;
        }
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
