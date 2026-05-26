import { create } from 'zustand';
import { useHabitStore } from './habit-store';
import { useTaskStore } from './task-store';
import { useMoodStore } from './mood-store';
import { useGamificationStore } from './gamification-store';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'streaks' | 'tasks' | 'journal' | 'mood' | 'general';
  progress: number;
  target: number;
  isUnlocked: boolean;
  isClaimed: boolean;
  gemReward: number;
  xpReward: number;
}

interface AchievementState {
  achievements: Achievement[];
  newlyUnlockedId: string | null;
  calculateAchievements: () => void;
  claimReward: (id: string) => void;
  resetNewlyUnlocked: () => void;
}

const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'discipline_starter',
    title: 'Discipline Starter',
    description: 'Complete your first habit or task.',
    icon: 'Zap',
    category: 'general' as const,
    target: 1,
    gemReward: 5,
    xpReward: 50,
  },
  {
    id: 'streak_starter',
    title: 'Streak Starter',
    description: 'Achieve a 3-day habit streak.',
    icon: 'Flame',
    category: 'streaks' as const,
    target: 3,
    gemReward: 10,
    xpReward: 100,
  },
  {
    id: 'streak_master',
    title: 'Streak Master',
    description: 'Achieve a 7-day habit streak.',
    icon: 'Trophy',
    category: 'streaks' as const,
    target: 7,
    gemReward: 25,
    xpReward: 250,
  },
  {
    id: 'productivity_prodigy',
    title: 'Productivity Prodigy',
    description: 'Complete 10 tasks.',
    icon: 'CheckSquare',
    category: 'tasks' as const,
    target: 10,
    gemReward: 15,
    xpReward: 150,
  },
  {
    id: 'zen_journaler',
    title: 'Zen Journaler',
    description: 'Write 5 habit completion journal notes.',
    icon: 'BookOpen',
    category: 'journal' as const,
    target: 5,
    gemReward: 15,
    xpReward: 150,
  },
  {
    id: 'habit_pioneer',
    title: 'Habit Pioneer',
    description: 'Create 5 habits.',
    icon: 'PlusCircle',
    category: 'general' as const,
    target: 5,
    gemReward: 10,
    xpReward: 100,
  },
  {
    id: 'mood_scholar',
    title: 'Mood Scholar',
    description: 'Log your daily mood 7 times.',
    icon: 'Smile',
    category: 'mood' as const,
    target: 7,
    gemReward: 15,
    xpReward: 150,
  },
];

export const useAchievementStore = create<AchievementState>((set, get) => ({
  achievements: [],
  newlyUnlockedId: null,

  resetNewlyUnlocked: () => set({ newlyUnlockedId: null }),

  calculateAchievements: () => {
    // Get stats from active stores
    const { habits, completions, getCurrentStreaks } = useHabitStore.getState();
    const { tasks } = useTaskStore.getState();
    const { moodLogs } = useMoodStore.getState();

    // Streaks
    const streaks = getCurrentStreaks();
    const maxStreak = streaks.size > 0 ? Math.max(...Array.from(streaks.values())) : 0;

    // Completed Tasks
    const completedTasksCount = tasks.filter(t => t.status === 'done').length;

    // Completions with notes
    const journaledCount = completions.filter(c => c.note && c.note.trim() !== '').length;

    // Total habit + task completions (for general starter check)
    const totalCompletions = completions.length + completedTasksCount;

    // Load claims/unlocks cache from localStorage
    let claimedIds: string[] = [];
    let unlockedIds: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        claimedIds = JSON.parse(localStorage.getItem('habitflow_claimed_achievements') || '[]');
        unlockedIds = JSON.parse(localStorage.getItem('habitflow_unlocked_achievements') || '[]');
      } catch (e) {
        console.error('Failed to parse localStorage caches:', e);
      }
    }

    let newlyUnlocked: string | null = null;

    const calculated = ACHIEVEMENT_DEFINITIONS.map(def => {
      let progress = 0;

      switch (def.id) {
        case 'discipline_starter':
          progress = totalCompletions >= 1 ? 1 : 0;
          break;
        case 'streak_starter':
        case 'streak_master':
          progress = maxStreak;
          break;
        case 'productivity_prodigy':
          progress = completedTasksCount;
          break;
        case 'zen_journaler':
          progress = journaledCount;
          break;
        case 'habit_pioneer':
          progress = habits.length;
          break;
        case 'mood_scholar':
          progress = moodLogs.length;
          break;
      }

      const isUnlocked = progress >= def.target;
      const isClaimed = claimedIds.includes(def.id);

      // Check if unlocked just now (isUnlocked, but not in history cache)
      if (isUnlocked && !unlockedIds.includes(def.id)) {
        unlockedIds.push(def.id);
        newlyUnlocked = def.id;
      }

      return {
        ...def,
        progress: Math.min(progress, def.target),
        isUnlocked,
        isClaimed,
      };
    });

    // Save back unlocks if a new one was added
    if (newlyUnlocked && typeof window !== 'undefined') {
      localStorage.setItem('habitflow_unlocked_achievements', JSON.stringify(unlockedIds));
    }

    set({ 
      achievements: calculated, 
      newlyUnlockedId: newlyUnlocked || get().newlyUnlockedId 
    });
  },

  claimReward: (id: string) => {
    const ach = get().achievements.find(a => a.id === id);
    if (!ach || !ach.isUnlocked || ach.isClaimed) return;

    // Reward player
    const { addXp, addGems } = useGamificationStore.getState();
    addXp(ach.xpReward);
    addGems(ach.gemReward);

    // Save claim in state & cache
    let claimedIds: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        claimedIds = JSON.parse(localStorage.getItem('habitflow_claimed_achievements') || '[]');
      } catch (e) {
        console.error('Failed to parse claimed achievements cache:', e);
      }
      if (!claimedIds.includes(id)) {
        claimedIds.push(id);
        localStorage.setItem('habitflow_claimed_achievements', JSON.stringify(claimedIds));
      }
    }

    set(state => ({
      achievements: state.achievements.map(a => a.id === id ? { ...a, isClaimed: true } : a),
    }));
  },
}));
