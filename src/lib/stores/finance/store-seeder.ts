import { db } from '@/lib/db';
import type { FinanceAccount, FinanceCategory } from '@/lib/types';
import { DEFAULT_FINANCE_CATEGORIES, notifyFinanceSync } from './helpers';

const STARTER_ACCOUNT_TEMPLATES: Array<{
  name: string;
  type: FinanceAccount['type'];
  color: string;
  icon: string;
  isDefault: boolean;
}> = [
  { name: 'UPI', type: 'upi', color: '#10b981', icon: 'Smartphone', isDefault: true },
  { name: 'Bank Account', type: 'bank', color: '#3b82f6', icon: 'Landmark', isDefault: false },
  { name: 'Cash', type: 'cash', color: '#f59e0b', icon: 'Banknote', isDefault: false },
  {
    name: 'Credit Card',
    type: 'credit_card',
    color: '#8b5cf6',
    icon: 'CreditCard',
    isDefault: false,
  },
];

async function addJunkCategoryIfMissing(
  userId: string,
  hasJunkFood: boolean,
  now: string
): Promise<void> {
  if (hasJunkFood) return;
  const junkTemplate = DEFAULT_FINANCE_CATEGORIES.find((c) => c.slug === 'junk-food');
  if (!junkTemplate) return;
  await db.financeCategories.add({
    ...junkTemplate,
    id: crypto.randomUUID(),
    userId,
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedMissingCategories(
  userId: string,
  existingCats: FinanceCategory[],
  hasJunkFood: boolean,
  now: string
): Promise<void> {
  if (existingCats.length > 0) {
    await addJunkCategoryIfMissing(userId, hasJunkFood, now);
    return;
  }

  const categories: FinanceCategory[] = DEFAULT_FINANCE_CATEGORIES.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
    userId,
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  }));
  if (categories.length > 0) await db.financeCategories.bulkAdd(categories);
}

async function seedMissingAccounts(
  userId: string,
  existingAccs: FinanceAccount[],
  now: string
): Promise<void> {
  if (existingAccs.length > 0) return;
  const existingKeys = new Set(
    existingAccs.map((a) => `${a.name.trim().toLowerCase()}_${a.type}`)
  );
  const starterAccounts: FinanceAccount[] = STARTER_ACCOUNT_TEMPLATES.map((tpl) => ({
    ...tpl,
    id: crypto.randomUUID(),
    userId,
    balance: 0,
    currency: 'INR',
    archived: false,
    isDirty: true,
    generationCounter: 1,
    createdAt: now,
    updatedAt: now,
  })).filter((a) => !existingKeys.has(`${a.name.trim().toLowerCase()}_${a.type}`));

  if (starterAccounts.length > 0) {
    await db.financeAccounts.bulkAdd(starterAccounts);
  }
}

function isAlreadySeeded(
  existingCats: FinanceCategory[],
  existingAccs: FinanceAccount[],
  hasJunkFood: boolean
): boolean {
  return existingCats.length > 0 && existingAccs.length > 0 && hasJunkFood;
}

export async function seedInitialFinanceDataImpl(userId: string): Promise<void> {
  const existingCats = await db.financeCategories.where('userId').equals(userId).toArray();
  const existingAccs = await db.financeAccounts.where('userId').equals(userId).toArray();
  const hasJunkFood = existingCats.some(
    (c) => c.slug === 'junk-food' || /junk\s*food/i.test(c.name)
  );
  if (isAlreadySeeded(existingCats, existingAccs, hasJunkFood)) return;

  const now = new Date().toISOString();
  await seedMissingCategories(userId, existingCats, hasJunkFood, now);
  await seedMissingAccounts(userId, existingAccs, now);

  if (userId !== 'local-demo-user') notifyFinanceSync();
}
