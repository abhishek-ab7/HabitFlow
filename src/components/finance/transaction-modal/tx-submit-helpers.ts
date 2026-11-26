import { formatINR } from '@/lib/stores/finance-store';
import type {
  CommitmentContributionType,
  FinanceCategory,
  FinanceTransaction,
  FinanceTransactionType,
} from '@/lib/types';
import { executeFinanceFitnessBridge, type FinanceBridgeKind } from '@/lib/fitness/finance-bridge';
import { toast } from 'sonner';
import type { SplitRow } from './tx-modal-types';
import { runPostSaveFitnessSync } from './tx-capture-service';

export interface TxSubmitContext {
  editingTransaction?: FinanceTransaction | null;
  type: FinanceTransactionType;
  numericAmount: number;
  autoTitle: string;
  title: string;
  resolvedCategoryId: string;
  resolvedAccountId: string;
  fallbackCat: string;
  toAccountId: string;
  date: string;
  notes: string;
  tags: string[];
  linkedCommitmentId: string;
  commitmentContributionType: CommitmentContributionType;
  linkedDebtId: string;
  isRecurringEnabled: boolean;
  recurringCadence: 'monthly' | 'quarterly' | 'yearly';
  recurringDueDay: string;
  isCategorySplitEnabled: boolean;
  splitRows: SplitRow[];
  splitRemaining: number;
  isSplitEnabled: boolean;
  splitFriendName: string;
  splitFriendShareStr: string;
  bridgeKind: FinanceBridgeKind;
  userId?: string;
  alsoLogToDiet: boolean;
  dietCaloriesOverride: string;
  dietProteinOverride: string;
  restockSupplementEnabled: boolean;
  selectedSupplementId: string;
  restockServingsStr: string;
  categories: FinanceCategory[];
  addTransaction: (data: Record<string, unknown>) => Promise<FinanceTransaction>;
  updateTransaction: (id: string, data: Record<string, unknown>) => Promise<void>;
  splitTransactionWithFriend: (data: Record<string, unknown>) => Promise<void>;
  addSplitTransactions: (data: Record<string, unknown>) => Promise<void>;
  addRecurringBill: (data: Record<string, unknown>) => Promise<void>;
  closeModal: () => void;
}

function roundTwo(val: number): number {
  return Math.round(val * 100) / 100;
}

function makeSplitRow(categoryId: string, amount: number): SplitRow {
  return { id: crypto.randomUUID(), categoryId, amountStr: amount > 0 ? String(amount) : '', note: '' };
}

export function computeHalfSplitRows(params: {
  catId: string;
  activeCategories: FinanceCategory[];
  numericAmount: number;
}): SplitRow[] {
  const { catId, activeCategories, numericAmount } = params;
  const cat1 = catId || activeCategories[0]?.id || '';
  const cat2 = activeCategories.find((c) => c.id !== cat1)?.id || cat1;
  const half = roundTwo(Math.max(0, numericAmount) / 2);
  const rest = roundTwo(Math.max(0, numericAmount - half));
  return [makeSplitRow(cat1, half), makeSplitRow(cat2, rest)];
}

function buildOptionalFields(ctx: TxSubmitContext) {
  return {
    merchantName: ctx.title.trim() || undefined,
    notes: ctx.notes.trim() || undefined,
    tags: ctx.tags.length > 0 ? ctx.tags : undefined,
  };
}

function buildStandardPayload(ctx: TxSubmitContext) {
  const hasCommitment = ctx.linkedCommitmentId !== 'none';
  return {
    title: ctx.autoTitle,
    amount: ctx.numericAmount,
    type: ctx.type,
    categoryId: ctx.resolvedCategoryId,
    accountId: ctx.resolvedAccountId,
    toAccountId: ctx.type === 'transfer' ? ctx.toAccountId || undefined : undefined,
    date: ctx.date,
    needsReview: false,
    linkedCommitmentId: hasCommitment ? ctx.linkedCommitmentId : null,
    commitmentContributionType: hasCommitment ? ctx.commitmentContributionType : null,
    linkedDebtId: ctx.linkedDebtId !== 'none' ? ctx.linkedDebtId : null,
    ...buildOptionalFields(ctx),
  };
}

