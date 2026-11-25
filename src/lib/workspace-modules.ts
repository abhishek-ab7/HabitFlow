import type { UserSettings } from './types';

export function isFitnessModuleEnabled(
  settings?: Pick<UserSettings, 'habitOnlyMode' | 'showFitness'> | null
): boolean {
  return !settings?.habitOnlyMode && settings?.showFitness !== false;
}

export function isFinanceModuleEnabled(
  settings?: Pick<UserSettings, 'habitOnlyMode' | 'showFinance'> | null
): boolean {
  return !settings?.habitOnlyMode && settings?.showFinance !== false;
}
