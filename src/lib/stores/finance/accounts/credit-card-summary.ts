import { computeCreditCardSummary, getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import type {
  CreditCardCycleSummary,
  CreditCardStatement,
  FinanceAccount,
  FinanceTransaction,
} from '@/lib/types';
import type { FinanceStore } from '../helpers';

let ccSummaryCache: {
  accountsRef: unknown;
  transactionsRef: unknown;
  statementsRef: unknown;
  results: Map<string, CreditCardCycleSummary | null>;
} | null = null;

function ensureSummaryCache(
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[],
  statements: CreditCardStatement[]
) {
  const matches =
    ccSummaryCache &&
    ccSummaryCache.accountsRef === accounts &&
    ccSummaryCache.transactionsRef === transactions &&
    ccSummaryCache.statementsRef === statements;
  if (!matches) {
    ccSummaryCache = {
      accountsRef: accounts,
      transactionsRef: transactions,
      statementsRef: statements,
      results: new Map(),
    };
  }
  return ccSummaryCache!;
}

export function getCreditCardSummaryImpl(
  state: FinanceStore,
  accountId: string,
  referenceDate?: string
): CreditCardCycleSummary | null {
  const cache = ensureSummaryCache(
    state.accounts,
    state.transactions,
    state.creditCardStatements
  );
  const cacheKey = `${accountId}|${referenceDate || getLocalIsoDate()}`;
  if (cache.results.has(cacheKey)) {
    return cache.results.get(cacheKey) ?? null;
  }

  const account = state.accounts.find((a) => a.id === accountId);
  if (!account || account.type !== 'credit_card') {
    cache.results.set(cacheKey, null);
    return null;
  }

  const summary = computeCreditCardSummary({
    account,
    transactions: state.transactions,
    persistedStatements: state.creditCardStatements,
    referenceDate,
  });
  cache.results.set(cacheKey, summary);
  return summary;
}
