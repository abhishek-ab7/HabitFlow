import type {
  DebtRecord,
  FinanceCategory,
  FinanceTransaction,
  FinanceTransactionFormData,
} from '@/lib/types';
import { formatINR, resolveCurrentUserId, type FinanceStore } from '../helpers';

function findDebtCategory(categories: FinanceCategory[]): FinanceCategory {
  return (
    categories.find((c) => c.slug === 'emis-debt-repayment') ||
    categories.find(
      (c) => c.name.toLowerCase().includes('debt') || c.name.toLowerCase().includes('emi')
    ) ||
    categories[0]
  );
}

function findMatchingFriendDebt(
  debtRecords: DebtRecord[],
  cleanFriendName: string,
  existingDebtId?: string
): DebtRecord | undefined {
  if (existingDebtId) return debtRecords.find((d) => d.id === existingDebtId);
  const target = cleanFriendName.toLowerCase();
  return debtRecords.find(
    (d) =>
      d.bucketType === 'everyday_split' &&
      d.status === 'active' &&
      d.personName.trim().toLowerCase() === target
  );
}

async function createFriendLentSplitTx(params: {
  state: FinanceStore;
  txData: FinanceTransactionFormData;
  cleanFriendName: string;
  roundedFriendPortion: number;
  splitGroupId: string;
  debtCatId: string;
}): Promise<FinanceTransaction> {
  const { state, txData, cleanFriendName, roundedFriendPortion, splitGroupId, debtCatId } = params;
  return state.addTransaction({
    title: `${cleanFriendName}'s Share: ${txData.title}`,
    amount: roundedFriendPortion,
    type: 'expense',
    categoryId: debtCatId,
    subcategory: 'Friend Split',
    accountId: txData.accountId,
    date: txData.date,
    notes: `Friend split portion for ${cleanFriendName} · ${txData.title}`,
    tags: Array.from(
      new Set([...(txData.tags || []), 'split', cleanFriendName.toLowerCase(), 'friend-share'])
    ),
    splitGroupId,
  });
}

async function handleFriendSplitDebtLeg(params: {
  state: FinanceStore;
  txData: FinanceTransactionFormData;
  cleanFriendName: string;
  roundedFriendPortion: number;
  splitGroupId: string;
  debtCatId: string;
  existingDebt: DebtRecord | undefined;
}): Promise<{ friendTx?: FinanceTransaction; debtRecord?: DebtRecord }> {
  const { state, txData, cleanFriendName, roundedFriendPortion, splitGroupId, debtCatId, existingDebt } =
    params;

  if (existingDebt?.direction === 'borrowed') {
    const installment = await state.recordDebtInstallment({
      debtId: existingDebt.id,
      amount: roundedFriendPortion,
      date: txData.date,
      accountId: txData.accountId,
      paymentMethod: 'offset_expense',
      note: `Repayment via split: ${txData.title}`,
      splitGroupId,
    });
    const updatedDebt = state.debtRecords.find((d) => d.id === existingDebt.id);
    const friendTx = installment?.transactionId
      ? state.transactions.find((t) => t.id === installment.transactionId)
      : undefined;
    return { friendTx, debtRecord: updatedDebt };
  }

  const friendTx = await createFriendLentSplitTx({
    state,
    txData,
    cleanFriendName,
    roundedFriendPortion,
    splitGroupId,
    debtCatId,
  });

  if (existingDebt?.direction === 'lent') {
    await state.topUpDebt(
      existingDebt.id,
      roundedFriendPortion,
      `Split: ${txData.title} (${txData.date})`
    );
    return { friendTx, debtRecord: state.debtRecords.find((d) => d.id === existingDebt.id) };
  }

  const debtRecord = await state.addDebtRecord({
    personName: cleanFriendName,
    direction: 'lent',
    title: `Everyday Split: ${txData.title}`,
    principalAmount: roundedFriendPortion,
    startDate: txData.date,
    repaymentSchedule: 'flexible',
    bucketType: 'everyday_split',
    color: '#10b981',
    notes: `Created from split expense "${txData.title}" on ${txData.date}`,
  });
  return { friendTx, debtRecord };
}

