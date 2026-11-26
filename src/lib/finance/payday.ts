import type { FinanceBudget } from '@/lib/types';

const PAYDAY_NOTE_TAG_REGEX = /\s*\[payday:(\d{1,2})\]/i;

/**
 * Normalizes a candidate payday day-of-month to an integer in `1..31`.
 * Returns `undefined` when absent or invalid.
 */
export function normalizePaydayOfMonth(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  const num = Number(val);
  if (!Number.isFinite(num)) return undefined;
  const rounded = Math.trunc(num);
  return rounded >= 1 && rounded <= 31 ? rounded : undefined;
}

/**
 * Parses an internal `[payday:N]` note fallback tag used when the remote DB
 * schema has not yet applied `payday_of_month`.
 */
export function parsePaydayFromNotes(notes?: string | null): number | undefined {
  if (!notes) return undefined;
  const match = notes.match(PAYDAY_NOTE_TAG_REGEX);
  if (!match) return undefined;
  return normalizePaydayOfMonth(parseInt(match[1], 10));
}

/**
 * Removes any internal `[payday:N]` tag from user-facing notes.
 */
export function stripPaydayNoteTag(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const cleaned = notes.replace(PAYDAY_NOTE_TAG_REGEX, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Stores `[payday:N]` cleanly inside a notes string while preserving user notes.
 */
export function upsertPaydayNoteTag(
  notes: string | null | undefined,
  payday: number
): string {
  const normalized = normalizePaydayOfMonth(payday) ?? 1;
  const base = stripPaydayNoteTag(notes);
  return base ? `${base} [payday:${normalized}]` : `[payday:${normalized}]`;
}

/**
 * Resolves the user's configured salary payday (`1..31`) in priority order:
 * 1. Explicit override passed directly to the forecast engine
 * 2. Current month's active budget (`paydayOfMonth` or `[payday:N]` note tag)
 * 3. Most recent non-deleted budget with a configured payday
 */
function extractBudgetPayday(budget?: FinanceBudget): number | undefined {
  if (!budget) return undefined;
  return normalizePaydayOfMonth(budget.paydayOfMonth) ?? parsePaydayFromNotes(budget.notes);
}

export function resolveEffectivePaydayOfMonth(
  budgets: FinanceBudget[],
  monthKey?: string,
  explicitPayday?: number
): number | undefined {
  const direct = normalizePaydayOfMonth(explicitPayday);
  if (direct !== undefined) return direct;

  const activeBudgets = budgets.filter((b) => !b.deletedAt);
  const currentVal = monthKey ? extractBudgetPayday(activeBudgets.find((b) => b.monthKey === monthKey)) : undefined;
  if (currentVal !== undefined) return currentVal;

  const sortedRecent = [...activeBudgets].sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));
  for (const b of sortedRecent) {
    const val = extractBudgetPayday(b);
    if (val !== undefined) return val;
  }

  return undefined;
}
