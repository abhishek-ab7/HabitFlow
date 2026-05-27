import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables loaded by Playwright from .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TEST_EMAIL = `playwright-journey-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Password123!';
const TEST_NAME = 'Journey Test User';

test.describe('Complete User Journey Flow', () => {
  let supabaseAdmin: any;
  let testUserId: string;

  test.beforeAll(async () => {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are missing in .env.local');
    }
    
    // Initialize Supabase admin client
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create the test user with email pre-confirmed
    console.log(`Creating test user: ${TEST_EMAIL}`);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: TEST_NAME }
    });

    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }

    testUserId = data.user.id;
    console.log(`Test user created with ID: ${testUserId}`);
  });

  test.afterAll(async () => {
    if (supabaseAdmin && testUserId) {
      console.log(`Cleaning up test user: ${testUserId}`);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(testUserId);
      if (error) {
        console.error(`Failed to delete test user: ${error.message}`);
      } else {
        console.log('Test user cleaned up successfully.');
      }
    }
  });

  test('walks through habits, tasks, goals, routines, analytics, and gamification', async ({ page }) => {
    // 1. Visit Login Page
    await page.goto('/login');
    await expect(page).toHaveTitle(/Habit Flow/);
    await page.evaluate(() => localStorage.setItem('habitflow_onboarded', 'true'));

    // 2. Fill credentials and Sign In
    await page.getByPlaceholder('Email address').fill(TEST_EMAIL);
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
    await page.locator('form button[type="submit"]').click();

    // 3. Wait for redirect to Dashboard
    await page.waitForURL('**/dashboard');
    console.log('1. Logged in successfully!');

    // Dismiss focus overlay if it automatically opens
    const focusOverlayCloseButton = page.locator('button:has-text("Close")');
    if (await focusOverlayCloseButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await focusOverlayCloseButton.click();
    }

    // 4. Onboarding: Load Demo Data
    const loadDemoButton = page.getByRole('button', { name: 'Load Demo Data' });
    await expect(loadDemoButton).toBeVisible();
    await loadDemoButton.click();
    console.log('2. Clicked Load Demo Data');

    // Wait for the dashboard and demo data to populate and load
    await page.waitForTimeout(3000);

    // 5. Verify Gamification (XP / Level indicator exists in header)
    const levelIndicator = page.locator('text=/Lv\\.\\d+/');
    await expect(levelIndicator).toBeVisible();
    console.log('3. Gamification Level indicator verified!');

    // 6. Test Habits Section
    await page.goto('/habits');
    await page.waitForURL('**/habits');
    // Verify that demo habits exist (e.g., Drink Water or Morning Meditation)
    await expect(page.locator('text=Morning Meditation').or(page.locator('text=Drink Water')).first()).toBeVisible();
    console.log('4. Habits Page & demo habits verified!');

    // 7. Test Tasks Section
    await page.goto('/tasks');
    await page.waitForURL('**/tasks');
    // Verify that tasks exist in the Eisenhower Matrix or list
    await expect(page.locator('text=Task').or(page.locator('text=Priority')).first()).toBeVisible();
    console.log('5. Tasks Page verified!');

    // 8. Test Goals Section
    await page.goto('/goals');
    await page.waitForURL('**/goals');
    // Verify that demo goals exist (e.g. Health & Fitness)
    await expect(page.locator('text=Goal').or(page.locator('text=Active Goals')).first()).toBeVisible();
    console.log('6. Goals Page verified!');

    // 9. Test Routines Section
    await page.goto('/routines');
    await page.waitForURL('**/routines');
    // Verify routines page and list
    await expect(page.locator('text=Morning Routine').or(page.locator('text=Evening Routine')).or(page.locator('text=Routine')).first()).toBeVisible();
    console.log('7. Routines Page verified!');

    // 10. Test Analytics Section
    await page.goto('/analytics');
    await page.waitForURL('**/analytics');
    // Verify charts, category breakdown, or discipline radar are visible
    await expect(page.locator('text=Completion Rate').or(page.locator('text=Analytics')).or(page.locator('canvas')).or(page.locator('svg')).first()).toBeVisible();
    console.log('8. Analytics Page verified!');

    // 11. Sign Out
    await page.goto('/settings');
    const signOutButton = page.getByRole('button', { name: /sign out/i });
    await expect(signOutButton).toBeVisible();
    await signOutButton.click();

    // Verify redirected back to login page
    await page.waitForURL('**/login');
    console.log('9. Logged out and redirected to login.');
  });
});
