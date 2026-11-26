/* eslint-disable @typescript-eslint/no-explicit-any */
export type SyncLogFn = (level: 'info' | 'warn' | 'error', message: string, data?: any) => void;

const REALTIME_TABLES = [
  'habits',
  'completions',
  'goals',
  'tasks',
  'milestones',
  'user_settings',
  'mood_logs',
  'credit_card_statements',
  'finance_net_worth_snapshots',
  'finance_transactions',
  'finance_accounts',
  'finance_categories',
  'monthly_commitments',
  'debt_records',
  'debt_installments',
  'emi_trackers',
  'finance_budgets',
  'finance_sip_plans',
  'finance_categorization_rules',
  'finance_recurring_bills',
  'fitness_profiles',
  'fitness_daily_logs',
  'meal_templates',
  'meal_logs',
  'workout_sessions',
  'supplement_inventory',
  'supplement_logs',
] as const;

const FINANCE_EXTRA_TABLES = new Set([
  'monthly_commitments',
  'debt_records',
  'debt_installments',
  'emi_trackers',
  'credit_card_statements',
]);

const FITNESS_EXTRA_TABLES = new Set([
  'meal_templates',
  'meal_logs',
  'workout_sessions',
  'supplement_inventory',
  'supplement_logs',
]);

export function isFinanceRealtimeTable(tableName: string): boolean {
  return tableName.startsWith('finance_') || FINANCE_EXTRA_TABLES.has(tableName);
}

export function isFitnessRealtimeTable(tableName: string): boolean {
  return tableName.startsWith('fitness_') || FITNESS_EXTRA_TABLES.has(tableName);
}

export interface SubscribeRealtimeParams {
  supabase: any;
  userId: string;
  onTableChange: (table: string) => void;
  onStatus: (status: string) => void;
}

export function subscribeRealtimeTables(params: SubscribeRealtimeParams) {
  let channel = params.supabase.channel('db-changes');
  const filter = `user_id=eq.${params.userId}`;

  for (const table of REALTIME_TABLES) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      () => params.onTableChange(table)
    );
  }

  return channel.subscribe(params.onStatus);
}

export async function reloadRealtimeStores(
  flags: { hasFinanceChange: boolean; hasFitnessChange: boolean },
  userId: string | null,
  log: SyncLogFn
): Promise<void> {
  if (flags.hasFinanceChange) {
    try {
      const { useFinanceStore } = await import('@/lib/stores/finance-store');
      await useFinanceStore.getState().loadFinanceData(userId || undefined, true);
    } catch (e) {
      log('warn', 'Failed to reload finance store after realtime sync', e);
    }
  }

  if (flags.hasFitnessChange) {
    try {
      const { useFitnessStore } = await import('@/lib/stores/fitness');
      await useFitnessStore.getState().loadFitnessData(userId || undefined, true);
    } catch (e) {
      log('warn', 'Failed to reload fitness store after realtime sync', e);
    }
  }
}
