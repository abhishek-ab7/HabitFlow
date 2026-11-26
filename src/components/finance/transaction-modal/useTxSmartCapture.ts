'use client';

import { useState, useRef } from 'react';
import type { FinanceAccount, FinanceCategory, FinanceTransactionType } from '@/lib/types';
import { toast } from 'sonner';
import type { ScannedDraftItem, SpeechRecognitionLike } from './tx-modal-types';
import { requestNlpExpenseParse, scanReceiptImagesRequest, type NlpParsedExpense } from './tx-capture-service';

const PARSED_TYPE_SET = new Set<FinanceTransactionType>(['expense', 'income', 'investment', 'transfer']);

function resolveParsedTxType(raw?: string): FinanceTransactionType {
  if (raw && PARSED_TYPE_SET.has(raw as FinanceTransactionType)) return raw as FinanceTransactionType;
  return 'expense';
}

function getSpeechRecConstructor() {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function startVoiceSession(params: {
  onTranscript: (text: string) => void;
  onStop: () => void;
}): SpeechRecognitionLike | null {
  const SpeechRecCtor = getSpeechRecConstructor();
  if (!SpeechRecCtor) {
    toast.error('Voice capture is not supported in this browser. Type in the smart bar instead.');
    return null;
  }
  const recognition = new SpeechRecCtor();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
    if (transcript) params.onTranscript(transcript);
  };
  recognition.onerror = () => {
    params.onStop();
    toast.error('Could not capture voice audio. Check microphone permissions.');
  };
  recognition.onend = params.onStop;
  recognition.start();
  toast.info('Listening... Say e.g. "Paid 420 for Swiggy dinner via UPI"');
  return recognition;
}

async function saveBatchItemsToInbox(params: {
  chosen: ScannedDraftItem[];
  activeCategories: FinanceCategory[];
  activeAccounts: FinanceAccount[];
  addTransaction: (data: Record<string, unknown>) => Promise<unknown>;
}) {
  const { chosen, activeCategories, activeAccounts, addTransaction } = params;
  const fallbackCat = activeCategories[0]?.id || 'uncategorized';
  const fallbackAcc = activeAccounts[0]?.id || 'default';
  for (const item of chosen) {
    await addTransaction({
      title: item.title, merchantName: item.merchantName, amount: item.amount, type: item.type,
      categoryId: item.categoryId || fallbackCat, accountId: item.accountId || fallbackAcc,
      date: item.date, notes: item.notes, tags: item.tags, needsReview: true,
    });
  }
}

interface CaptureFormSetters {
  setType: React.Dispatch<React.SetStateAction<FinanceTransactionType>>;
  setAmountStr: React.Dispatch<React.SetStateAction<string>>;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setCategoryId: React.Dispatch<React.SetStateAction<string>>;
  setAccountId: React.Dispatch<React.SetStateAction<string>>;
  setDate: React.Dispatch<React.SetStateAction<string>>;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  setShowMoreOptions: React.Dispatch<React.SetStateAction<boolean>>;
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
}

function applyParsedNlpToForm(params: {
  parsed: NlpParsedExpense;
  clean: string;
  activeCategories: FinanceCategory[];
  activeAccounts: FinanceAccount[];
  applyCategorizationRules: (title: string) => { categoryId?: string };
  setters: CaptureFormSetters;
}) {
  const { parsed, clean, activeCategories, activeAccounts, applyCategorizationRules, setters } = params;
  const nextTitle = parsed.merchantName || parsed.title || clean;
  setters.setType(resolveParsedTxType(parsed.type));
  setters.setAmountStr(String(parsed.amount));
  setters.setTitle(nextTitle);
  if (parsed.date) setters.setDate(parsed.date);
  if (parsed.notes) setters.setNotes(parsed.notes);

  const ruleMatch = applyCategorizationRules(nextTitle);
  const matchedCat = parsed.categorySlug ? activeCategories.find((c) => c.slug === parsed.categorySlug) : undefined;
  if (ruleMatch.categoryId || matchedCat) setters.setCategoryId(ruleMatch.categoryId || matchedCat!.id);

  const matchedAcc = parsed.paymentMethodType ? activeAccounts.find((a) => a.type === parsed.paymentMethodType) : undefined;
  if (matchedAcc) setters.setAccountId(matchedAcc.id);

  if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
    const cleanedTags = parsed.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
    setters.setTags((prev) => Array.from(new Set([...prev, ...cleanedTags])));
  }
}

function hydrateSingleReceiptToForm(single: ScannedDraftItem, setters: CaptureFormSetters) {
  setters.setType(single.type);
  setters.setAmountStr(String(single.amount));
  setters.setTitle(single.merchantName || single.title);
  setters.setCategoryId(single.categoryId);
  setters.setAccountId(single.accountId);
  setters.setDate(single.date);
  if (single.notes) {
    setters.setNotes(single.notes);
    setters.setShowMoreOptions(true);
  }
  if (single.tags) setters.setTags((prev) => Array.from(new Set([...prev, ...single.tags!])));
  toast.success('Receipt scanned and filled');
}

