'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useFinanceStore } from '@/lib/stores/finance-store';
import { useFitnessStore } from '@/lib/stores/fitness';
import {
  classifyCategoryBridgeKind,
  executeFinanceFitnessBridge,
} from '@/lib/fitness/finance-bridge';
import {
  parseSmsOrNotificationBatch,
  type ParsedSmsExpense,
} from '@/lib/finance/sms-parser';
import { isFitnessModuleEnabled } from '@/lib/workspace-modules';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import {
  type BridgeSelection,
  buildCategorySelectionPatch,
  buildSmsBridgeArgs,
  buildSmsTransactionPayload,
  formatImportToastMessage,
  mapAiExpenseToParsedSms,
  resolveSmsBridgeCategory,
} from '@/lib/finance/sms-import-helpers';

async function fetchAiParsedExpense(
  trimmed: string,
  categories: ReturnType<typeof useFinanceStore.getState>['categories'],
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts']
): Promise<ParsedSmsExpense[]> {
  try {
    const res = await fetch('/api/ai/parse-expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawText: trimmed,
        categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, subcategories: c.subcategories })),
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const aiData = json?.data;
    if (!aiData || aiData.amount <= 0) return [];
    return [mapAiExpenseToParsedSms(trimmed, aiData, categories, accounts)];
  } catch {
    return [];
  }
}

async function runSmsFitnessBridge(params: {
  item: ParsedSmsExpense;
  fallbackCat: string;
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  createdTx: Awaited<ReturnType<ReturnType<typeof useFinanceStore.getState>['addTransaction']>>;
  itemBridge?: BridgeSelection;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
}): Promise<{ dietLogged: boolean; suppRestocked: boolean }> {
  const { item, fallbackCat, categories, createdTx, itemBridge, supplementInventory } = params;
  const bridgeKind = classifyCategoryBridgeKind(resolveSmsBridgeCategory(categories, item, fallbackCat));
  if (bridgeKind === 'none' || createdTx.type !== 'expense') {
    return { dietLogged: false, suppRestocked: false };
  }
  const res = await executeFinanceFitnessBridge(
    buildSmsBridgeArgs({ bridgeKind, item, createdTx, itemBridge, supplementInventory })
  );
  return {
    dietLogged: bridgeKind === 'junk' || Boolean(res.dietLogged),
    suppRestocked: Boolean(res.supplementRestocked),
  };
}

async function importSingleSmsItem(params: {
  item: ParsedSmsExpense;
  fallbackCat: string;
  fallbackAcc: string;
  sendToReviewInbox: boolean;
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  addTransaction: ReturnType<typeof useFinanceStore.getState>['addTransaction'];
  itemBridge?: BridgeSelection;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
}): Promise<{ reviewed: boolean; dietLogged: boolean; suppRestocked: boolean }> {
  const { item, fallbackCat, fallbackAcc, sendToReviewInbox, categories, addTransaction, itemBridge, supplementInventory } = params;
  const reviewed = sendToReviewInbox && !item.matchedRuleId;
  const createdTx = await addTransaction(buildSmsTransactionPayload({ item, fallbackCat, fallbackAcc, reviewed }));
  const bridged = await runSmsFitnessBridge({
    item, fallbackCat, categories, createdTx, itemBridge, supplementInventory,
  });
  return { reviewed, ...bridged };
}

async function readSmsClipboard(onParsed: (text: string) => Promise<void>) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    toast.error('Clipboard access is unavailable in this browser. Paste manually below.');
    return;
  }
  try {
    const clipText = await navigator.clipboard.readText();
    if (!clipText?.trim()) {
      toast.info('Clipboard is empty. Copy a bank SMS or notification first.');
      return;
    }
    await onParsed(clipText);
  } catch {
    toast.error('Clipboard permission denied. Paste the SMS text manually below.');
  }
}

function readSmsUploadedFile(file: File, onParsed: (text: string) => Promise<void>) {
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const content = String(ev.target?.result || '');
    if (!content.trim()) {
      toast.error('Selected file is empty');
      return;
    }
    await onParsed(content);
  };
  reader.readAsText(file);
}

