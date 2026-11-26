'use client';

import React from 'react';
import { LowEnergyBanner, FuelMacroAndStepsGrid } from './fuel/FuelTopMetricsSection';
import { FuelHydrationAndSleepStrip } from './fuel/FuelHydrationAndSleepStrip';
import { FuelStaplesGrid } from './fuel/FuelStaplesGrid';
import { FuelMealTimeline } from './fuel/FuelMealTimeline';
import { MealFormModal, StapleFormModal } from './fuel/FuelModals';
import { useFuelTabController } from './fuel/useFuelTabController';

interface FuelTabProps {
  selectedDate: string;
  userId: string;
}

export const FuelTab = React.memo(function FuelTab({ selectedDate, userId }: FuelTabProps) {
  const vm = useFuelTabController({ selectedDate, userId });

  return (
    <div className="space-y-5">
      <LowEnergyBanner
        lowEnergyMode={Boolean(vm.summary.lowEnergyMode)}
        stepsTarget={vm.summary.stepsTarget}
        calorieTarget={vm.summary.calorieTarget}
        onToggle={vm.handleToggleLowEnergy}
      />

      <FuelMacroAndStepsGrid
        caloriesRemaining={vm.summary.caloriesRemaining}
        caloriesConsumed={vm.summary.caloriesConsumed}
        calorieTarget={vm.summary.calorieTarget}
        caloriePct={vm.summary.caloriePct}
        lowEnergyMode={Boolean(vm.summary.lowEnergyMode)}
        proteinConsumedG={vm.summary.proteinConsumedG}
        proteinTargetG={vm.summary.proteinTargetG}
        proteinRemainingG={vm.summary.proteinRemainingG}
        proteinPct={vm.summary.proteinPct}
        steps={vm.summary.steps}
        stepsTarget={vm.summary.stepsTarget}
        stepsPct={vm.summary.stepsPct}
        onSaveExactSteps={vm.saveExactSteps}
        onAdd2kSteps={vm.add2kSteps}
      />

      <FuelHydrationAndSleepStrip
        waterMl={vm.summary.waterMl}
        waterTargetMl={vm.summary.waterTargetMl}
        waterPct={vm.summary.waterPct}
        sleepHours={vm.summary.sleepHours}
        energyLevel={vm.summary.energyLevel}
        onIncrementWater={vm.onIncrementWater}
        onSelectSleep={vm.onSelectSleep}
        onSelectEnergy={vm.onSelectEnergy}
      />

      <FuelStaplesGrid
        pinnedTemplates={vm.pinnedTemplates}
        portionMultiplier={vm.portionMultiplier}
        setPortionMultiplier={vm.setPortionMultiplier}
        onTapStaple={vm.handleTapStaple}
        onDeleteStaple={vm.onDeleteStaple}
        onOpenAddStaple={() => vm.setStapleModalOpen(true)}
      />

      <FuelMealTimeline
        selectedDate={selectedDate}
        dayMeals={vm.dayMeals}
        junkMealCount={vm.summary.junkMealCount}
        junkCalories={vm.summary.junkCalories}
        candidateTxByMealId={vm.candidateTxByMealId}
        onOpenAddMeal={vm.openAddMealModal}
        onEditMeal={vm.openEditMealModal}
        onDeleteMeal={vm.onDeleteMeal}
        onLinkMealTx={vm.onLinkMealTx}
      />

      <MealFormModal
        open={vm.mealModalOpen}
        onOpenChange={vm.setMealModalOpen}
        editingMeal={vm.editingMeal}
        mealForm={vm.mealForm}
        setMealForm={vm.setMealForm}
        paidOutside={vm.paidOutside}
        setPaidOutside={vm.setPaidOutside}
        paidAmountStr={vm.paidAmountStr}
        setPaidAmountStr={vm.setPaidAmountStr}
        paidAccountId={vm.paidAccountId}
        setPaidAccountId={vm.setPaidAccountId}
        activeFinanceAccounts={vm.activeFinanceAccounts}
        onAutoEstimate={vm.handleAutoEstimateMeal}
        onSubmit={vm.handleSaveMeal}
      />

      <StapleFormModal
        open={vm.stapleModalOpen}
        onOpenChange={vm.setStapleModalOpen}
        stapleForm={vm.stapleForm}
        setStapleForm={vm.setStapleForm}
        onSubmit={vm.handleSaveStaple}
      />
    </div>
  );
});
