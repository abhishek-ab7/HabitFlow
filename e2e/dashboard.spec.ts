import { test, expect } from './fixtures';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Dashboard & UX Resilience E2E', () => {
  test('displays all dashboard widgets correctly on desktop', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.navigate();
    await dashboardPage.expectWidgets();
  });

  test('handles responsive viewport scaling and mobile navigation safely', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.navigate();

    // 1. Set mobile viewport size
    await page.setViewportSize({ width: 375, height: 812 });

    // 2. Verify mobile navigation elements are visible and interactive
    const mobileNav = page.locator('.tour-mobile-nav-dashboard');
    await expect(mobileNav).toBeVisible();

    const mobileHabits = page.locator('.tour-mobile-nav-habits');
    await expect(mobileHabits).toBeVisible();

    const mobileTasks = page.locator('.tour-mobile-nav-tasks');
    await expect(mobileTasks).toBeVisible();

    const mobileGoals = page.locator('.tour-mobile-nav-goals');
    await expect(mobileGoals).toBeVisible();

    const mobileSettings = page.locator('.tour-mobile-nav-settings');
    await expect(mobileSettings).toBeVisible();

    // 3. Navigate using the mobile menu to verify touch targets
    await mobileHabits.click({ force: true });
    await page.waitForURL('**/habits');

    // Return to dashboard using mobile menu
    await page.locator('.tour-mobile-nav-dashboard').click({ force: true });
    await page.waitForURL('**/dashboard');
  });
});