async function executeSmsImportBatch(params: {
  selectedItems: ParsedSmsExpense[];
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  sendToReviewInbox: boolean;
  addTransaction: ReturnType<typeof useFinanceStore.getState>['addTransaction'];
  bridgeByItemId: Record<string, BridgeSelection>;
  supplementInventory: ReturnType<typeof useFitnessStore.getState>['supplementInventory'];
}) {
  const { selectedItems, categories, accounts, sendToReviewInbox, addTransaction, bridgeByItemId, supplementInventory } = params;
  const fallbackCat = categories[0]?.id || 'uncategorized';
  const fallbackAcc = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || 'default';
  const outcomes = await Promise.all(
    selectedItems.map((item) =>
      importSingleSmsItem({
        item, fallbackCat, fallbackAcc, sendToReviewInbox, categories, addTransaction,
        itemBridge: bridgeByItemId[item.id], supplementInventory,
      })
    )
  );
  return formatImportToastMessage({
    selectedCount: selectedItems.length,
    reviewQueued: outcomes.filter((o) => o.reviewed).length,
    dietBridged: outcomes.filter((o) => o.dietLogged).length,
    suppRestocked: outcomes.filter((o) => o.suppRestocked).length,
  });
}

async function copySmsDeepLink() {
  if (typeof window === 'undefined' || !navigator.clipboard?.writeText) return;
  const urlTemplate = `${window.location.origin}/finance?sms={notification_text}`;
  try {
    await navigator.clipboard.writeText(urlTemplate);
    toast.success('Copied deep-link URL template');
  } catch {
    toast.info(urlTemplate);
  }
}

async function runSmsParseBatch(params: {
  input: string;
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  transactions: ReturnType<typeof useFinanceStore.getState>['transactions'];
  categorizationRules: ReturnType<typeof useFinanceStore.getState>['categorizationRules'];
}): Promise<ParsedSmsExpense[]> {
  const trimmed = params.input.trim();
  const detected = parseSmsOrNotificationBatch(
    trimmed, params.categories, params.accounts, params.transactions, params.categorizationRules
  );
  if (detected.length === 0 && !trimmed.includes('\n')) {
    return fetchAiParsedExpense(trimmed, params.categories, params.accounts);
  }
  return detected;
}

function useHydrateSmsDependencies(params: {
  open: boolean;
  categoriesLength: number;
  fitnessHasLoaded: boolean;
  loadFinanceData: () => Promise<void>;
  loadFitnessData: () => Promise<void>;
}) {
  const { open, categoriesLength, fitnessHasLoaded, loadFinanceData, loadFitnessData } = params;
  useEffect(() => {
    if (open && categoriesLength === 0) void loadFinanceData();
    if (open && !fitnessHasLoaded) loadFitnessData().catch(() => undefined);
  }, [open, categoriesLength, loadFinanceData, fitnessHasLoaded, loadFitnessData]);
}

function useSmsModalSyncEffects(params: {
  open: boolean;
  initialText?: string | null;
  categoriesLength: number;
  fitnessHasLoaded: boolean;
  loadFinanceData: () => Promise<void>;
  loadFitnessData: () => Promise<void>;
  setEditingCategoryItemId: (id: string | null) => void;
  setRawText: (v: string) => void;
  setParsedItems: (v: ParsedSmsExpense[]) => void;
  setHasParsed: (v: boolean) => void;
  runParse: (input: string) => Promise<void>;
}) {
  const { open, initialText, setEditingCategoryItemId, setRawText, setParsedItems, setHasParsed, runParse } = params;
  useHydrateSmsDependencies(params);

  useEffect(() => {
    if (!open) {
      setEditingCategoryItemId(null);
      return;
    }
    if (initialText?.trim()) {
      setRawText(initialText);
      void runParse(initialText);
      return;
    }
    setRawText('');
    setParsedItems([]);
    setHasParsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialText]);
}

