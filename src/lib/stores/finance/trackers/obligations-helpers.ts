import { CrossDomainActionMediator } from '../../mediator';
import type { FinanceAccount, FinanceCategory } from '@/lib/types';
import type { FinanceStore } from '../helpers';

function findAccountById(accounts: FinanceAccount[], id?: string): FinanceAccount | undefined {
  return id ? accounts.find((a) => a.id === id) : undefined;
}

function findCategoryById(
  categories: FinanceCategory[],
  id?: string
): FinanceCategory | undefined {
  return id ? categories.find((c) => c.id === id) : undefined;
}

export function resolveAccountAndCategory(params: {
  state: FinanceStore;
  preferredAccountId?: string;
  entityAccountId?: string;
  preferredCategoryId?: string;
  fallbackSlug: string;
}) {
  const { state, preferredAccountId, entityAccountId, preferredCategoryId, fallbackSlug } = params;
  const account =
    findAccountById(state.accounts, preferredAccountId) ||
    findAccountById(state.accounts, entityAccountId) ||
    state.accounts.find((a) => a.isDefault) ||
    state.accounts[0];
  const category =
    findCategoryById(state.categories, preferredCategoryId) ||
    state.categories.find((c) => c.slug === fallbackSlug) ||
    state.categories[0];
  return { account, category };
}

export async function emitFinanceEventNonBlocking(
  type: 'COMMITMENT_SETTLED' | 'EMI_PAID' | 'SIP_COMPLETED',
  date: string,
  amount: number
): Promise<void> {
  try {
    await CrossDomainActionMediator.onFinanceEvent({ type, date, amount });
  } catch {
    // Non-blocking
  }
}
