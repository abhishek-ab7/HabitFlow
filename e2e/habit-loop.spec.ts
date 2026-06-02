import { test, expect } from './fixtures';
import { DashboardPage } from './pages/DashboardPage';
import { HabitsPage } from './pages/HabitsPage';

test.describe('Core Habit Loop & Gamification E2E', () => {
  test('creates, completes, and un-completes a hard difficulty habit, updating streaks and XP', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const habitsPage = new HabitsPage(page);
    const dashboardPage = new DashboardPage(page);

    // 1. Navigate to Habits Page
    await habitsPage.navigate();

    // 2. Test A: Create a new daily habit with a "hard" difficulty
    const habitName = `Test Hard Habit ${Date.now()}`;
    await habitsPage.createHabit(habitName, 'health', 'hard');

    // 3. Test B: Mark the habit as complete and verify XP/streaks increase
    // Check initial level and XP in header
    const initialXP = await dashboardPage.getXPText();
    expect(initialXP).toContain('0 / 100 XP');

    // Toggle today's completion for the new habit
    await habitsPage.toggleTodayCompletion(habitName);

    // Verify completion visual state updates (gets success class)
    const row = page.locator('div.group').filter({ hasText: habitName }).first();
    const todayButton = row.locator('button[data-today="true"]');
    await expect(todayButton).toHaveClass(/bg-success/);

    // Verify local streak increments to 1 (flame badge displays 1)
    const streakBadge = row.locator('.lucide-flame').locator('xpath=..');
    await expect(streakBadge).toContainText('1');

    // Verify Gamification UI (XP bar) reflects an increase (+30 XP since difficulty is hard)
    const updatedXP = await dashboardPage.getXPText();
    expect(updatedXP).toContain('30 / 100 XP');

    // 4. Test C: Un-check a completed habit, verifying XP deduction and streak reset
    await habitsPage.toggleTodayCompletion(habitName);

    // Verify checkbox reverts (success class is removed)
    await expect(todayButton).not.toHaveClass(/bg-success/);

    // Verify streak resets (flame badge is hidden or streak is 0)
    await expect(row.locator('.lucide-flame')).not.toBeVisible();

    // Verify XP is deducted back to 0/100 XP
    const revertedXP = await dashboardPage.getXPText();
    expect(revertedXP).toContain('0 / 100 XP');

    // Cleanup
    await habitsPage.deleteHabit(habitName);
  });
});
