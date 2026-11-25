import type { UserSettings } from './types';

export function isFitnessModuleEnabled(
  settings?: Pick<UserSettings, 'habitOnlyMode' | 'showFitness'> | null
): boolean {
  return !settings?.habitOnlyMode && settings?.showFitness !== false;
}
