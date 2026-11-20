import { test, expect } from './fixtures';
import { HabitsPage } from './pages/HabitsPage';

test.describe('Core Habit Loop E2E', () => {
  test('creates, completes, and un-completes a hard difficulty habit, updating streaks', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const habitsPage = new HabitsPage(page);

    // 1. Navigate to Habits Page
    await habitsPage.navigate();

    // 2. Test A: Create a new daily habit with a "hard" difficulty
    const habitName = `Test Hard Habit ${Date.now()}`;
    await habitsPage.createHabit(habitName, 'health', 'hard');

    // 3. Test B: Mark the habit as complete and verify streaks increase
    await habitsPage.toggleTodayCompletion(habitName);

    // Verify completion visual state updates (gets success class)
    const row = page.locator('div.group').filter({ hasText: habitName }).first();
    const todayButton = row.locator('button[data-today="true"]');
    await expect(todayButton).toHaveClass(/bg-success/);

    // Verify local streak increments to 1 (flame badge displays 1)
    const streakBadge = row.locator('.lucide-flame').locator('xpath=..');
    await expect(streakBadge).toContainText('1');

    // 4. Test C: Un-check a completed habit, verifying streak reset
    await habitsPage.toggleTodayCompletion(habitName);

    // Verify checkbox reverts (success class is removed)
    await expect(todayButton).not.toHaveClass(/bg-success/);

    // Verify streak resets (flame badge is hidden or streak is 0)
    await expect(row.locator('.lucide-flame')).not.toBeVisible();

    // Cleanup
    await habitsPage.deleteHabit(habitName);
  });
});
