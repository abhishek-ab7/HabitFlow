import { create } from 'zustand';
import { getMoodLogs, setMoodLog } from '../db';
import { getSupabaseClient } from '../supabase/client';
import { getSyncEngine } from '../sync';
import type { MoodLog, MoodType } from '../types';

interface MoodState {
  moodLogs: MoodLog[];
  isLoading: boolean;
  loadedRange: { start: string; end: string; userId: string } | null;
  error: string | null;

  // Actions
  loadMoodLogs: (startDate: string, endDate: string, force?: boolean) => Promise<void>;
  logMood: (date: string, mood: MoodType) => Promise<void>;
  getMoodForDate: (date: string) => MoodType | undefined;
}

export type IsoDateString = string;
export type UserIdentifier = string | null;

type LoadedRange = { start: IsoDateString; end: IsoDateString; userId: string } | null;

function isMoodRangeCached(loadedRange: LoadedRange, uid: string, startDate: IsoDateString, endDate: IsoDateString) {
  if (!loadedRange || loadedRange.userId !== uid) return false;
  return startDate >= loadedRange.start && endDate <= loadedRange.end;
}

function resolveMoodUnionRange(loadedRange: LoadedRange, uid: string, startDate: IsoDateString, endDate: IsoDateString) {
  if (!loadedRange || loadedRange.userId !== uid) return { unionStart: startDate, unionEnd: endDate };
  return {
    unionStart: loadedRange.start < startDate ? loadedRange.start : startDate,
    unionEnd: loadedRange.end > endDate ? loadedRange.end : endDate,
  };
}

export const useMoodStore = create<MoodState>((set, get) => ({
  moodLogs: [],
  isLoading: false,
  loadedRange: null,
  error: null,

  loadMoodLogs: async (startDate: string, endDate: string, force = false) => {
    const state = get();
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;

      if (!uid) {
        set({ moodLogs: [], isLoading: false, loadedRange: null });
        return;
      }

      if (!force && isMoodRangeCached(state.loadedRange, uid, startDate, endDate)) {
        return;
      }

      const { unionStart, unionEnd } = resolveMoodUnionRange(state.loadedRange, uid, startDate, endDate);

      if (!state.loadedRange) {
        set({ isLoading: true, error: null });
      }

      const logs = await getMoodLogs(uid, unionStart, unionEnd);
      set({
        moodLogs: logs,
        isLoading: false,
        loadedRange: { start: unionStart, end: unionEnd, userId: uid },
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  logMood: async (date: string, mood: MoodType) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");

    const result = await setMoodLog(session.user.id, date, mood);

    set(state => {
      const filtered = state.moodLogs.filter(l => l.date !== date);
      return { moodLogs: [...filtered, result] };
    });

    // Sync to cloud
    try {
      const syncEngine = getSyncEngine();
      await syncEngine.pushMoodLog(result);
    } catch (error) {
      console.error('Failed to sync mood log:', error);
    }
  },

  getMoodForDate: (date: string) => {
    return get().moodLogs.find(l => l.date === date)?.mood;
  }
}));
