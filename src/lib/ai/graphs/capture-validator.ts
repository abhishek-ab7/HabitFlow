import type {
  UniversalCaptureAction,
  UniversalExpenseAction,
  UniversalParserContext,
} from '@/lib/quick-capture/parser-types';
import type {
  AmbiguityPrompt,
  CaptureGraphStatus,
  DuplicateWarning,
  RecentTransactionRef,
} from './capture-state';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DUPLICATE_AMOUNT_TOLERANCE_PCT = 0.02;

function parseIsoDateMs(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isWithin24Hours(dateA: string, dateB: string): boolean {
  const msA = parseIsoDateMs(dateA);
  const msB = parseIsoDateMs(dateB);
  if (msA === null || msB === null) return dateA === dateB;
  return Math.abs(msA - msB) <= MS_PER_DAY;
}

function isDuplicateAmount(a: number, b: number): boolean {
  const tolerance = Math.max(1, a * DUPLICATE_AMOUNT_TOLERANCE_PCT);
  return Math.abs(a - b) <= tolerance;
}

function find24hDuplicate(
  action: UniversalExpenseAction,
  recentTransactions: RecentTransactionRef[]
): RecentTransactionRef | undefined {
  return recentTransactions.find(
    (tx) => isWithin24Hours(action.date, tx.date) && isDuplicateAmount(action.amount, tx.amount)
  );
}

export interface ValidationOutcome {
  status: CaptureGraphStatus;
  overallConfidence: number;
  ambiguities: AmbiguityPrompt[];
  duplicateWarnings: DuplicateWarning[];
}

/**
 * Node 3: Deterministic FK & 24h Duplicate Validator (Pure TS — ZERO LLM calls).
 * Computes confidence and routes to Node 4 (AWAITING_HUMAN) or Node 5 (READY_TO_COMMIT).
 */
export function validateCaptureActions(params: {
  actions: UniversalCaptureAction[];
  context: UniversalParserContext;
  recentTransactions?: RecentTransactionRef[];
}): ValidationOutcome {
  const { actions, context, recentTransactions = [] } = params;
  const activeAccounts = context.accounts || [];
  const ambiguities: AmbiguityPrompt[] = [];
  const duplicateWarnings: DuplicateWarning[] = [];

  for (const action of actions) {
    if (action.kind !== 'expense') continue;

    // 1. Account FK ambiguity when user has 2+ accounts and no explicit match resolved
    const validAccountIds = new Set(activeAccounts.map((a) => a.id));
    const hasResolvedAccount = Boolean(action.accountId && validAccountIds.has(action.accountId));
    if (activeAccounts.length >= 2 && !hasResolvedAccount) {
      ambiguities.push({
        id: `amb_acc_${action.id}`,
        actionId: action.id,
        field: 'accountId',
        question: `Which account paid ₹${action.amount.toLocaleString('en-IN')} for "${action.title}"?`,
        options: activeAccounts.map((a) => ({ label: a.name, value: a.id })),
      });
    }

    // 2. 24-hour duplicate transaction detection
    const dup = find24hDuplicate(action, recentTransactions);
    if (dup) {
      duplicateWarnings.push({
        id: `dup_${action.id}_${dup.id}`,
        actionId: action.id,
        existingTxId: dup.id,
        existingTitle: dup.title || 'Existing transaction',
        amount: dup.amount,
        date: dup.date,
        reason: `Similar ₹${dup.amount.toLocaleString('en-IN')} transaction ("${dup.title || 'Expense'}") was already logged on ${dup.date}.`,
      });
    }
  }

  const requiresHuman = ambiguities.length > 0 || duplicateWarnings.length > 0;
  return {
    status: requiresHuman ? 'AWAITING_HUMAN' : 'READY_TO_COMMIT',
    overallConfidence: requiresHuman ? 0.65 : 0.96,
    ambiguities,
    duplicateWarnings,
  };
}
