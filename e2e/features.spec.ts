import { test, expect } from './fixtures';

test.describe('Workspace Settings & Wrapped Card Sharing E2E', () => {
  test('successfully toggles workspace settings and uses scorecard share buttons', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // 1. Navigate to Settings to Toggle Workspace Modules
    await page.goto('/settings');
    await page.waitForURL('**/settings');

    // Verify workspace settings toggles exist
    const habitOnlyToggle = page.locator('div.rounded-xl', { hasText: 'Habit-Only Mode' }).getByRole('button');
    const tasksToggle = page.locator('div.rounded-xl', { hasText: 'Tasks Module' }).getByRole('button');
    const goalsToggle = page.locator('div.rounded-xl', { hasText: 'Goals & Milestones' }).getByRole('button');

    await expect(habitOnlyToggle).toBeVisible();
    await expect(tasksToggle).toBeVisible();
    await expect(goalsToggle).toBeVisible();

    // Toggle Habit-Only Mode ON
    await habitOnlyToggle.click();
    await expect(habitOnlyToggle).toHaveText('Active');

    // Verify Tasks & Goals toggles are disabled
    await expect(tasksToggle).toBeDisabled();
    await expect(goalsToggle).toBeDisabled();

    // Check header navigation links: Tasks and Goals tabs should be hidden
    const tasksLink = page.locator('a[href="/tasks"]');
    const goalsLink = page.locator('a[href="/goals"]');
    await expect(tasksLink).not.toBeVisible();
    await expect(goalsLink).not.toBeVisible();

    // Toggle Habit-Only Mode OFF to restore
    await habitOnlyToggle.click();
    await expect(habitOnlyToggle).toHaveText('Disabled');

    // 2. Navigate to Analytics page to check Wrapped Scorecard
    await page.goto('/analytics');
    await page.waitForURL('**/analytics');

    // Click "Launch 2026 Wrapped" button to open YearInReview scorecard modal
    const launchBtn = page.locator('button:has-text("Launch 2026 Wrapped")');
    if (await launchBtn.isVisible()) {
      await launchBtn.click();

      // Verify the Wrapped Card starts
      await expect(page.locator('text=Your 2026 Journey')).toBeVisible();

      // Click Next slide 4 times to reach summary scorecard
      const nextBtn = page.getByTitle('Next slide');
      for (let i = 0; i < 4; i++) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }

      // Verify summary stats and Share Stats button are interactive
      await expect(page.locator('text=Your 2026 Habit Scorecard')).toBeVisible();
      const shareBtn = page.getByRole('button', { name: /Share Stats/i });
      await expect(shareBtn).toBeVisible();

      // Mock navigator.share and clipboard.write to prevent browser sandboxing errors
      await page.evaluate(() => {
        (navigator as any).share = async () => {};
        (navigator as any).canShare = () => true;
      });

      // Click share stats
      await shareBtn.click();
    }
  });
});
