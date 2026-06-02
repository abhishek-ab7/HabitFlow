import { useGamificationStore } from './gamification-store';
import { useHabitStore } from './habit-store';
import { useTaskStore } from './task-store';
import { useAchievementStore } from './achievement-store';
import { toggleCompletion } from '../db';
import { getSupabaseClient } from '../supabase/client';
import type { Category } from '../types';

export type MediatorAction =
  | {
      type: 'HABIT_COMPLETED';
      payload: {
        habitId: string;
        date: string;
        difficulty: 'easy' | 'medium' | 'hard';
        category?: Category;
      };
    }
  | {
      type: 'HABIT_UNCOMPLETED';
      payload: {
        habitId: string;
        date: string;
        difficulty: 'easy' | 'medium' | 'hard';
        category?: Category;
      };
    };

export class CrossDomainActionMediator {
  // Whenever a habit is completed/toggled, update completions and recalculate achievements
  public static async toggleHabitCompletion(habitId: string, date: string) {
    const habitStore = useHabitStore.getState();
    await habitStore.toggle(habitId, date);
    
    // Check and update achievements based on the latest habit/completions state
    useAchievementStore.getState().calculateAchievements();
  }

  // When tasks are completed, update task status, and update achievements
  public static async toggleTaskCompletion(taskId: string) {
    const taskStore = useTaskStore.getState();
    await taskStore.toggleTaskComplete(taskId);
    
    // Check and update achievements based on the latest task state
    useAchievementStore.getState().calculateAchievements();
  }

  // When rewards are claimed, update gamification store and recalculate achievements
  public static claimAchievementReward(achievementId: string) {
    const achievementStore = useAchievementStore.getState();
    achievementStore.claimReward(achievementId);
    
    // Refresh achievements to reflect claiming
    achievementStore.calculateAchievements();
  }

  // Orchestrate multi-store updates for custom actions
  public static async dispatch(action: MediatorAction) {
    const habitStore = useHabitStore.getState();
    const gamificationStore = useGamificationStore.getState();
    const { habitId, date, difficulty, category } = action.payload;

    const base = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 30 : 20;

    if (action.type === 'HABIT_COMPLETED') {
      const isAlreadyCompleted = habitStore.completions.some(
        c => c.habitId === habitId && c.date === date && c.completed
      );

      if (!isAlreadyCompleted) {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || 'test-user';

        // Toggle in DB to ensure record exists
        const result = await toggleCompletion(habitId, date, userId);
        
        // Ensure the record is set to completed
        if (!result.completed) {
          result.completed = true;
          const { db } = await import('../db');
          await db.completions.update(result.id, { completed: true });
        }

        // Add to store completions state
        useHabitStore.setState({
          completions: [
            ...habitStore.completions.filter(c => !(c.habitId === habitId && c.date === date)),
            result
          ]
        });

        // Award XP
        await gamificationStore.addXp(base, category);

        // Recalculate achievements
        useAchievementStore.getState().calculateAchievements();
      }
    } else if (action.type === 'HABIT_UNCOMPLETED') {
      const existingIndex = habitStore.completions.findIndex(
        c => c.habitId === habitId && c.date === date && c.completed
      );

      if (existingIndex !== -1) {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || 'test-user';

        // Toggle in DB
        const result = await toggleCompletion(habitId, date, userId);

        // Ensure the record is set to not completed
        if (result.completed) {
          result.completed = false;
          const { db } = await import('../db');
          await db.completions.update(result.id, { completed: false });
        }

        // Remove from store completions state
        useHabitStore.setState({
          completions: habitStore.completions.filter(c => !(c.habitId === habitId && c.date === date))
        });

        // Deduct XP
        await gamificationStore.addXp(-base, category);

        // Recalculate achievements
        useAchievementStore.getState().calculateAchievements();
      }
    }
  }
}

