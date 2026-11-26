import type { FinanceTransaction } from '@/lib/types';

export interface SplitRow {
  id: string;
  categoryId: string;
  amountStr: string;
  note: string;
}

export interface ScannedDraftItem {
  id: string;
  selected: boolean;
  title: string;
  merchantName: string;
  amount: number;
  type: 'expense' | 'income';
  categoryId: string;
  accountId: string;
  date: string;
  notes?: string;
  tags?: string[];
  fileName?: string;
}

export interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export function readFileAsBase64(file: File): Promise<{ data: string; mimeType: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      const data = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      resolve({
        data,
        mimeType: file.type || 'image/jpeg',
        fileName: file.name,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

function isIgnorableTag(clean: string): boolean {
  if (!clean) return true;
  if (clean.startsWith('ref:')) return true;
  return clean === 'sms-import';
}

function tallyTxTags(tx: FinanceTransaction, counts: Map<string, number>) {
  if (tx.deletedAt || !tx.tags) return;
  for (const raw of tx.tags) {
    const clean = raw.trim().toLowerCase();
    if (!isIgnorableTag(clean)) counts.set(clean, (counts.get(clean) || 0) + 1);
  }
}

export function computeSuggestedTags(transactions: FinanceTransaction[]): string[] {
  const counts = new Map<string, number>();
  for (const tx of transactions) tallyTxTags(tx, counts);
  for (const d of ['work', 'reimbursable', 'travel', 'family', 'self-care']) {
    if (!counts.has(d)) counts.set(d, 0);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);
}

const AUTO_TITLE_DEFAULTS: Record<string, string> = {
  transfer: 'Account Transfer',
  income: 'Income',
  investment: 'Investment / SIP',
};

export function resolveAutoTitle(title: string, type: string, categoryName?: string): string {
  if (title.trim()) return title.trim();
  return AUTO_TITLE_DEFAULTS[type] || categoryName || 'Expense';
}