async function submitCategorySplitFlow(ctx: TxSubmitContext) {
  const validRows = ctx.splitRows.filter((r) => (parseFloat(r.amountStr) || 0) > 0);
  if (validRows.length < 2) return void toast.error('Add at least 2 category rows with valid amounts');
  if (Math.abs(ctx.splitRemaining) > 0.01) {
    const dir = ctx.splitRemaining > 0 ? 'remaining' : 'over';
    return void toast.error(`Split amounts must equal ${formatINR(ctx.numericAmount)} (${formatINR(Math.abs(ctx.splitRemaining))} ${dir})`);
  }
  await ctx.addSplitTransactions({
    base: { title: ctx.autoTitle, type: 'expense', accountId: ctx.resolvedAccountId, date: ctx.date, ...buildOptionalFields(ctx) },
    splits: validRows.map((r) => ({
      categoryId: r.categoryId || ctx.fallbackCat,
      amount: parseFloat(r.amountStr),
      note: r.note.trim() || undefined,
    })),
  });
  toast.success(`Saved ${validRows.length}-way split (${formatINR(ctx.numericAmount)})`);
  ctx.closeModal();
}

async function submitFriendSplitFlow(ctx: TxSubmitContext) {
  const parsedShare = parseFloat(ctx.splitFriendShareStr);
  const hasCustomShare = !Number.isNaN(parsedShare) && ctx.splitFriendShareStr.trim() !== '';
  const friendShare = hasCustomShare ? Math.max(0, parsedShare) : Math.round(ctx.numericAmount / 2);
  const myShare = Math.max(0, ctx.numericAmount - friendShare);

  await ctx.splitTransactionWithFriend({
    txData: {
      title: ctx.autoTitle,
      amount: ctx.numericAmount,
      type: 'expense',
      categoryId: ctx.resolvedCategoryId,
      accountId: ctx.resolvedAccountId,
      date: ctx.date,
      ...buildOptionalFields(ctx),
    },
    friendName: ctx.splitFriendName.trim(),
    friendShareAmount: friendShare,
    existingDebtId: ctx.linkedDebtId !== 'none' ? ctx.linkedDebtId : undefined,
  });
  toast.success(`Logged your share (${formatINR(myShare)}) & added ${formatINR(friendShare)} to ${ctx.splitFriendName.trim()}'s Friends Ledger`);
  ctx.closeModal();
}

async function maybeCreateRecurringBill(ctx: TxSubmitContext) {
  if (!ctx.isRecurringEnabled) return;
  await ctx.addRecurringBill({
    name: ctx.autoTitle,
    amount: ctx.numericAmount,
    categoryId: ctx.resolvedCategoryId,
    accountId: ctx.resolvedAccountId,
    cadence: ctx.recurringCadence,
    dueDayOfMonth: Math.min(31, Math.max(1, parseInt(ctx.recurringDueDay, 10) || 1)),
    autoLog: false,
    isActive: true,
    color: '#06b6d4',
    icon: 'Repeat',
  });
}

async function saveStandardTransaction(ctx: TxSubmitContext) {
  const payload = buildStandardPayload(ctx);
  if (ctx.editingTransaction) {
    await ctx.updateTransaction(ctx.editingTransaction.id, payload);
    toast.success('Updated entry');
    return ctx.closeModal();
  }
  const createdTx = await ctx.addTransaction(payload);
  const bridgeResult = await executeFinanceFitnessBridge({
    bridgeKind: ctx.bridgeKind,
    transaction: createdTx,
    userId: ctx.userId,
    alsoLogToDiet: ctx.alsoLogToDiet,
    dietCalories: ctx.dietCaloriesOverride ? Number(ctx.dietCaloriesOverride) : undefined,
    dietProteinG: ctx.dietProteinOverride ? Number(ctx.dietProteinOverride) : undefined,
    restockSupplement: ctx.restockSupplementEnabled,
    supplementId: ctx.selectedSupplementId,
    restockServings: Number(ctx.restockServingsStr) || 30,
    newSupplementName: ctx.title.trim() || undefined,
  });
  await runPostSaveFitnessSync({
    createdTx,
    type: ctx.type,
    bridgeKind: ctx.bridgeKind,
    restockSupplementEnabled: ctx.restockSupplementEnabled,
    alsoLogToDiet: ctx.alsoLogToDiet,
    categories: ctx.categories,
    isRecurringEnabled: ctx.isRecurringEnabled,
    linkedCommitmentId: ctx.linkedCommitmentId,
    bridgeResult,
  });
  ctx.closeModal();
}

export async function executeTransactionSubmit(ctx: TxSubmitContext) {
  const isNewExpense = !ctx.editingTransaction && ctx.type === 'expense';
  if (isNewExpense) {
    await maybeCreateRecurringBill(ctx);
    if (ctx.isCategorySplitEnabled) return submitCategorySplitFlow(ctx);
    if (ctx.isSplitEnabled && ctx.splitFriendName.trim()) return submitFriendSplitFlow(ctx);
  }
  return saveStandardTransaction(ctx);
}