export function useTxSmartCapture(params: {
  activeCategories: FinanceCategory[];
  activeAccounts: FinanceAccount[];
  todayStr: string;
  applyCategorizationRules: (title: string) => { categoryId?: string; tags?: string[] };
  addTransaction: (data: Record<string, unknown>) => Promise<unknown>;
  onCloseModal: () => void;
  setType: React.Dispatch<React.SetStateAction<FinanceTransactionType>>;
  setAmountStr: React.Dispatch<React.SetStateAction<string>>;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setCategoryId: React.Dispatch<React.SetStateAction<string>>;
  setAccountId: React.Dispatch<React.SetStateAction<string>>;
  setDate: React.Dispatch<React.SetStateAction<string>>;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  setShowMoreOptions: React.Dispatch<React.SetStateAction<boolean>>;
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const {
    activeCategories, activeAccounts, todayStr, applyCategorizationRules, addTransaction, onCloseModal,
    setType, setAmountStr, setTitle, setCategoryId, setAccountId, setDate, setNotes, setShowMoreOptions, setTags,
  } = params;
  const setters: CaptureFormSetters = { setType, setAmountStr, setTitle, setCategoryId, setAccountId, setDate, setNotes, setShowMoreOptions, setTags };

  const [nlpInput, setNlpInput] = useState('');
  const [isNlpParsing, setIsNlpParsing] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [isScanningReceipts, setIsScanningReceipts] = useState(false);
  const [scannedBatch, setScannedBatch] = useState<ScannedDraftItem[]>([]);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const runNlpParse = async (textToParse: string) => {
    const clean = textToParse.trim();
    if (!clean) return;
    setIsNlpParsing(true);
    try {
      const { parsed, source, error } = await requestNlpExpenseParse({ rawText: clean, categories: activeCategories });
      if (error) return void toast.error(error);
      if (!parsed?.amount) return void toast.info('No clear amount detected in that phrase');
      applyParsedNlpToForm({ parsed, clean, activeCategories, activeAccounts, applyCategorizationRules, setters });
      toast.success(source === 'gemini' ? 'Form filled via Gemini AI' : 'Form filled via Smart Offline Parser');
    } catch {
      toast.error('Smart parse failed. Enter details manually.');
    } finally {
      setIsNlpParsing(false);
    }
  };

  const handleToggleVoice = () => {
    if (isListeningVoice) {
      recognitionRef.current?.stop();
      return void setIsListeningVoice(false);
    }
    try {
      const rec = startVoiceSession({
        onTranscript: (text) => { setNlpInput(text); void runNlpParse(text); },
        onStop: () => setIsListeningVoice(false),
      });
      if (!rec) return;
      recognitionRef.current = rec;
      setIsListeningVoice(true);
    } catch {
      setIsListeningVoice(false);
      toast.error('Failed to start voice capture');
    }
  };

  const handleReceiptFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []).slice(0, 5);
    e.target.value = '';
    if (fileList.length === 0) return;

    setIsScanningReceipts(true);
    try {
      const res = await scanReceiptImagesRequest({
        fileList,
        categories: activeCategories,
        accounts: activeAccounts,
        todayStr,
        applyCategorizationRules,
      });
      if (res.error) return void toast.error(res.error);
      if (res.info) return void toast.info(res.info);
      if (res.items.length === 1) hydrateSingleReceiptToForm(res.items[0], setters);
      else {
        setScannedBatch(res.items);
        toast.success(`Scanned ${res.items.length} receipts — review & save below`);
      }
    } catch {
      toast.error('Receipt scan failed. Please try a clearer image.');
    } finally {
      setIsScanningReceipts(false);
    }
  };

  const handleSaveScannedBatch = async () => {
    const chosen = scannedBatch.filter((i) => i.selected && i.amount > 0);
    if (chosen.length === 0) return void toast.error('Select at least one scanned receipt');
    setIsSavingBatch(true);
    try {
      await saveBatchItemsToInbox({ chosen, activeCategories, activeAccounts, addTransaction });
      toast.success(`Saved ${chosen.length} scanned receipts to Review Inbox`);
      setScannedBatch([]);
      onCloseModal();
    } finally {
      setIsSavingBatch(false);
    }
  };

  return {
    nlpInput, setNlpInput, isNlpParsing, runNlpParse,
    isListeningVoice, handleToggleVoice, recognitionRef,
    isScanningReceipts, receiptInputRef, handleReceiptFilesSelected,
    scannedBatch, setScannedBatch, isSavingBatch, handleSaveScannedBatch,
  };
}