function useSmsStoreDependencies() {
  return {
    categories: useFinanceStore((s) => s.categories),
    accounts: useFinanceStore((s) => s.accounts),
    transactions: useFinanceStore((s) => s.transactions),
    categorizationRules: useFinanceStore((s) => s.categorizationRules),
    addTransaction: useFinanceStore((s) => s.addTransaction),
    loadFinanceData: useFinanceStore((s) => s.loadFinanceData),
    supplementInventory: useFitnessStore((s) => s.supplementInventory),
    isFitnessEnabled: isFitnessModuleEnabled(useGamificationStore((s) => s.settings)),
    fitnessHasLoaded: useFitnessStore((s) => s.hasLoaded),
    loadFitnessData: useFitnessStore((s) => s.loadFitnessData),
  };
}

export function useSmsImportController(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText?: string | null;
}) {
  const { open, onOpenChange, initialText } = params;
  const {
    categories, accounts, transactions, categorizationRules, addTransaction,
    loadFinanceData, supplementInventory, isFitnessEnabled, fitnessHasLoaded, loadFitnessData,
  } = useSmsStoreDependencies();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedSmsExpense[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showAutomationGuide, setShowAutomationGuide] = useState(false);
  const [editingCategoryItemId, setEditingCategoryItemId] = useState<string | null>(null);
  const [sendToReviewInbox, setSendToReviewInbox] = useState(true);
  const [bridgeByItemId, setBridgeByItemId] = useState<Record<string, BridgeSelection>>({});

  const runParse = async (input: string) => {
    if (!input.trim()) {
      setParsedItems([]);
      setHasParsed(false);
      return;
    }
    setIsParsing(true);
    try {
      const detected = await runSmsParseBatch({ input, categories, accounts, transactions, categorizationRules });
      setParsedItems(detected);
      setBridgeByItemId({});
      setHasParsed(true);
      if (detected.length === 0) toast.info('No bank or UPI expense amounts detected in that text');
    } finally {
      setIsParsing(false);
    }
  };

  useSmsModalSyncEffects({
    open, initialText, categoriesLength: categories.length, fitnessHasLoaded, loadFinanceData, loadFitnessData,
    setEditingCategoryItemId, setRawText, setParsedItems, setHasParsed, runParse,
  });

  const handleReadClipboard = () =>
    readSmsClipboard(async (text) => {
      setRawText(text);
      await runParse(text);
    });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readSmsUploadedFile(file, async (text) => {
      setRawText(text);
      await runParse(text);
    });
    e.target.value = '';
  };

  const updateItem = (id: string, patch: Partial<ParsedSmsExpense>) => {
    setParsedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleCategorySelectedForItem = (categoryId: string) => {
    if (!editingCategoryItemId) return;
    updateItem(
      editingCategoryItemId,
      buildCategorySelectionPatch({ categoryId, editingCategoryItemId, parsedItems, categories })
    );
  };

  const selectedItems = parsedItems.filter((item) => item.selected && item.amount > 0);

  const handleImportSelected = async () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one parsed expense to import');
      return;
    }
    setIsImporting(true);
    try {
      const msg = await executeSmsImportBatch({
        selectedItems, categories, accounts, sendToReviewInbox, addTransaction, bridgeByItemId, supplementInventory,
      });
      toast.success(msg);
      onOpenChange(false);
    } finally {
      setIsImporting(false);
    }
  };

  return {
    categories, accounts, supplementInventory, isFitnessEnabled,
    fileInputRef, rawText, setRawText, parsedItems, setParsedItems,
    hasParsed, isParsing, isImporting, showAutomationGuide, setShowAutomationGuide,
    editingCategoryItemId, setEditingCategoryItemId, sendToReviewInbox, setSendToReviewInbox,
    bridgeByItemId, setBridgeByItemId, selectedItems,
    editingCategoryItem: parsedItems.find((i) => i.id === editingCategoryItemId),
    runParse, handleReadClipboard, handleFileUpload, updateItem,
    handleCategorySelectedForItem, handleImportSelected, handleCopyDeepLink: copySmsDeepLink,
  };
}
