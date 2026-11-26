/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import type { SyncLogFn } from './realtime-registrar';

export interface NetworkListenerCallbacks {
  onOnline: () => void;
  onOffline: () => void;
  canResumeSync: () => boolean;
  onResumeSync: () => void;
}

export function attachNetworkListeners(callbacks: NetworkListenerCallbacks): AbortController | null {
  if (typeof window === 'undefined') return null;

  const controller = new AbortController();
  const { signal } = controller;

  window.addEventListener('online', callbacks.onOnline, { signal });
  window.addEventListener('offline', callbacks.onOffline, { signal });

  const handleResume = () => {
    if (callbacks.canResumeSync()) {
      callbacks.onResumeSync();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'visible') {
          handleResume();
        }
      },
      { signal }
    );
  }

  window.addEventListener('focus', handleResume, { signal });
  return controller;
}

export async function migrateHabitArchivedProperty(
  userId: string,
  log: SyncLogFn
): Promise<void> {
  log('info', '🔧 Starting habit property migration...');
  try {
    const habits = await db.habits.where('userId').equals(userId).toArray();
    let fixedCount = 0;

    for (const habit of habits) {
      if (habit.archived === undefined || habit.archived === null) {
        await db.habits.update(habit.id, { archived: false });
        fixedCount++;
      }
    }

    log('info', `✅ Migration complete: Fixed ${fixedCount} habits`);
  } catch (error) {
    log('error', `❌ Migration failed: ${error}`);
  }
}

export async function initializeAuthSession(
  supabase: any,
  onAuthChange: (newUserId: string | null) => void,
  log: SyncLogFn
): Promise<{ userId: string | null; subscription: { unsubscribe: () => void } | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: unknown, nextSession: any) => {
      onAuthChange(nextSession?.user?.id || null);
    });

    return { userId, subscription };
  } catch (error) {
    log('error', 'Failed to setup auth', error);
    return { userId: null, subscription: null };
  }
}
