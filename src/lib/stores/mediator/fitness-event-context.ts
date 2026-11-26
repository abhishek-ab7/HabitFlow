import type { FitnessMediatorEvent } from './fitness-event-handler';

export interface FitnessEvalContext {
  profileProteinTarget: number;
  effectiveStepsTarget: number;
  proteinTodayG: number;
  allSupplementsTakenToday: boolean;
}

export async function isFitnessEnabled(): Promise<boolean> {
  try {
    const { useGamificationStore } = await import('../gamification-store');
    const { isFitnessModuleEnabled } = await import('../../workspace-modules');
    return isFitnessModuleEnabled(useGamificationStore.getState().settings);
  } catch {
    return true;
  }
}

async function computeProteinToday(normalizedDate: string): Promise<number> {
  const { useFitnessStore } = await import('../fitness');
  const { db } = await import('../../db');
  const fitState = useFitnessStore.getState();
  const meals = fitState.mealLogs.length
    ? fitState.mealLogs
    : await db?.mealLogs?.toArray() ?? [];

  return meals
    .filter((m) => !m.deletedAt && m.date.slice(0, 10) === normalizedDate)
    .reduce((sum, m) => sum + Math.max(0, Number(m.proteinG || 0)), 0);
}

async function loadSupplementInventoryAndLogs() {
  const { useFitnessStore } = await import('../fitness');
  const { db } = await import('../../db');
  const fitState = useFitnessStore.getState();

  const inventory = fitState.supplementInventory.length
    ? fitState.supplementInventory
    : await db?.supplementInventory?.toArray() ?? [];
  const logs = fitState.supplementLogs.length
    ? fitState.supplementLogs
    : await db?.supplementLogs?.toArray() ?? [];

  return { inventory, logs };
}

async function computeAllSupplementsTaken(normalizedDate: string): Promise<boolean> {
  const { inventory, logs } = await loadSupplementInventoryAndLogs();
  const activeSupps = inventory.filter((s) => !s.deletedAt && s.isActive);
  const logsToday = logs.filter((l) => !l.deletedAt && l.date.slice(0, 10) === normalizedDate);

  if (activeSupps.length === 0) return logsToday.length > 0;
  const takenIds = new Set(logsToday.map((l) => l.supplementId));
  return activeSupps.every((s) => takenIds.has(s.id));
}

function resolveStepsTarget(
  lowEnergyMode: boolean | undefined,
  profile: { lowEnergyStepsTarget?: number | null; stepsTarget?: number | null } | null | undefined
): number {
  const raw = lowEnergyMode
    ? Number(profile?.lowEnergyStepsTarget ?? 3500)
    : Number(profile?.stepsTarget ?? 8000);
  return Math.max(500, raw);
}

export async function loadFitnessEvalContext(
  eventType: FitnessMediatorEvent['type'],
  normalizedDate: string
): Promise<FitnessEvalContext> {
  const ctx: FitnessEvalContext = {
    profileProteinTarget: 130,
    effectiveStepsTarget: 8000,
    proteinTodayG: 0,
    allSupplementsTakenToday: false,
  };

  try {
    const { useFitnessStore } = await import('../fitness');
    const fitState = useFitnessStore.getState();

    if (fitState.profile?.proteinTargetG) {
      ctx.profileProteinTarget = fitState.profile.proteinTargetG;
    }

    const dayLog = fitState.dailyLogs.find(
      (d) => !d.deletedAt && d.date.slice(0, 10) === normalizedDate
    );
    ctx.effectiveStepsTarget = resolveStepsTarget(dayLog?.lowEnergyMode, fitState.profile);

    if (eventType === 'MEAL_LOGGED') {
      ctx.proteinTodayG = await computeProteinToday(normalizedDate);
    } else if (eventType === 'SUPPLEMENTS_TAKEN') {
      ctx.allSupplementsTakenToday = await computeAllSupplementsTaken(normalizedDate);
    }
  } catch {
    // Optional in isolated unit tests
  }

  return ctx;
}
