import type { EntityTable } from 'dexie';
import type { HabitCompletion } from '../types';

export function isNonCompletedSpecialState(completion: HabitCompletion): boolean {
  return (
    completion.status === 'rest' ||
    Boolean(completion.skipped) ||
    completion.status === 'frozen'
  );
}

export function isAutoRestNote(note?: string, restReason?: string): boolean {
  if (!note) return false;
  if (restReason && note === `Rest Day: ${restReason}`) return true;
  return /^Rest Day:\s*(Low-Energy|Recovery)/i.test(note);
}

export interface UpsertCompletionStateParams {
  completionsTable: EntityTable<HabitCompletion, 'id'>;
  existing: boolean;
  completion: HabitCompletion;
  applyUpdate: (completion: HabitCompletion, now: string, existing: boolean) => void;
  addIfMissing?: boolean;
}

export async function upsertCompletionState(
  params: UpsertCompletionStateParams
): Promise<HabitCompletion> {
  const now = new Date().toISOString();
  params.applyUpdate(params.completion, now, params.existing);
  params.completion.updatedAt = now;

  if (params.existing) {
    await params.completionsTable.update(params.completion.id, params.completion);
  } else if (params.addIfMissing !== false) {
    await params.completionsTable.add(params.completion);
  }

  return params.completion;
}
