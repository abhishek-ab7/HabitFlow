import { create } from 'zustand';
import { getMoodLogs, setMoodLog } from '../db';
import { getSupabaseClient } from '../supabase/client';
import { getSyncEngine } from '../sync';
import type { MoodLog, MoodType } from '../types';

interface MoodState {
  moodLogs: MoodLog[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadMoodLogs: (startDate: string, endDate: string) => Promise<void>;
  logMood: (date: string, mood: MoodType) => Promise<void>;
  getMoodForDate: (date: string) => MoodType | undefined;
}

export const useMoodStore = create<MoodState>((set, get) => ({
  moodLogs: [],
  isLoading: false,
  error: null,

  loadMoodLogs: async (startDate: string, endDate: string) => {
    set({ isLoading: true, error: null });
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        set({ moodLogs: [], isLoading: false });
        return;
      }

      const logs = await getMoodLogs(session.user.id, startDate, endDate);
      set({ moodLogs: logs, isLoading: false });
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
