'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type {
  FinanceTransaction,
  FinanceTransactionType,
  CommitmentContributionType,
} from '@/lib/types';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  MessageSquareText,
  Users,
  Sparkles,
  Mic,
  MicOff,
  Camera,
  Tag,
  Plus,
  Repeat,
  Split,
  Check,
  Loader2,
  Send,
  Star,
  CreditCard,
  Utensils,
  Pill,
} from 'lucide-react';
import { resolveTransactionCycle, getCycleWindowForMonth, getLocalIsoDate, formatShortDate } from '@/lib/finance/credit-card-cycles';
import { useFitnessStore } from '@/lib/stores/fitness';
import {
  classifyCategoryBridgeKind,
  estimateDietBridgePreview,
  executeFinanceFitnessBridge,
  findMatchingSupplementId,
} from '@/lib/fitness/finance-bridge';
import { CategoryIcon } from './CategoryIcon';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { SmsImportModal } from './SmsImportModal';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTransaction?: FinanceTransaction | null;
  defaultCommitmentId?: string | null;
  defaultDebtId?: string | null;
  onOpenSmsImport?: () => void;
}

interface SplitRow {
  id: string;
  categoryId: string;
  amountStr: string;
  note: string;
}

interface ScannedDraftItem {
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

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function readFileAsBase64(file: File): Promise<{ data: string; mimeType: string; fileName: string }> {
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

export function AddTransactionModal({
  open,
  onOpenChange,
  editingTransaction,
  defaultCommitmentId,
  defaultDebtId,
  onOpenSmsImport,
}: AddTransactionModalProps) {
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const commitments = useFinanceStore((s) => s.commitments);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addSplitTransactions = useFinanceStore((s) => s.addSplitTransactions);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const splitTransactionWithFriend = useFinanceStore(
    (s) => s.splitTransactionWithFriend
  );
  const applyCategorizationRules = useFinanceStore(
    (s) => s.applyCategorizationRules
  );
  const addRecurringBill = useFinanceStore((s) => s.addRecurringBill);
  const setDefaultAccount = useFinanceStore((s) => s.setDefaultAccount);
  const loadFinanceData = useFinanceStore((s) => s.loadFinanceData);
  const supplementInventory = useFitnessStore((s) => s.supplementInventory);
  const fitnessHasLoaded = useFitnessStore((s) => s.hasLoaded);
  const loadFitnessData = useFitnessStore((s) => s.loadFitnessData);

  const todayStr = getLocalIsoDate();

  const [type, setType] = useState<FinanceTransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayStr);
  const [linkedCommitmentId, setLinkedCommitmentId] = useState<string>('none');
  const [commitmentContributionType, setCommitmentContributionType] =
    useState<CommitmentContributionType>('offset_expense');
  const [linkedDebtId, setLinkedDebtId] = useState<string>('none');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Multi-Category Split state
  const [isCategorySplitEnabled, setIsCategorySplitEnabled] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);

  // Recurring Bill toggle state
  const [isRecurringEnabled, setIsRecurringEnabled] = useState(false);
  const [recurringCadence, setRecurringCadence] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [recurringDueDay, setRecurringDueDay] = useState<string>(
    String(new Date().getDate())
  );

  // Smart Capture (NLP + Voice + Receipt OCR) state
  const [nlpInput, setNlpInput] = useState('');
  const [isNlpParsing, setIsNlpParsing] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [isScanningReceipts, setIsScanningReceipts] = useState(false);
  const [scannedBatch, setScannedBatch] = useState<ScannedDraftItem[]>([]);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Finance <-> Diet & Supplement Bridge state
  const [alsoLogToDiet, setAlsoLogToDiet] = useState(false);
  const [dietCaloriesOverride, setDietCaloriesOverride] = useState<string>('');
  const [dietProteinOverride, setDietProteinOverride] = useState<string>('');
  const [restockSupplementEnabled, setRestockSupplementEnabled] = useState(false);
  const [selectedSupplementId, setSelectedSupplementId] = useState<string>('__new__');
  const [restockServingsStr, setRestockServingsStr] = useState<string>('30');

  const amountInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const initializedSessionRef = useRef<string | null>(null);
  const hasManuallyPickedSupplementRef = useRef(false);

