import { create } from 'zustand';
import { getSupabaseClient } from '../supabase/client';

export interface LeaderboardEntry {
  user_id: string;
  user_name?: string;
  level: number;
  xp: number;
  avatar_id?: string;
  stats?: {
    vitality: number;
    intelligence: number;
    discipline: number;
    charisma: number;
    wealth: number;
    creativity: number;
  };
  updated_at?: string;
}

interface LeaderboardState {
  rankings: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  userRank: number | null;
  loadRankings: () => Promise<void>;
}

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  rankings: [],
  isLoading: false,
  error: null,
  userRank: null,

  loadRankings: async () => {
    set({ isLoading: true, error: null });

    const cacheKey = 'habitflow_leaderboard_cache';
    const supabase = getSupabaseClient();
    
    // Check if we are logged in
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    try {
      // 1. Fetch from Supabase leaderboard view
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .order('level', { ascending: false })
        .order('xp', { ascending: false });

      if (error) throw error;

      const entries = (data || []) as LeaderboardEntry[];
      
      // Calculate user's rank
      let userRank: number | null = null;
      if (currentUserId) {
        const index = entries.findIndex(entry => entry.user_id === currentUserId);
        userRank = index !== -1 ? index + 1 : null;
      }

      set({
        rankings: entries,
        userRank,
        isLoading: false,
      });

      // Save cache to localStorage
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          rankings: entries,
          userRank
        }));
      } catch (e) {
        console.warn('Failed to cache leaderboard to localStorage', e);
      }

    } catch (err: any) {
      console.error('Failed to load leaderboard from remote, attempting cache fallback:', err);
      
      // 2. Try cache fallback
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { rankings, userRank } = JSON.parse(cached);
          set({
            rankings,
            userRank,
            isLoading: false,
            error: 'Unable to connect to live rankings. Showing cached data.',
          });
          return;
        } catch (e) {
          console.error('Failed to parse cached leaderboard', e);
        }
      }

      set({
        isLoading: false,
        error: 'Leaderboard is currently unavailable. Please check your internet connection.',
      });
    }
  },
}));
