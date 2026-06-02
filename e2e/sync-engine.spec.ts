import { test, expect } from './fixtures';
import { HabitsPage } from './pages/HabitsPage';

test.describe('Offline-First & Sync Engine E2E', () => {
  test('optimistically updates UI offline, marks Dexie record dirty, and pushes bulk changes on sync restore', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const habitsPage = new HabitsPage(page);

    // Navigate to Habits page
    await habitsPage.navigate();

    // Verify fixture habit is loaded and visible
    const habitName = 'Fixture Daily Habit';
    const row = page.locator('div.group').filter({ hasText: habitName }).first();
    await expect(row).toBeVisible();

    // 1. Simulate Offline State: Abort Supabase rest API calls
    await page.route('**/rest/v1/**', (route: any) => route.abort());

    // 2. Test A: Complete the habit while offline
    await habitsPage.toggleTodayCompletion(habitName);

    // Verify UI updates instantly (optimistic update)
    const todayButton = row.locator('button[data-today="true"]');
    await expect(todayButton).toHaveClass(/bg-success/);

    // Verify internal Dexie state flags isDirty: true for completions
    const hasDirtyCompletions = await page.evaluate(() => {
      return new Promise<boolean>((resolve, reject) => {
        const req = indexedDB.open('HabitFlowDB');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('completions', 'readonly');
          const store = tx.objectStore('completions');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const comps = getAllReq.result;
            resolve(comps.some((c: any) => c.isDirty === true));
          };
          getAllReq.onerror = () => reject(getAllReq.error);
        };
      });
    });
    expect(hasDirtyCompletions).toBe(true);

    // 3. Test B: Restore Network Restoration (unroute)
    await page.unroute('**/rest/v1/**');

    // Setup network request interception / recording to check for post/patch to completions table
    let syncPostHappened = false;
    await page.route('**/rest/v1/completions*', async (route: any) => {
      syncPostHappened = true;
      await route.continue();
    });

    // Go to Settings page to trigger sync manually
    await page.goto('/settings');
    await page.waitForURL('**/settings');

    const syncButton = page.getByRole('button', { name: 'Sync', exact: true });
    await expect(syncButton).toBeVisible();
    await syncButton.click();

    // Wait for sync to complete (sync button gets enabled again or "All Synced" text is shown)
    await expect(page.getByRole('heading', { name: 'All Synced' })).toBeVisible({ timeout: 15000 });

    // Verify that a request to Supabase completions endpoint was indeed sent
    expect(syncPostHappened).toBe(true);

    // Verify Dexie completion is no longer dirty
    const completionsList = await page.evaluate(() => {
      return new Promise<any[]>((resolve, reject) => {
        const req = indexedDB.open('HabitFlowDB');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('completions', 'readonly');
          const store = tx.objectStore('completions');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => resolve(getAllReq.result);
          getAllReq.onerror = () => reject(getAllReq.error);
        };
      });
    });
    console.log("DEBUG COMPLETIONS:", JSON.stringify(completionsList, null, 2));

    const postSyncDirtyCompletions = completionsList.some((c: any) => c.isDirty === true);
    expect(postSyncDirtyCompletions).toBe(false);
  });
});
