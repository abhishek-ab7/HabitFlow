'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { calculateSupplementStockAndRoi } from '@/lib/fitness/shared-analytics';
import { useFitnessStore } from '@/lib/stores/fitness';
import { useFeedback } from '@/hooks/use-feedback';
import type { SupplementInventory, SupplementInventoryFormData } from '@/lib/types';

const DEFAULT_SUPPLEMENT_FORM: SupplementInventoryFormData = {
  name: '', brand: '', category: 'protein', unitLabel: 'scoop', totalServings: 30,
  dailyDosage: 1, costInr: 1299, proteinPerServingG: 24, anchorBlock: 'gym', lowStockThresholdDays: 7,
};

export function useSupplementsRoiController(params: { selectedDate: string; userId: string }) {
  const { selectedDate, userId } = params;
  const supplementInventory = useFitnessStore((s) => s.supplementInventory);
  const supplementLogs = useFitnessStore((s) => s.supplementLogs);
  const addSupplement = useFitnessStore((s) => s.addSupplement);
  const updateSupplement = useFitnessStore((s) => s.updateSupplement);
  const deleteSupplement = useFitnessStore((s) => s.deleteSupplement);
  const takeSupplementDose = useFitnessStore((s) => s.takeSupplementDose);
  const takeTodaySupplementStack = useFitnessStore((s) => s.takeTodaySupplementStack);
  const deleteSupplementLog = useFitnessStore((s) => s.deleteSupplementLog);
  const adjustSupplementStock = useFitnessStore((s) => s.adjustSupplementStock);
  const feedback = useFeedback();

  const summary = useMemo(
    () => calculateSupplementStockAndRoi(supplementInventory, supplementLogs, selectedDate),
    [supplementInventory, supplementLogs, selectedDate]
  );

  const logsForSelectedDate = useMemo(
    () => supplementLogs.filter((l) => !l.deletedAt && l.date.slice(0, 10) === selectedDate),
    [supplementLogs, selectedDate]
  );

  const untakenCount = useMemo(
    () => summary.items.filter((item) => !logsForSelectedDate.some((l) => l.supplementId === item.supplement.id)).length,
    [summary.items, logsForSelectedDate]
  );

  const maxBenchmarkCost = useMemo(
    () => Math.max(1, ...summary.proteinBenchmarks.map((b) => b.costPer25gProteinInr)),
    [summary.proteinBenchmarks]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupp, setEditingSupp] = useState<SupplementInventory | null>(null);
  const [form, setForm] = useState<SupplementInventoryFormData>(DEFAULT_SUPPLEMENT_FORM);
  const [exactAdjustSupp, setExactAdjustSupp] = useState<SupplementInventory | null>(null);
  const [exactStockVal, setExactStockVal] = useState<string>('30');

  const openAddModal = () => {
    setEditingSupp(null);
    setForm(DEFAULT_SUPPLEMENT_FORM);
    setModalOpen(true);
  };

  const openEditModal = (sup: SupplementInventory) => {
    setEditingSupp(sup);
    setForm({
      name: sup.name, brand: sup.brand || '', category: sup.category, unitLabel: sup.unitLabel,
      totalServings: sup.totalServings, dailyDosage: sup.dailyDosage, costInr: sup.costInr,
      proteinPerServingG: sup.proteinPerServingG ?? (sup.category === 'protein' ? 24 : null),
      anchorBlock: sup.anchorBlock ?? null, lowStockThresholdDays: sup.lowStockThresholdDays,
    });
    setModalOpen(true);
  };

  const handleSaveSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const proteinVal = form.proteinPerServingG && Number(form.proteinPerServingG) > 0 ? Number(form.proteinPerServingG) : null;
    const payload: SupplementInventoryFormData = {
      ...form, name: form.name.trim(), brand: form.brand?.trim() || null,
      anchorBlock: form.anchorBlock || null, proteinPerServingG: proteinVal,
    };

    feedback.success();
    if (editingSupp) {
      await updateSupplement(editingSupp.id, payload);
      toast.success(`Updated ${payload.name}`);
    } else {
      await addSupplement(payload, userId);
      toast.success(`Added ${payload.name} to inventory`);
    }
    setModalOpen(false);
  };

  const handleTakeTodayStack = async () => {
    feedback.complete();
    const created = await takeTodaySupplementStack(selectedDate, userId);
    if (created.length === 0) return void toast.info('All active supplements are already logged for today');
    toast.success(`Logged ${created.length} supplement${created.length > 1 ? 's' : ''} for today`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          for (const log of created) await deleteSupplementLog(log.id);
          toast.info('Reverted today’s stack log');
        },
      },
    });
  };

  const handleUndoAllToday = async () => {
    if (logsForSelectedDate.length === 0) return;
    for (const l of logsForSelectedDate) await deleteSupplementLog(l.id);
    toast.info(`Undid ${logsForSelectedDate.length} supplement log(s) for ${selectedDate}`);
  };

  const handleSaveExactStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exactAdjustSupp) return;
    const val = Math.max(0, Number(exactStockVal) || 0);
    await adjustSupplementStock(exactAdjustSupp.id, { targetRemaining: val });
    toast.success(`Adjusted ${exactAdjustSupp.name} stock to ${val}`);
    setExactAdjustSupp(null);
  };

  const handleUndoDose = async (logId: string) => {
    feedback.uncheck();
    await deleteSupplementLog(logId);
    toast.info('Undid supplement dose');
  };

  const handleTakeDose = async (sup: SupplementInventory) => {
    feedback.complete();
    const log = await takeSupplementDose(sup.id, sup.dailyDosage, selectedDate, null, userId);
    if (log) {
      toast.success(`Logged ${sup.name}`, { action: { label: 'Undo', onClick: () => deleteSupplementLog(log.id) } });
    }
  };

  return {
    summary, logsForSelectedDate, untakenCount, maxBenchmarkCost,
    modalOpen, setModalOpen, editingSupp, form, setForm,
    exactAdjustSupp, setExactAdjustSupp, exactStockVal, setExactStockVal,
    openAddModal, openEditModal, handleSaveSupplement, handleTakeTodayStack,
    handleUndoAllToday, handleSaveExactStock, handleUndoDose, handleTakeDose,
    deleteSupplement: (sup: SupplementInventory) => { deleteSupplement(sup.id); toast.success(`Removed ${sup.name}`); },
    adjustDelta: (supId: string, delta: number) => adjustSupplementStock(supId, { delta }),
  };
}