async function createUserShareLeg(params: {
  state: FinanceStore;
  txData: FinanceTransactionFormData;
  cleanFriendName: string;
  roundedMyShare: number;
  roundedFriendPortion: number;
  splitGroupId: string;
}): Promise<FinanceTransaction> {
  const { state, txData, cleanFriendName, roundedMyShare, roundedFriendPortion, splitGroupId } = params;
  const prefix = txData.notes ? `${txData.notes} · ` : '';
  return state.addTransaction({
    ...txData,
    amount: roundedMyShare,
    splitGroupId,
    notes: `${prefix}Split with ${cleanFriendName} (Your share: ${formatINR(
      roundedMyShare
    )}, ${cleanFriendName} owes: ${formatINR(roundedFriendPortion)})`,
    tags: Array.from(new Set([...(txData.tags || []), 'split', cleanFriendName.toLowerCase()])),
  });
}

async function ensureZeroPortionDebt(
  state: FinanceStore,
  txData: FinanceTransactionFormData,
  cleanFriendName: string,
  debtRecord: DebtRecord | undefined
): Promise<DebtRecord> {
  if (debtRecord) return debtRecord;
  return state.addDebtRecord({
    personName: cleanFriendName,
    direction: 'lent',
    title: `Everyday Split: ${txData.title}`,
    principalAmount: 0,
    startDate: txData.date,
    repaymentSchedule: 'flexible',
    bucketType: 'everyday_split',
    color: '#10b981',
  });
}

async function executeSplitLegs(params: {
  state: FinanceStore;
  txData: FinanceTransactionFormData;
  cleanFriendName: string;
  roundedMyShare: number;
  roundedFriendPortion: number;
  splitGroupId: string;
  debtCatId: string;
  initialDebt: DebtRecord | undefined;
}): Promise<{ primaryTx: FinanceTransaction; debt: DebtRecord }> {
  const {
    state,
    txData,
    cleanFriendName,
    roundedMyShare,
    roundedFriendPortion,
    splitGroupId,
    debtCatId,
    initialDebt,
  } = params;

  const userTx =
    roundedMyShare > 0 || roundedFriendPortion === 0
      ? await createUserShareLeg({
          state,
          txData,
          cleanFriendName,
          roundedMyShare,
          roundedFriendPortion,
          splitGroupId,
        })
      : undefined;

  if (roundedFriendPortion <= 0) {
    const debt = await ensureZeroPortionDebt(state, txData, cleanFriendName, initialDebt);
    return { primaryTx: userTx!, debt };
  }

  const legResult = await handleFriendSplitDebtLeg({
    state,
    txData,
    cleanFriendName,
    roundedFriendPortion,
    splitGroupId,
    debtCatId,
    existingDebt: initialDebt,
  });
  return {
    primaryTx: (userTx || legResult.friendTx)!,
    debt: legResult.debtRecord!,
  };
}

export async function splitTransactionWithFriendImpl(
  state: FinanceStore,
  params: {
    txData: FinanceTransactionFormData;
    friendName: string;
    friendShareAmount: number;
    existingDebtId?: string;
  }
): Promise<{ transaction: FinanceTransaction; debt: DebtRecord }> {
  const { txData, friendName, friendShareAmount, existingDebtId } = params;
  const userId = await resolveCurrentUserId(undefined, state.currentUserId);
  const cleanFriendName = friendName.trim();
  const totalOutflow = Math.max(0, Number(txData.amount) || 0);
  const friendPortion = Math.max(0, Math.min(totalOutflow, Number(friendShareAmount) || 0));
  const roundedFriendPortion = Math.round(friendPortion * 100) / 100;
  const roundedMyShare = Math.round(Math.max(0, totalOutflow - roundedFriendPortion) * 100) / 100;
  const splitGroupId = crypto.randomUUID();

  const debtCat = findDebtCategory(state.categories);
  const initialDebt = findMatchingFriendDebt(state.debtRecords, cleanFriendName, existingDebtId);
  const { primaryTx, debt } = await executeSplitLegs({
    state,
    txData,
    cleanFriendName,
    roundedMyShare,
    roundedFriendPortion,
    splitGroupId,
    debtCatId: debtCat.id,
    initialDebt,
  });

  await state.loadFinanceData(userId);
  const account = state.accounts.find((a) => a.id === txData.accountId);
  if (account?.type === 'credit_card') await state.syncCardStatements(account.id);

  return { transaction: primaryTx, debt };
}
