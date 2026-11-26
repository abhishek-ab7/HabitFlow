import type { FinanceStore } from '../helpers';
import type { FinanceTransaction } from '@/lib/types';

function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

interface LookupMaps {
  categories: Map<string, string>;
  accounts: Map<string, string>;
  commitments: Map<string, string>;
  debts: Map<string, string>;
}

function resolveMerchant(t: FinanceTransaction): string {
  return t.merchantName || t.rawMerchant || '';
}

function resolveCommitmentName(t: FinanceTransaction, maps: LookupMaps): string {
  return t.linkedCommitmentId ? maps.commitments.get(t.linkedCommitmentId) || '' : '';
}

function resolveDebtName(t: FinanceTransaction, maps: LookupMaps): string {
  return t.linkedDebtId ? maps.debts.get(t.linkedDebtId) || '' : '';
}

function buildCsvRow(t: FinanceTransaction, maps: LookupMaps): Array<string | number> {
  const categoryName = maps.categories.get(t.categoryId) || 'Uncategorized';
  const accountName = maps.accounts.get(t.accountId) || 'Account';
  const tags = (t.tags || []).join('; ');

  return [
    escapeCsvCell(t.date),
    escapeCsvCell(t.title),
    escapeCsvCell(resolveMerchant(t)),
    escapeCsvCell(t.type),
    t.amount,
    escapeCsvCell(categoryName),
    escapeCsvCell(t.subcategory || ''),
    escapeCsvCell(accountName),
    escapeCsvCell(resolveCommitmentName(t, maps)),
    escapeCsvCell(t.commitmentContributionType || ''),
    escapeCsvCell(resolveDebtName(t, maps)),
    escapeCsvCell(tags),
    escapeCsvCell(t.notes || ''),
  ];
}

const CSV_HEADERS = [
  'Date',
  'Title',
  'Merchant',
  'Type',
  'Amount (INR)',
  'Category',
  'Subcategory',
  'Account',
  'Commitment Link',
  'Contribution Type',
  'Friend Debt Link',
  'Tags',
  'Notes',
];

export function buildTransactionsCsv(list: FinanceTransaction[], state: FinanceStore): string {
  const maps: LookupMaps = {
    categories: new Map(state.categories.map((c) => [c.id, c.name])),
    accounts: new Map(state.accounts.map((a) => [a.id, a.name])),
    commitments: new Map(state.commitments.map((c) => [c.id, c.title])),
    debts: new Map(state.debtRecords.map((d) => [d.id, d.personName])),
  };

  const rows = list.map((t) => buildCsvRow(t, maps).join(','));
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}
