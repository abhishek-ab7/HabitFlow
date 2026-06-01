import { useGamificationStore } from './gamification-store';
import { useHabitStore } from './habit-store';
import { useTaskStore } from './task-store';
import { useAchievementStore } from './achievement-store';

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
}
