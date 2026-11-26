'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { FinanceAccount, FinanceTransaction, FinanceTransactionType, CommitmentContributionType } from '@/lib/types';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useFeedback } from '@/hooks/use-feedback';
import { classifyCategoryBridgeKind, estimateDietBridgePreview, findMatchingSupplementId } from '@/lib/fitness/finance-bridge';
import { toast } from 'sonner';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useAuth } from '@/providers/auth-provider';
import { computeSuggestedTags, resolveAutoTitle, type SplitRow } from './tx-modal-types';
import { computeHalfSplitRows, executeTransactionSubmit } from './tx-submit-helpers';
import { useTxSmartCapture } from './useTxSmartCapture';

export function useAddTransactionForm(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTransaction?: FinanceTransaction | null;
  defaultCommitmentId?: string | null;
  defaultDebtId?: string | null;
}) {
  const { open, onOpenChange, editingTransaction, defaultCommitmentId, defaultDebtId } = params;
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const splitTransactionWithFriend = useFinanceStore((s) => s.splitTransactionWithFriend);
  const addSplitTransactions = useFinanceStore((s) => s.addSplitTransactions);
  const addRecurringBill = useFinanceStore((s) => s.addRecurringBill);
  const setDefaultAccount = useFinanceStore((s) => s.setDefaultAccount);
  const applyCategorizationRules = useFinanceStore((s) => s.applyCategorizationRules);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const supplementInventory = useFitnessStore((s) => s.supplementInventory);
  const fitnessHasLoaded = useFitnessStore((s) => s.hasLoaded);
  const loadFitnessData = useFitnessStore((s) => s.loadFitnessData);

  const feedback = useFeedback();
  const { user } = useAuth();
  const todayStr = getLocalIsoDate();

  const [type, setType] = useState<FinanceTransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayStr);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [linkedCommitmentId, setLinkedCommitmentId] = useState('none');
  const [commitmentContributionType, setCommitmentContributionType] = useState<CommitmentContributionType>('offset_expense');
  const [linkedDebtId, setLinkedDebtId] = useState('none');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const [isCategorySplitEnabled, setIsCategorySplitEnabled] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [isRecurringEnabled, setIsRecurringEnabled] = useState(false);
  const [recurringCadence, setRecurringCadence] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [recurringDueDay, setRecurringDueDay] = useState('1');

  const [alsoLogToDiet, setAlsoLogToDiet] = useState(false);
  const [dietCaloriesOverride, setDietCaloriesOverride] = useState('');
  const [dietProteinOverride, setDietProteinOverride] = useState('');
  const [restockSupplementEnabled, setRestockSupplementEnabled] = useState(false);
  const [selectedSupplementId, setSelectedSupplementId] = useState('__new__');
  const [restockServingsStr, setRestockServingsStr] = useState('30');

  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splitFriendName, setSplitFriendName] = useState('');
  const [splitFriendShareStr, setSplitFriendShareStr] = useState('');
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isLocalSmsOpen, setIsLocalSmsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const initializedSessionRef = useRef<string | null>(null);
  const hasManuallyPickedSupplementRef = useRef(false);

  const activeCategories = useMemo(() => categories.filter((c) => !c.deletedAt), [categories]);
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.deletedAt), [accounts]);
  const suggestedTags = useMemo(() => computeSuggestedTags(transactions), [transactions]);

  const capture = useTxSmartCapture({
    activeCategories, activeAccounts, todayStr, applyCategorizationRules,
    addTransaction: addTransaction as unknown as (data: Record<string, unknown>) => Promise<unknown>,
    onCloseModal: () => onOpenChange(false),
    setType, setAmountStr, setTitle, setCategoryId, setAccountId, setDate, setNotes, setShowMoreOptions, setTags,
  });
  const stopVoice = () => capture.recognitionRef.current?.stop();
  const resetBatch = () => {
    capture.setNlpInput('');
    capture.setScannedBatch([]);
  };

  useEffect(() => {
    if (open && categories.length === 0) loadFinanceData(user?.id, false);
    if (open && !fitnessHasLoaded) loadFitnessData(user?.id, false).catch(() => undefined);
  }, [open, categories.length, loadFinanceData, fitnessHasLoaded, loadFitnessData, user?.id]);

  useEffect(() => {
    if (!open) {
      initializedSessionRef.current = null;
      setIsCategorySheetOpen(false);
      stopVoice();
      return;
    }
    const sessionKey = editingTransaction?.id || `new:${defaultCommitmentId || ''}:${defaultDebtId || ''}`;
    if (initializedSessionRef.current === sessionKey) return;
    if (!editingTransaction && activeCategories.length === 0 && activeAccounts.length === 0) return;
    initializedSessionRef.current = sessionKey;

    const focusTimer = setTimeout(() => amountInputRef.current?.focus(), 80);
    const defaultCat = activeCategories[0];
    const defaultAcc = activeAccounts.find((a) => a.isDefault) || activeAccounts[0];
    const secondAcc = activeAccounts.find((a) => a.id !== defaultAcc?.id) || activeAccounts[0];

    setType(editingTransaction?.type ?? 'expense');
    setAmountStr(editingTransaction?.amount ? String(editingTransaction.amount) : '');
    setCategoryId(editingTransaction?.categoryId ?? defaultCat?.id ?? '');
    setAccountId(editingTransaction?.accountId ?? defaultAcc?.id ?? '');
    setToAccountId(editingTransaction?.toAccountId ?? secondAcc?.id ?? '');
    setTitle(editingTransaction?.title ?? '');
    setNotes(editingTransaction?.notes ?? '');
    setDate(editingTransaction?.date ?? todayStr);
    setTags(editingTransaction?.tags ?? []);
    setTagInput('');
    setLinkedCommitmentId(editingTransaction?.linkedCommitmentId || defaultCommitmentId || 'none');
    setCommitmentContributionType(editingTransaction?.commitmentContributionType || 'offset_expense');
    setLinkedDebtId(editingTransaction?.linkedDebtId || defaultDebtId || 'none');
    const hasLinksOrNotes = Boolean(editingTransaction?.linkedCommitmentId || editingTransaction?.linkedDebtId || editingTransaction?.notes);
    setShowMoreOptions(hasLinksOrNotes || Boolean(defaultCommitmentId || defaultDebtId));
    setIsSplitEnabled(false);
    setSplitFriendName('');
    setSplitFriendShareStr('');
    setIsCategorySplitEnabled(false);
    setSplitRows([]);
    setIsRecurringEnabled(false);
    setRecurringCadence('monthly');
    setRecurringDueDay(String(new Date().getDate()));
    resetBatch();
    setAlsoLogToDiet(false);
    setDietCaloriesOverride('');
    setDietProteinOverride('');
    setRestockSupplementEnabled(false);
    setSelectedSupplementId('__new__');
    setRestockServingsStr('30');
    hasManuallyPickedSupplementRef.current = false;

    return () => clearTimeout(focusTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTransaction, defaultCommitmentId, defaultDebtId, activeCategories, activeAccounts, todayStr]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingTransaction && val.trim().length >= 3) {
      const matched = applyCategorizationRules(val);
      if (matched.categoryId) setCategoryId(matched.categoryId);
      if (matched.tags?.length) setTags((prev) => Array.from(new Set([...prev, ...matched.tags!])));
    }
  };

  const addTagChip = (raw: string) => {
    const clean = raw.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;
    if (!tags.includes(clean)) setTags((prev) => [...prev, clean]);
    setTagInput('');
  };

  const isFitnessEnabled = isFitnessModuleEnabled(useGamificationStore((s) => s.settings));
  const selectedCategory = activeCategories.find((c) => c.id === categoryId) || activeCategories[0];
  const numericAmount = parseFloat(amountStr) || 0;
  const isNewExpense = !editingTransaction && type === 'expense';
  const bridgeKind = isFitnessEnabled && isNewExpense && !isCategorySplitEnabled ? classifyCategoryBridgeKind(selectedCategory) : 'none';
  const dietPreview = useMemo(() => estimateDietBridgePreview(title, numericAmount, bridgeKind === 'junk'), [title, numericAmount, bridgeKind]);
  const activeSupplements = useMemo(() => supplementInventory.filter((s) => !s.deletedAt && s.isActive), [supplementInventory]);

  useEffect(() => {
    if (bridgeKind === 'health_supplements' && !hasManuallyPickedSupplementRef.current) {
      setSelectedSupplementId(findMatchingSupplementId(title, supplementInventory));
    }
  }, [bridgeKind, title, supplementInventory]);

  const toggleCategorySplit = () => {
    const next = !isCategorySplitEnabled;
    setIsCategorySplitEnabled(next);
    if (!next) return void setSplitRows([]);
    setIsSplitEnabled(false);
    setSplitRows(computeHalfSplitRows({ catId: categoryId, activeCategories, numericAmount }));
  };

  const splitSum = useMemo(() => splitRows.reduce((acc, r) => acc + (parseFloat(r.amountStr) || 0), 0), [splitRows]);
  const splitRemaining = Math.round((numericAmount - splitSum) * 100) / 100;

  const fallbackCat = activeCategories[0]?.id || 'uncategorized';
  const fallbackAcc = activeAccounts[0]?.id || 'default';
  const resolvedCategoryId = categoryId || fallbackCat;
  const resolvedAccountId = accountId || fallbackAcc;
  const autoTitle = resolveAutoTitle(title, type, selectedCategory?.name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      feedback.error();
      return void toast.error('Please enter a valid amount');
    }
    feedback.coin();
    setIsSaving(true);
    try {
      await executeTransactionSubmit({
        editingTransaction, type, numericAmount, autoTitle, title, resolvedCategoryId, resolvedAccountId,
        fallbackCat, toAccountId, date, notes, tags, linkedCommitmentId, commitmentContributionType, linkedDebtId,
        isRecurringEnabled, recurringCadence, recurringDueDay, isCategorySplitEnabled, splitRows, splitRemaining,
        isSplitEnabled, splitFriendName, splitFriendShareStr, bridgeKind, userId: user?.id,
        alsoLogToDiet, dietCaloriesOverride, dietProteinOverride, restockSupplementEnabled, selectedSupplementId,
        restockServingsStr, categories,
        addTransaction: addTransaction as unknown as (data: Record<string, unknown>) => Promise<FinanceTransaction>,
        updateTransaction: updateTransaction as unknown as (id: string, data: Record<string, unknown>) => Promise<void>,
        splitTransactionWithFriend: splitTransactionWithFriend as unknown as (data: Record<string, unknown>) => Promise<void>,
        addSplitTransactions: addSplitTransactions as unknown as (data: Record<string, unknown>) => Promise<void>,
        addRecurringBill: addRecurringBill as unknown as (data: Record<string, unknown>) => Promise<void>,
        closeModal: () => onOpenChange(false),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    feedback.warning();
    await deleteTransaction(editingTransaction.id);
    toast.success('Transaction deleted');
    onOpenChange(false);
  };

  return {
    ...capture,
    type, setType, amountStr, setAmountStr, categoryId, setCategoryId, accountId, setAccountId,
    toAccountId, setToAccountId, title, setTitle, handleTitleChange, notes, setNotes, date, setDate,
    tags, setTags, tagInput, setTagInput, addTagChip, linkedCommitmentId, setLinkedCommitmentId,
    commitmentContributionType, setCommitmentContributionType, linkedDebtId, setLinkedDebtId,
    showMoreOptions, setShowMoreOptions, isCategorySplitEnabled, setIsCategorySplitEnabled,
    splitRows, setSplitRows, splitRemaining, toggleCategorySplit, isRecurringEnabled, setIsRecurringEnabled,
    recurringCadence, setRecurringCadence, recurringDueDay, setRecurringDueDay,
    alsoLogToDiet, setAlsoLogToDiet, dietCaloriesOverride, setDietCaloriesOverride,
    dietProteinOverride, setDietProteinOverride, restockSupplementEnabled, setRestockSupplementEnabled,
    selectedSupplementId, restockServingsStr, setRestockServingsStr,
    isSplitEnabled, setIsSplitEnabled, splitFriendName, setSplitFriendName, splitFriendShareStr, setSplitFriendShareStr,
    isCategorySheetOpen, setIsCategorySheetOpen, isLocalSmsOpen, setIsLocalSmsOpen, isSaving,
    amountInputRef, activeCategories, activeAccounts, suggestedTags, selectedCategory, numericAmount, bridgeKind, dietPreview,
    activeSupplements, activeCommitments: commitments.filter((c) => c.isActive && !c.deletedAt),
    activeDebts: debtRecords.filter((d) => d.status === 'active' && !d.deletedAt),
    selectSupplement: (id: string) => { hasManuallyPickedSupplementRef.current = true; setSelectedSupplementId(id); },
    selectCategory: (id: string) => { hasManuallyPickedSupplementRef.current = false; setCategoryId(id); },
    setDefaultAccount: async (acc: FinanceAccount) => {
      await setDefaultAccount(acc.id);
      toast.success(`${acc.name} set as default Paid via`);
    },
    handleSubmit, handleDelete,
  };
}