  // Split with Friend state
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splitFriendName, setSplitFriendName] = useState('');
  const [splitFriendShareStr, setSplitFriendShareStr] = useState('');

  const { user } = useAuth();
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isLocalSmsOpen, setIsLocalSmsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.deletedAt),
    [categories]
  );
  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.deletedAt),
    [accounts]
  );

  const suggestedTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.deletedAt || !tx.tags) continue;
      for (const raw of tx.tags) {
        const clean = raw.trim().toLowerCase();
        if (!clean || clean.startsWith('ref:') || clean === 'sms-import') continue;
        counts.set(clean, (counts.get(clean) || 0) + 1);
      }
    }
    const defaults = ['work', 'reimbursable', 'travel', 'family', 'self-care'];
    for (const d of defaults) {
      if (!counts.has(d)) counts.set(d, 0);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [transactions]);

  useEffect(() => {
    if (open && categories.length === 0) {
      loadFinanceData(user?.id);
    }
    if (open && !fitnessHasLoaded) {
      loadFitnessData(user?.id).catch(() => undefined);
    }
  }, [open, categories.length, loadFinanceData, fitnessHasLoaded, loadFitnessData, user?.id]);

  useEffect(() => {
    if (!open) {
      initializedSessionRef.current = null;
      setIsCategorySheetOpen(false);
      recognitionRef.current?.stop();
      setIsListeningVoice(false);
      return;
    }

    const sessionKey =
      editingTransaction?.id || `new:${defaultCommitmentId || ''}:${defaultDebtId || ''}`;
    if (initializedSessionRef.current === sessionKey) {
      return;
    }
    if (!editingTransaction && activeCategories.length === 0 && activeAccounts.length === 0) {
      return;
    }
    initializedSessionRef.current = sessionKey;

    const focusTimer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 80);

    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr(editingTransaction.amount ? String(editingTransaction.amount) : '');
      setCategoryId(editingTransaction.categoryId);
      setAccountId(editingTransaction.accountId);
      setToAccountId(editingTransaction.toAccountId || '');
      setTitle(editingTransaction.title);
      setNotes(editingTransaction.notes || '');
      setDate(editingTransaction.date);
      setTags(editingTransaction.tags || []);
      setTagInput('');
      setLinkedCommitmentId(editingTransaction.linkedCommitmentId || 'none');
      setCommitmentContributionType(
        editingTransaction.commitmentContributionType || 'offset_expense'
      );
      setLinkedDebtId(editingTransaction.linkedDebtId || 'none');
      setShowMoreOptions(
        Boolean(
          editingTransaction.linkedCommitmentId ||
            editingTransaction.linkedDebtId ||
            editingTransaction.notes
        )
      );
      setIsSplitEnabled(false);
      setIsCategorySplitEnabled(false);
      setSplitRows([]);
      setIsRecurringEnabled(false);
      setNlpInput('');
      setScannedBatch([]);
      setAlsoLogToDiet(false);
      setDietCaloriesOverride('');
      setDietProteinOverride('');
      setRestockSupplementEnabled(false);
      setSelectedSupplementId('__new__');
      setRestockServingsStr('30');
      hasManuallyPickedSupplementRef.current = false;
      return () => clearTimeout(focusTimer);
    }

    const defaultCat = activeCategories[0];
    const defaultAcc = activeAccounts.find((a) => a.isDefault) || activeAccounts[0];
    const secondAcc =
      activeAccounts.find((a) => a.id !== defaultAcc?.id) || activeAccounts[0];

    setType('expense');
    setAmountStr('');
    setCategoryId(defaultCat?.id || '');
    setAccountId(defaultAcc?.id || '');
    setToAccountId(secondAcc?.id || '');
    setTitle('');
    setNotes('');
    setDate(todayStr);
    setTags([]);
    setTagInput('');
    setLinkedCommitmentId(defaultCommitmentId || 'none');
    setCommitmentContributionType('offset_expense');
    setLinkedDebtId(defaultDebtId || 'none');
    setShowMoreOptions(Boolean(defaultCommitmentId || defaultDebtId));
    setIsSplitEnabled(false);
    setSplitFriendName('');
    setSplitFriendShareStr('');
    setIsCategorySplitEnabled(false);
    setSplitRows([]);
    setIsRecurringEnabled(false);
    setRecurringCadence('monthly');
    setRecurringDueDay(String(new Date().getDate()));
    setNlpInput('');
    setScannedBatch([]);
    setAlsoLogToDiet(false);
    setDietCaloriesOverride('');
    setDietProteinOverride('');
    setRestockSupplementEnabled(false);
    setSelectedSupplementId('__new__');
    setRestockServingsStr('30');
    hasManuallyPickedSupplementRef.current = false;

    return () => clearTimeout(focusTimer);
  }, [
    open,
    editingTransaction,
    defaultCommitmentId,
    defaultDebtId,
    activeCategories,
    activeAccounts,
    todayStr,
  ]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingTransaction && val.trim().length >= 3) {
      const matched = applyCategorizationRules(val);
      if (matched.categoryId) {
        setCategoryId(matched.categoryId);
      }
      if (matched.tags && matched.tags.length > 0) {
        setTags((prev) => Array.from(new Set([...prev, ...matched.tags!])));
      }
    }
  };

  // NLP Quick-Parse handler
  const runNlpParse = async (textToParse: string) => {
    const clean = textToParse.trim();
    if (!clean) return;
    setIsNlpParsing(true);
    try {
      const res = await fetch('/api/ai/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: clean,
          categories: activeCategories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            subcategories: c.subcategories,
          })),
        }),
      });
      if (!res.ok) {
        toast.error('Could not parse that text. Try entering amount & item.');
        return;
      }
      const json = await res.json();
      const parsed = json?.data;
      if (!parsed || !parsed.amount) {
        toast.info('No clear amount detected in that phrase');
        return;
      }

      if (parsed.type === 'income' || parsed.type === 'investment' || parsed.type === 'transfer') {
        setType(parsed.type);
      } else {
        setType('expense');
      }
      setAmountStr(String(parsed.amount));
      const nextTitle = parsed.merchantName || parsed.title || clean;
      setTitle(nextTitle);
      if (parsed.date) setDate(parsed.date);
      if (parsed.notes) setNotes(parsed.notes);

      const ruleMatch = applyCategorizationRules(nextTitle);
      if (ruleMatch.categoryId) {
        setCategoryId(ruleMatch.categoryId);
      } else if (parsed.categorySlug) {
        const matchedCat = activeCategories.find((c) => c.slug === parsed.categorySlug);
        if (matchedCat) setCategoryId(matchedCat.id);
      }

      if (parsed.paymentMethodType) {
        const matchedAcc = activeAccounts.find((a) => a.type === parsed.paymentMethodType);
        if (matchedAcc) setAccountId(matchedAcc.id);
      }

      if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
        setTags((prev) =>
          Array.from(
            new Set([
              ...prev,
              ...parsed.tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean),
            ])
          )
        );
      }

      toast.success(
        json?.source === 'gemini'
          ? 'Form filled via Gemini AI'
          : 'Form filled via Smart Offline Parser'
      );
    } catch {
      toast.error('Smart parse failed. Enter details manually.');
    } finally {
      setIsNlpParsing(false);
    }
  };

  // Voice-to-Expense handler using Web Speech API
  const handleToggleVoice = () => {
    if (isListeningVoice) {
      recognitionRef.current?.stop();
      setIsListeningVoice(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      toast.error('Voice capture is not supported in this browser. Type in the smart bar instead.');
      return;
    }

    try {
      const recognition = new SpeechRecCtor();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript.trim()) {
          setNlpInput(transcript.trim());
          runNlpParse(transcript.trim());
        }
      };
      recognition.onerror = () => {
        setIsListeningVoice(false);
        toast.error('Could not capture voice audio. Check microphone permissions.');
      };
      recognition.onend = () => {
        setIsListeningVoice(false);
      };
      recognitionRef.current = recognition;
      setIsListeningVoice(true);
      recognition.start();
      toast.info('Listening... Say e.g. "Paid 420 for Swiggy dinner via UPI"');
    } catch {
      setIsListeningVoice(false);
      toast.error('Failed to start voice capture');
    }
  };

  // Receipt / UPI Screenshot OCR (1 to 5 images)
  const handleReceiptFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []).slice(0, 5);
    e.target.value = '';
    if (fileList.length === 0) return;

    setIsScanningReceipts(true);
    try {
      const images = await Promise.all(fileList.map(readFileAsBase64));
      const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          categories: activeCategories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Could not scan receipt images');
        return;
      }

      const json = await res.json();
      const items = Array.isArray(json?.items) ? json.items : [];
      if (items.length === 0) {
        toast.info('No readable expense totals found in the uploaded images');
        return;
      }

      const defaultCatId = activeCategories[0]?.id || '';
      const defaultAccId =
        activeAccounts.find((a) => a.isDefault)?.id || activeAccounts[0]?.id || '';

      const mapped: ScannedDraftItem[] = items
        .filter((it: { amount?: number }) => Number(it.amount) > 0)
        .map(
          (
            it: {
              title?: string;
              merchantName?: string;
              amount: number;
              type?: 'expense' | 'income';
              categorySlug?: string;
              paymentMethodType?: string;
              date?: string;
              notes?: string;
              tags?: string[];
            },
            idx: number
          ) => {
            const name = it.merchantName || it.title || 'Scanned Receipt';
            const ruleMatch = applyCategorizationRules(name);
            const catBySlug = activeCategories.find((c) => c.slug === it.categorySlug);
            const accByMethod = activeAccounts.find(
              (a) => a.type === it.paymentMethodType
            );
            return {
              id: crypto.randomUUID(),
              selected: true,
              title: it.title || name,
              merchantName: name,
              amount: Number(it.amount),
              type: it.type === 'income' ? 'income' : 'expense',
              categoryId: ruleMatch.categoryId || catBySlug?.id || defaultCatId,
              accountId: accByMethod?.id || defaultAccId,
              date: it.date || todayStr,
              notes: it.notes,
              tags: Array.from(new Set(['receipt-scan', ...(it.tags || [])])),
              fileName: fileList[idx]?.name,
            };
          }
        );

      if (mapped.length === 0) {
        toast.info('No valid amounts extracted from images');
        return;
      }

      // Single image hydrates the form directly; 2-5 images open batch checklist
      if (mapped.length === 1) {
        const single = mapped[0];
        setType(single.type);
        setAmountStr(String(single.amount));
        setTitle(single.merchantName || single.title);
        setCategoryId(single.categoryId);
        setAccountId(single.accountId);
        setDate(single.date);
        if (single.notes) {
          setNotes(single.notes);
          setShowMoreOptions(true);
        }
        if (single.tags) {
          setTags((prev) => Array.from(new Set([...prev, ...single.tags!])));
        }
        toast.success('Receipt scanned and filled');
      } else {
        setScannedBatch(mapped);
        toast.success(`Scanned ${mapped.length} receipts — review & save below`);
      }
    } catch {
      toast.error('Receipt scan failed. Please try a clearer image.');
    } finally {
      setIsScanningReceipts(false);
    }
  };

  const handleSaveScannedBatch = async () => {
    const chosen = scannedBatch.filter((i) => i.selected && i.amount > 0);
    if (chosen.length === 0) {
      toast.error('Select at least one scanned receipt');
      return;
    }
    setIsSavingBatch(true);
    try {
      for (const item of chosen) {
        await addTransaction({
          title: item.title,
          merchantName: item.merchantName,
          amount: item.amount,
          type: item.type,
          categoryId: item.categoryId || activeCategories[0]?.id || 'uncategorized',
          accountId: item.accountId || activeAccounts[0]?.id || 'default',
          date: item.date,
          notes: item.notes,
          tags: item.tags,
          needsReview: true,
        });
      }
      toast.success(`Saved ${chosen.length} scanned receipts to Review Inbox`);
      setScannedBatch([]);
      onOpenChange(false);
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Tag helpers
  const addTagChip = (raw: string) => {
    const clean = raw.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  };

  const removeTagChip = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const selectedCategory =
    activeCategories.find((c) => c.id === categoryId) || activeCategories[0];
  const numericAmount = parseFloat(amountStr) || 0;
  const bridgeKind =
    !editingTransaction && type === 'expense' && !isCategorySplitEnabled
      ? classifyCategoryBridgeKind(selectedCategory)
      : 'none';
  const dietPreview = useMemo(
    () =>
      estimateDietBridgePreview(
        title,
        numericAmount,
        bridgeKind === 'junk'
      ),
    [title, numericAmount, bridgeKind]
  );
  const activeSupplements = useMemo(
    () => supplementInventory.filter((s) => !s.deletedAt && s.isActive),
    [supplementInventory]
  );

  useEffect(() => {
    if (bridgeKind === 'health_supplements' && !hasManuallyPickedSupplementRef.current) {
      setSelectedSupplementId(findMatchingSupplementId(title, supplementInventory));
    }
  }, [bridgeKind, title, supplementInventory]);

  // Multi-Category Split helpers
  const toggleCategorySplit = () => {
    const next = !isCategorySplitEnabled;
    setIsCategorySplitEnabled(next);
    if (next) {
      setIsSplitEnabled(false); // Mutually exclusive with friend split
      const cat1 = categoryId || activeCategories[0]?.id || '';
      const cat2 =
        activeCategories.find((c) => c.id !== cat1)?.id || cat1;
      const half = numericAmount > 0 ? Math.round((numericAmount / 2) * 100) / 100 : 0;
      const rest = numericAmount > 0 ? Math.round((numericAmount - half) * 100) / 100 : 0;
      setSplitRows([
        { id: crypto.randomUUID(), categoryId: cat1, amountStr: half ? String(half) : '', note: '' },
        { id: crypto.randomUUID(), categoryId: cat2, amountStr: rest ? String(rest) : '', note: '' },
      ]);
    } else {
      setSplitRows([]);
    }
  };

  const splitSum = useMemo(
    () => splitRows.reduce((acc, r) => acc + (parseFloat(r.amountStr) || 0), 0),
    [splitRows]
  );
  const splitRemaining = Math.round((numericAmount - splitSum) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const fallbackCat = activeCategories[0]?.id || 'uncategorized';
    const fallbackAcc = activeAccounts[0]?.id || 'default';
    const resolvedCategoryId = categoryId || fallbackCat;
    const resolvedAccountId = accountId || fallbackAcc;

    const autoTitle =
      title.trim() ||
      (type === 'transfer'
        ? 'Account Transfer'
        : type === 'income'
        ? 'Income'
        : type === 'investment'
        ? 'Investment / SIP'
        : selectedCategory?.name || 'Expense');

    setIsSaving(true);
    try {
      // Create recurring bill template if toggled on for new expenses
      if (!editingTransaction && type === 'expense' && isRecurringEnabled) {
        const parsedDue = Math.min(31, Math.max(1, parseInt(recurringDueDay, 10) || 1));
        await addRecurringBill({
          name: autoTitle,
          amount: numericAmount,
          categoryId: resolvedCategoryId,
          accountId: resolvedAccountId,
          cadence: recurringCadence,
          dueDayOfMonth: parsedDue,
          autoLog: false,
          isActive: true,
          color: '#06b6d4',
          icon: 'Repeat',
        });
      }

      // Multi-Category Split path
      if (!editingTransaction && type === 'expense' && isCategorySplitEnabled) {
        const validRows = splitRows.filter((r) => (parseFloat(r.amountStr) || 0) > 0);
        if (validRows.length < 2) {
          toast.error('Add at least 2 category rows with valid amounts');
          return;
        }
        if (Math.abs(splitRemaining) > 0.01) {
          toast.error(
            `Split amounts must equal ${formatINR(numericAmount)} (${formatINR(
              Math.abs(splitRemaining)
            )} ${splitRemaining > 0 ? 'remaining' : 'over'})`
          );
          return;
        }

        await addSplitTransactions({
          base: {
            title: autoTitle,
            merchantName: title.trim() || undefined,
            type: 'expense',
            accountId: resolvedAccountId,
            date,
            notes: notes.trim() || undefined,
            tags: tags.length > 0 ? tags : undefined,
          },
          splits: validRows.map((r) => ({
            categoryId: r.categoryId || fallbackCat,
            amount: parseFloat(r.amountStr),
            note: r.note.trim() || undefined,
          })),
        });
        toast.success(`Saved ${validRows.length}-way split (${formatINR(numericAmount)})`);
        onOpenChange(false);
        return;
      }

      // Friend Split path
      if (
        !editingTransaction &&
        type === 'expense' &&
        isSplitEnabled &&
        splitFriendName.trim()
      ) {
        const parsedFriendShare = parseFloat(splitFriendShareStr);
        const friendShare =
          !isNaN(parsedFriendShare) && splitFriendShareStr.trim() !== ''
            ? Math.max(0, parsedFriendShare)
            : Math.round(numericAmount / 2);
        const myShare = Math.max(0, numericAmount - friendShare);
        await splitTransactionWithFriend({
          txData: {
            title: autoTitle,
            amount: numericAmount,
            type: 'expense',
            categoryId: resolvedCategoryId,
            accountId: resolvedAccountId,
            date,
            notes: notes.trim() || undefined,
            tags: tags.length > 0 ? tags : undefined,
          },
          friendName: splitFriendName.trim(),
          friendShareAmount: friendShare,
          existingDebtId: linkedDebtId && linkedDebtId !== 'none' ? linkedDebtId : undefined,
        });
        toast.success(
          `Logged your share (${formatINR(myShare)}) & added ${formatINR(
            friendShare
          )} to ${splitFriendName.trim()}'s Friends Ledger`
        );
        onOpenChange(false);
        return;
      }

      const payload = {
        title: autoTitle,
        merchantName: title.trim() || undefined,
        amount: numericAmount,
        type,
        categoryId: resolvedCategoryId,
        accountId: resolvedAccountId,
        toAccountId: type === 'transfer' ? toAccountId || undefined : undefined,
        date,
        notes: notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        needsReview: false,
        linkedCommitmentId:
          linkedCommitmentId !== 'none' ? linkedCommitmentId : null,
        commitmentContributionType:
          linkedCommitmentId !== 'none' ? commitmentContributionType : null,
        linkedDebtId: linkedDebtId !== 'none' ? linkedDebtId : null,
      };

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload);
        toast.success('Updated entry');
      } else {
        const createdTx = await addTransaction(payload);
        const bridgeResult = await executeFinanceFitnessBridge({
          bridgeKind,
          transaction: createdTx,
          userId: user?.id,
          alsoLogToDiet,
          dietCalories: dietCaloriesOverride ? Number(dietCaloriesOverride) : undefined,
          dietProteinG: dietProteinOverride ? Number(dietProteinOverride) : undefined,
          restockSupplement: restockSupplementEnabled,
          supplementId: selectedSupplementId,
          restockServings: Number(restockServingsStr) || 30,
          newSupplementName: title.trim() || undefined,
        });

        if (isRecurringEnabled) {
          toast.success('Saved entry & added recurring bill reminder');
        } else if (bridgeKind === 'junk') {
          toast.success('Junk Food logged to Finance + Diet automatically');
        } else if (bridgeResult.dietLogged) {
          toast.success('Saved expense & logged meal to Diet');
        } else if (bridgeResult.supplementRestocked) {
          toast.success(
            `Saved expense & restocked ${bridgeResult.supplementRestocked}`
          );
        } else if (linkedCommitmentId !== 'none') {
          toast.success('Saved and linked to commitment');
        } else {
          toast.success(
            type === 'income'
              ? 'Income logged'
              : type === 'investment'
              ? 'Investment logged'
              : 'Expense saved'
          );
        }
      }
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    await deleteTransaction(editingTransaction.id);
    toast.success('Transaction deleted');
    onOpenChange(false);
  };

  const activeCommitments = commitments.filter((c) => c.isActive && !c.deletedAt);
  const activeDebts = debtRecords.filter((d) => d.status === 'active' && !d.deletedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-full sm:max-w-[470px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col border-border bg-background"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header with 4-Type Switcher */}
        <div className="px-4 pt-2 pb-3 border-b border-border/60 bg-card flex items-center justify-between gap-2 shrink-0">
          <DialogTitle className="sr-only">
            {editingTransaction ? 'Edit Transaction' : 'Quick Add Transaction'}
          </DialogTitle>

          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted flex-1">
            {(
              [
                { id: 'expense', label: 'Expense' },
                { id: 'income', label: 'Income' },
                { id: 'investment', label: 'Invest' },
                { id: 'transfer', label: 'Transfer' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setType(t.id);
                  if (t.id !== 'expense') {
                    setIsCategorySplitEnabled(false);
                    setIsSplitEnabled(false);
                    setIsRecurringEnabled(false);
                  }
                }}
                className={`min-h-[38px] px-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  type === t.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!editingTransaction && (
            <button
              type="button"
              onClick={() => {
                if (onOpenSmsImport) {
                  onOpenSmsImport();
                } else {
                  onOpenChange(false);
                  setIsLocalSmsOpen(true);
                }
              }}
              aria-label="Fetch from SMS or Notification"
              title="Fetch from SMS or Notification"
              className="min-h-[42px] px-2.5 flex items-center justify-center gap-1 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-primary transition-colors shrink-0"
            >
              <MessageSquareText className="w-4 h-4" />
              <span className="hidden sm:inline">SMS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Sheet Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-4 py-3 space-y-3.5">
            {/* Smart Capture Bar (NLP + Voice + Multi-Receipt OCR) for New Entries */}
            {!editingTransaction && (
              <div className="rounded-xl border border-border bg-card p-2 space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={nlpInput}
                      onChange={(e) => setNlpInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          runNlpParse(nlpInput);
                        }
                      }}
                      placeholder='Smart fill: "380 Swiggy lunch UPI"'
                      aria-label="Smart natural language expense capture"
                      className="w-full h-9 pl-8 pr-2 rounded-lg bg-muted/40 border border-transparent focus:border-primary/50 focus:bg-background text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors"
                    />
                  </div>

                  {nlpInput.trim().length > 0 && (
                    <button
                      type="button"
                      disabled={isNlpParsing}
                      onClick={() => runNlpParse(nlpInput)}
                      aria-label="Parse natural language expense"
                      className="h-9 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      {isNlpParsing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    aria-label={isListeningVoice ? 'Stop voice input' : 'Voice to expense'}
                    title="Voice to Expense"
                    className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      isListeningVoice
                        ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : 'border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isListeningVoice ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isScanningReceipts}
                    onClick={() => receiptInputRef.current?.click()}
                    aria-label="Scan receipt or UPI screenshot"
                    title="Scan 1–5 Receipts or UPI Screenshots"
                    className="h-9 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1 shrink-0 transition-colors"
                  >
                    {isScanningReceipts ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-primary" />
                    )}
                    <span className="hidden sm:inline">Scan</span>
                  </button>
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleReceiptFilesSelected}
                    className="hidden"
                  />
                </div>

                {/* Batch Receipt OCR Review Checklist (when 2-5 images scanned) */}
                {scannedBatch.length > 0 && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        Scanned {scannedBatch.length} receipts · Review batch
                      </span>
                      <button
                        type="button"
                        onClick={() => setScannedBatch([])}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Discard
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {scannedBatch.map((item) => {
                        const cat = activeCategories.find((c) => c.id === item.categoryId);
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-background border border-border px-2.5 py-1.5 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setScannedBatch((prev) =>
                                  prev.map((x) =>
                                    x.id === item.id ? { ...x, selected: !x.selected } : x
                                  )
                                )
                              }
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                item.selected
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-input bg-background'
                              }`}
                            >
                              {item.selected && <Check className="w-3 h-3" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground truncate">
                                {item.merchantName}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {cat?.name || 'General'} · {item.date}
                              </p>
                            </div>
                            <span className="font-mono tabular-nums font-bold text-foreground shrink-0">
                              {formatINR(item.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingBatch}
                      onClick={handleSaveScannedBatch}
                      className="w-full h-9 rounded-lg text-xs font-semibold"
                    >
                      {isSavingBatch
                        ? 'Saving batch...'
                        : `Save ${scannedBatch.filter((i) => i.selected).length} to Review Inbox`}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Hero Amount Input */}
            <div
              className="text-center py-1 px-4 cursor-text"
              onClick={() => amountInputRef.current?.focus()}
            >
              <div className="inline-flex items-center justify-center gap-1.5 max-w-full">
                <span className="text-3xl sm:text-4xl font-semibold text-muted-foreground select-none">
                  ₹
                </span>
                <input
                  ref={amountInputRef}
                  id="tx-amount-input"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={amountStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                      setAmountStr(val);
                    }
                  }}
                  placeholder="0"
                  autoFocus
                  className={`w-full max-w-[260px] text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight text-center bg-transparent border-b-2 border-transparent hover:border-border/60 focus:border-primary outline-none focus:outline-none transition-colors ${
                    type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : type === 'investment'
                      ? 'text-violet-600 dark:text-violet-400'
                      : 'text-foreground'
                  }`}
                  aria-label="Transaction Amount in Rupees"
                />
              </div>
            </div>

            {/* Description + Clickable Category Picker Row */}
            {type !== 'transfer' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2.5 items-end">
                  <div className={isCategorySplitEnabled ? 'col-span-12 space-y-1' : 'col-span-7 space-y-1'}>
                    <label
                      htmlFor="tx-description"
                      className="text-xs font-medium text-muted-foreground block"
                    >
                      Merchant or Description
                    </label>
                    <Input
                      id="tx-description"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder={
                        type === 'investment'
                          ? 'e.g. Nifty 50 Index SIP'
                          : 'e.g. Swiggy, Uber, Grocery'
                      }
                      className="h-11 text-sm rounded-xl"
                    />
                  </div>

                  {!isCategorySplitEnabled && (
                    <div className="col-span-5 space-y-1">
                      <span className="text-xs font-medium text-muted-foreground block">
                        Category
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCategorySheetOpen(true)}
                        className="w-full h-11 px-2.5 rounded-xl border border-input bg-card hover:bg-muted/60 flex items-center justify-between gap-1.5 text-left transition-colors"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              borderWidth: '1.5px',
                              borderStyle: 'solid',
                              borderColor: `${selectedCategory?.color || '#64748b'}80`,
                              backgroundColor: `${selectedCategory?.color || '#64748b'}15`,
                              color: selectedCategory?.color || 'currentColor',
                            }}
                          >
                            <CategoryIcon
                              name={selectedCategory?.icon}
                              className="w-3.5 h-3.5"
                            />
                          </span>
                          <span className="text-xs font-medium text-foreground truncate">
                            {selectedCategory?.name || 'Select'}
                          </span>
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Finance <-> Diet & Supplement Bridge Chip */}
                {bridgeKind !== 'none' && (
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-2.5">
                    {bridgeKind === 'junk' && (
                      <div
                        data-testid="junk-auto-diet-badge"
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-300">
                          <Utensils className="w-3.5 h-3.5 shrink-0" />
                          Auto-logs ~{dietPreview.calories} kcal ({dietPreview.proteinG}g P) to Diet as Junk Food
                        </span>
                      </div>
                    )}

                    {bridgeKind === 'food_dining' && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          data-testid="food-diet-bridge-chip"
                          onClick={() => setAlsoLogToDiet((v) => !v)}
                          aria-pressed={alsoLogToDiet}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                            alsoLogToDiet
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                              : 'bg-background border-border text-foreground hover:bg-muted'
                          }`}
                        >
                          <Utensils className="w-3.5 h-3.5" />
                          {alsoLogToDiet
                            ? `Logging ~${dietCaloriesOverride || dietPreview.calories} kcal to Diet`
                            : `Also log ~${dietPreview.calories} kcal to Diet`}
                        </button>

                        {alsoLogToDiet && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-[11px] text-muted-foreground">
                                Calories (kcal)
                              </label>
                              <Input
                                type="number"
                                min="0"
                                value={dietCaloriesOverride}
                                onChange={(e) => setDietCaloriesOverride(e.target.value)}
                                placeholder={String(dietPreview.calories)}
                                className="h-8 text-xs mt-0.5"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground">
                                Protein (g)
                              </label>
                              <Input
                                type="number"
                                min="0"
                                value={dietProteinOverride}
                                onChange={(e) => setDietProteinOverride(e.target.value)}
                                placeholder={String(dietPreview.proteinG)}
                                className="h-8 text-xs mt-0.5"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {bridgeKind === 'health_supplements' && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          data-testid="supplement-restock-bridge-chip"
                          onClick={() => setRestockSupplementEnabled((v) => !v)}
                          aria-pressed={restockSupplementEnabled}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                            restockSupplementEnabled
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                              : 'bg-background border-border text-foreground hover:bg-muted'
                          }`}
                        >
                          <Pill className="w-3.5 h-3.5" />
                          {restockSupplementEnabled
                            ? 'Restocking Supplement on Save'
                            : 'Restock Supplement'}
                        </button>

                        {restockSupplementEnabled && (
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <div className="col-span-2">
                              <label className="text-[11px] text-muted-foreground">
                                Target Supplement
                              </label>
                              <select
                                value={selectedSupplementId}
                                onChange={(e) => {
                                  hasManuallyPickedSupplementRef.current = true;
                                  setSelectedSupplementId(e.target.value);
                                }}
                                aria-label="Target Supplement"
                                className="h-8 w-full mt-0.5 rounded-md border border-input bg-background px-2 text-xs"
                              >
                                {activeSupplements.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.remainingServings} left)
                                  </option>
                                ))}
                                <option value="__new__">
                                  + Create new ({title.trim() || 'from title'})
                                </option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground">
                                Servings
                              </label>
                              <Input
                                type="number"
                                min="1"
                                value={restockServingsStr}
                                onChange={(e) => setRestockServingsStr(e.target.value)}
                                aria-label="Restock Servings"
                                className="h-8 text-xs mt-0.5"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    To Account
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-swipe">
                    {activeAccounts.map((acc) => {
                      const isSelected = toAccountId === acc.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setToAccountId(acc.id)}
                          className={`shrink-0 min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {acc.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Transfer note (optional)"
                    className="h-10 text-sm rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Payment Account Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {type === 'transfer' ? 'From Account' : 'Paid via'}
                </span>
                {type !== 'transfer' && accountId && (() => {
                  const selectedAcc = activeAccounts.find((a) => a.id === accountId);
                  if (!selectedAcc) return null;
                  if (selectedAcc.isDefault) {
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <Star className="w-3 h-3 fill-primary" />
                        Default payment method
                      </span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={async () => {
                        await setDefaultAccount(selectedAcc.id);
                        toast.success(`${selectedAcc.name} set as default Paid via`);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <Star className="w-3 h-3" />
                      Set {selectedAcc.name} as default
                    </button>
                  );
                })()}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {activeAccounts.map((acc) => {
                  const isSelected = accountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setAccountId(acc.id)}
                      className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 truncate ${
                        isSelected
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-card text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      <span className="truncate">{acc.name}</span>
                      {acc.isDefault && (
                        <Star
                          aria-label="Default account"
                          className={`w-3 h-3 shrink-0 ${
                            isSelected ? 'fill-background text-background' : 'fill-primary text-primary'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Credit Card Cycle Preview */}
              {(() => {
                const selectedAcc = activeAccounts.find((a) => a.id === accountId);
                if (selectedAcc?.type === 'credit_card') {
                  const bDay = selectedAcc.billingDay ?? selectedAcc.statementDay ?? 1;
                  const dDay = selectedAcc.dueDay ?? 20;
                  const txDate = date || getLocalIsoDate();
                  const cycleKey = resolveTransactionCycle(txDate, bDay, dDay);
                  const [y, m] = cycleKey.split('-').map(Number);
                  const cycleWin = getCycleWindowForMonth(bDay, dDay, y, m - 1, selectedAcc.gracePeriodDays);
                  return (
                    <div className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary">
                      <CreditCard className="w-3.5 h-3.5 shrink-0 text-primary" />
                      <span>
                        Bill Cycle: <strong className="text-foreground">{formatShortDate(cycleWin.periodEnd)}</strong> · Due on{' '}
                        <strong className="text-warning">{formatShortDate(cycleWin.dueDate)}</strong>
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Interactive Tags Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Tags
                </span>
                {tags.length > 0 && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {tags.length} added
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => removeTagChip(tag)}
                    className="h-7 px-2.5 rounded-full bg-primary/10 text-primary text-xs font-medium inline-flex items-center gap-1 hover:bg-primary/20 transition-colors"
                  >
                    <span>#{tag}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTagChip(tagInput);
                      }
                    }}
                    placeholder="+ Add tag"
                    aria-label="Add tag"
                    className="h-7 w-24 px-2 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                  {tagInput.trim() && (
                    <button
                      type="button"
                      onClick={() => addTagChip(tagInput)}
                      className="h-7 px-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-semibold"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestedTags
                  .filter((t) => !tags.includes(t))
                  .slice(0, 5)
                  .map((sugg) => (
                    <button
                      key={sugg}
                      type="button"
                      onClick={() => addTagChip(sugg)}
                      className="h-6 px-2 rounded-md border border-border/70 bg-muted/30 hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      +{sugg}
                    </button>
                  ))}
              </div>
            </div>

            {/* Expense Power Toggles: Multi-Category Split, Friend Split, Make Recurring */}
            {!editingTransaction && type === 'expense' && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={toggleCategorySplit}
                    className={`min-h-[38px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      isCategorySplitEnabled
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>Split Cats</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !isSplitEnabled;
                      setIsSplitEnabled(next);
                      if (next) {
                        setIsCategorySplitEnabled(false);
                        setSplitRows([]);
                        if (numericAmount > 0 && !splitFriendShareStr) {
                          setSplitFriendShareStr(String(Math.round(numericAmount / 2)));
                        }
                      }
                    }}
                    className={`min-h-[38px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      isSplitEnabled
                        ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Friend Split</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRecurringEnabled((v) => !v)}
                    className={`min-h-[38px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      isRecurringEnabled
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Recurring</span>
                  </button>
                </div>

                {/* Multi-Category Split Editor */}
                {isCategorySplitEnabled && (
                  <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        Split across categories
                      </span>
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          Math.abs(splitRemaining) <= 0.01
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {Math.abs(splitRemaining) <= 0.01
                          ? 'Balanced ₹0'
                          : splitRemaining > 0
                          ? `Remaining ${formatINR(splitRemaining)}`
                          : `Over by ${formatINR(Math.abs(splitRemaining))}`}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {splitRows.map((row, idx) => (
                        <div key={row.id} className="grid grid-cols-12 gap-1.5 items-center">
                          <select
                            aria-label={`Split category ${idx + 1}`}
                            value={row.categoryId}
                            onChange={(e) =>
                              setSplitRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, categoryId: e.target.value } : r
                                )
                              )
                            }
                            className="col-span-7 h-9 px-2 text-xs rounded-lg border border-input bg-background text-foreground"
                          >
                            {activeCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={row.amountStr}
                            onChange={(e) =>
                              setSplitRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, amountStr: e.target.value } : r
                                )
                              )
                            }
                            placeholder="₹0"
                            aria-label={`Split amount ${idx + 1}`}
                            className="col-span-4 h-9 text-xs font-mono tabular-nums text-right rounded-lg"
                          />

                          <button
                            type="button"
                            disabled={splitRows.length <= 2}
                            onClick={() =>
                              setSplitRows((prev) => prev.filter((r) => r.id !== row.id))
                            }
                            aria-label="Remove split row"
                            className="col-span-1 h-9 flex items-center justify-center text-muted-foreground hover:text-rose-500 disabled:opacity-30"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSplitRows((prev) => [
                          ...prev,
                          {
                            id: crypto.randomUUID(),
                            categoryId: activeCategories[0]?.id || '',
                            amountStr: splitRemaining > 0 ? String(splitRemaining) : '',
                            note: '',
                          },
                        ])
                      }
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add category row
                    </button>
                  </div>
                )}

                {/* Friend Split Drawer */}
                {isSplitEnabled && (
                  <div className="rounded-xl border border-sky-500/30 bg-card p-3 space-y-2.5">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7">
                        <Input
                          value={splitFriendName}
                          onChange={(e) => setSplitFriendName(e.target.value)}
                          placeholder="Friend's name (e.g. Rahul)"
                          list="existing-friends-list"
                          className="h-9 text-xs rounded-lg"
                        />
                        <datalist id="existing-friends-list">
                          {activeDebts.map((d) => (
                            <option key={d.id} value={d.personName} />
                          ))}
                        </datalist>
                      </div>
                      <div className="col-span-5">
                        <Input
                          type="number"
                          min="1"
                          value={splitFriendShareStr}
                          onChange={(e) => setSplitFriendShareStr(e.target.value)}
                          placeholder="Friend owes ₹"
                          className="h-9 text-xs font-mono tabular-nums rounded-lg"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                      You pay{' '}
                      <strong className="text-foreground">
                        {formatINR(
                          Math.max(
                            0,
                            numericAmount -
                              (!isNaN(parseFloat(splitFriendShareStr)) && splitFriendShareStr.trim() !== ''
                                ? Math.max(0, parseFloat(splitFriendShareStr))
                                : Math.round(numericAmount / 2))
                          )
                        )}
                      </strong>{' '}
                      ({categories.find((c) => c.id === categoryId)?.name || 'Category'}), Friend owes{' '}
                      <strong className="text-sky-600 dark:text-sky-400">
                        {formatINR(
                          !isNaN(parseFloat(splitFriendShareStr)) && splitFriendShareStr.trim() !== ''
                            ? Math.max(0, parseFloat(splitFriendShareStr))
                            : Math.round(numericAmount / 2)
                        )}
                      </strong>
                      {accounts.find((a) => a.id === accountId)?.type === 'credit_card' && (
                        <span> (Credit Card swipe: {formatINR(numericAmount)})</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Make Recurring Bill Config */}
                {isRecurringEnabled && (
                  <div className="rounded-xl border border-emerald-500/30 bg-card p-3 grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="tx-rec-cadence"
                        className="text-[11px] font-medium text-muted-foreground block"
                      >
                        Cadence
                      </label>
                      <select
                        id="tx-rec-cadence"
                        value={recurringCadence}
                        onChange={(e) =>
                          setRecurringCadence(
                            e.target.value as 'monthly' | 'quarterly' | 'yearly'
                          )
                        }
                        className="w-full h-9 px-2.5 text-xs rounded-lg border border-input bg-background text-foreground"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="tx-rec-day"
                        className="text-[11px] font-medium text-muted-foreground block"
                      >
                        Due Day (1–31)
                      </label>
                      <Input
                        id="tx-rec-day"
                        type="number"
                        min="1"
                        max="31"
                        value={recurringDueDay}
                        onChange={(e) => setRecurringDueDay(e.target.value)}
                        className="h-9 text-xs font-mono tabular-nums rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Date, Notes & Commitment/Friend Linking */}
            <div>
              <button
                type="button"
                onClick={() => setShowMoreOptions((v) => !v)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-border/70 bg-muted/30 flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>
                  {linkedCommitmentId !== 'none' || linkedDebtId !== 'none' || notes.trim()
                    ? 'Date, Notes & Links · Configured'
                    : 'Date, Notes, Commitment or Friend Link'}
                </span>
                {showMoreOptions ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showMoreOptions && (
                <div className="mt-2 p-3 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="tx-date"
                        className="text-xs font-medium text-muted-foreground block"
                      >
                        Date
                      </label>
                      <Input
                        id="tx-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="h-10 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="tx-notes"
                        className="text-xs font-medium text-muted-foreground block"
                      >
                        Notes
                      </label>
                      <Input
                        id="tx-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional memo"
                        className="h-10 text-xs"
                      />
                    </div>
                  </div>

                  {type === 'expense' && activeCommitments.length > 0 && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="tx-commitment"
                        className="text-xs font-medium text-muted-foreground block"
                      >
                        Deduct from Monthly Commitment
                      </label>
                      <select
                        id="tx-commitment"
                        value={linkedCommitmentId}
                        onChange={(e) => setLinkedCommitmentId(e.target.value)}
                        className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background"
                      >
                        <option value="none">None</option>
                        {activeCommitments.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.recipientName})
                          </option>
                        ))}
                      </select>

                      {linkedCommitmentId !== 'none' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCommitmentContributionType('offset_expense')
                            }
                            className={`min-h-[38px] px-2 text-xs font-medium rounded-lg border ${
                              commitmentContributionType === 'offset_expense'
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border'
                            }`}
                          >
                            Offset Purchase
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCommitmentContributionType('direct_payment')
                            }
                            className={`min-h-[38px] px-2 text-xs font-medium rounded-lg border ${
                              commitmentContributionType === 'direct_payment'
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border'
                            }`}
                          >
                            Direct Transfer
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeDebts.length > 0 && (
                    <div className="space-y-1">
                      <label
                        htmlFor="tx-debt"
                        className="text-xs font-medium text-muted-foreground block"
                      >
                        Link to Friend Debt
                      </label>
                      <select
                        id="tx-debt"
                        value={linkedDebtId}
                        onChange={(e) => setLinkedDebtId(e.target.value)}
                        className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background"
                      >
                        <option value="none">None</option>
                        {activeDebts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.personName} - {d.title} [{d.bucketType === 'everyday_split' ? 'Everyday' : 'Loan'}] ({d.direction === 'borrowed' ? 'I owe' : 'Owes me'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="px-4 py-3 border-t border-border bg-background flex items-center gap-2 shrink-0">
            {editingTransaction && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                aria-label="Delete transaction"
                className="h-11 w-11 shrink-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full h-11 rounded-xl text-sm font-semibold"
            >
              {isSaving
                ? 'Saving...'
                : editingTransaction
                ? 'Update Entry'
                : isCategorySplitEnabled
                ? `Save ${splitRows.length}-Way Category Split`
                : isSplitEnabled && splitFriendName.trim()
                ? 'Save & Split with Friend'
                : isRecurringEnabled
                ? 'Save Entry & Recurring Bill'
                : 'Save Entry'}
            </Button>
          </div>
        </form>
      </DialogContent>

      <CategoryPickerSheet
        open={isCategorySheetOpen}
        onOpenChange={setIsCategorySheetOpen}
        selectedCategoryId={categoryId || selectedCategory?.id || ''}
        onSelectCategory={(id) => {
          hasManuallyPickedSupplementRef.current = false;
          setCategoryId(id);
        }}
      />

      {!onOpenSmsImport && (
        <SmsImportModal
          open={isLocalSmsOpen}
          onOpenChange={setIsLocalSmsOpen}
        />
      )}
    </Dialog>
  );
}
