import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type { FinanceTransaction } from '@/lib/types';
import type { CsvColumnIndices } from './csv-line-parser';

export interface ParsedCsvRow {
  rawTitle: string;
  parsedAmount: number;
  dateStr: string;
  txType: FinanceTransaction['type'];
  csvCat?: string;
}

function parseCsvDate(raw: string | undefined, fallbackToday: string): string {
  if (!raw) return fallbackToday;
  const candidate = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(candidate)) return candidate.slice(0, 10);
  const d = new Date(candidate);
  return isNaN(d.getTime()) ? fallbackToday : getLocalIsoDate(d);
}

function resolveCsvTxType(rawType: string): FinanceTransaction['type'] {
  const lower = rawType.toLowerCase();
  if (lower.includes('inc') || lower.includes('cr')) return 'income';
  if (lower.includes('inv') || lower.includes('sip')) return 'investment';
  return 'expense';
}

function colAt(cols: string[], idx: number, fallbackIdx: number): string {
  return idx >= 0 ? cols[idx] || '' : cols[fallbackIdx] || '';
}

function parseRowAmount(cols: string[], amountIdx: number): number | null {
  const raw = colAt(cols, amountIdx, 2).replace(/[^0-9.-]/g, '');
  const parsed = Math.abs(parseFloat(raw));
  return parsed && !isNaN(parsed) ? parsed : null;
}

function optionalCol(cols: string[], idx: number): string | undefined {
  return idx >= 0 ? cols[idx] : undefined;
}

export function extractCsvRowPayload(
  cols: string[],
  indices: CsvColumnIndices,
  todayStr: string
): ParsedCsvRow | null {
  if (cols.length < 2) return null;
  const parsedAmount = parseRowAmount(cols, indices.amountIdx);
  if (parsedAmount === null) return null;

  return {
    rawTitle: colAt(cols, indices.titleIdx, 1) || 'Imported Entry',
    parsedAmount,
    dateStr: parseCsvDate(optionalCol(cols, indices.dateIdx), todayStr),
    txType: resolveCsvTxType(optionalCol(cols, indices.typeIdx) || ''),
    csvCat: optionalCol(cols, indices.catIdx),
  };
}
