/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export type AuthenticatedFixture = {
  page: any;
  userId: string;
  email: string;
};

export const test = base.extend<{
  authenticatedPage: AuthenticatedFixture;
}>({
  page: async ({ page }, use) => {
    await use(page);

    if (process.env.INSTRUMENT_COVERAGE === 'true') {
      try {
        const coverage = await page.evaluate(() => (window as any).__coverage__);
        if (coverage) {
          const coverageDir = path.join(process.cwd(), '.nyc_output');
          if (!fs.existsSync(coverageDir)) {
            fs.mkdirSync(coverageDir, { recursive: true });
          }
          const fileName = `playwright-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.json`;
          fs.writeFileSync(
            path.join(coverageDir, fileName),
            JSON.stringify(coverage)
          );
        }
      } catch (err) {
        console.warn('Failed to collect page coverage:', err);
      }
    }
  },

  authenticatedPage: async ({ page }, use) => {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are missing in .env.local');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const email = `playwright-fixture-${Date.now()}@example.com`;
    const password = 'Password123!';

    // 1. Create a test user via Supabase admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Fixture Test User' }
    });

    if (error) {
      throw new Error(`Failed to create test user for fixture: ${error.message}`);
    }

    const userId = data.user.id;

    // Pre-seed the habit on Supabase to prevent completions sync foreign key violations
    const { error: habitSupabaseError } = await supabaseAdmin.from('habits').insert({
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: userId,
      name: 'Fixture Daily Habit',
      icon: '🏃',
      category: 'health',
      target_days: 7,
      is_archived: false,
      order_index: 0,
      is_quantitative: false,
      target_value: 0,
      unit: '',
      generation_counter: 1,
      updated_at: new Date().toISOString()
    });

    if (habitSupabaseError) {
      throw new Error(`Failed to pre-seed habit on Supabase: ${habitSupabaseError.message}`);
    }

    // Hide Next.js dev overlay / portals permanently across all page loads and navigations
    await page.addInitScript(() => {
      const injectStyle = () => {
        if (document.getElementById('hide-nextjs-dev-overlay')) return;
        const style = document.createElement('style');
        style.id = 'hide-nextjs-dev-overlay';
        style.textContent = 'nextjs-portal, #__next-route-announcer__ { display: none !important; }';
        if (document.head) {
          document.head.appendChild(style);
        } else if (document.documentElement) {
          document.documentElement.appendChild(style);
        }
      };
      injectStyle();
      window.addEventListener('DOMContentLoaded', injectStyle);
    });

    await page.goto('/login');
    await page.evaluate(({ userId }) => {
      const todayStr = new Date().toISOString().split('T')[0];
      localStorage.setItem('habitflow_onboarded', 'true');
      localStorage.setItem('habitflow_dashboard_tutorial_completed', 'true');
      localStorage.setItem(`focus_mode_started_${userId}_${todayStr}`, 'true');
      localStorage.setItem(`focus_mode_started_guest_${todayStr}`, 'true');
    }, { userId });
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('**/dashboard');

    // Dismiss focus mode overlay if visible
    const focusOverlayCloseButton = page.locator('button:has-text("Close")');
    if (await focusOverlayCloseButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await focusOverlayCloseButton.click();
    }

    // 3. Seed IndexedDB with initial active habit and 100 XP
    await page.evaluate(async ({ userId }) => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('HabitFlowDB');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['habits', 'userSettings', 'completions'], 'readwrite');

          tx.objectStore('habits').clear();
          tx.objectStore('userSettings').clear();
          tx.objectStore('completions').clear();

          tx.objectStore('habits').add({
            id: '550e8400-e29b-41d4-a716-446655440000',
            userId,
            name: 'Fixture Daily Habit',
            icon: '🏃',
            category: 'health',
            targetDaysPerWeek: 7,
            archived: false,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isQuantitative: false,
            targetValue: 0,
            unit: '',
            difficulty: 'hard',
            generationCounter: 1,
            isDirty: false
          });

          tx.objectStore('userSettings').add({
            id: 'test-settings-id',
            userId,
            theme: 'system',
            userName: 'Fixture Test User',
            weekStartsOn: 0,
            showMotivationalQuotes: true,
            defaultCategory: 'health',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            xp: 0,
            level: 1,
            gems: 0,
            streakShield: 0,
            avatarId: 'avatar-1',
            soundEnabled: true,
            hapticsEnabled: true,
            stats: {
              vitality: 1,
              intelligence: 1,
              discipline: 1,
              charisma: 1,
              wealth: 1,
              creativity: 1,
            },
            unlockedThemes: [],
            dashboardLayout: [
              { id: 'metrics', size: 'full', hidden: false, pinned: true },
              { id: 'today-tasks', size: 'full', hidden: false, pinned: false },
              { id: 'focus-goal', size: '1/2', hidden: false, pinned: false },
              { id: 'ai-coach', size: '1/2', hidden: false, pinned: false },
              { id: 'weekly-review', size: '1/2', hidden: false, pinned: false }
            ],
            showTasks: true,
            showGoals: true,
            showMilestones: true,
            habitOnlyMode: false,
            generationCounter: 1,
            isDirty: false
          });

          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    }, { userId });

    // Reload the page to ensure app loads with the seeded database data
    await page.reload();
    await page.waitForURL('**/dashboard');

    // 4. Pass the authenticated page and user information to the test
    await use({ page, userId, email });

    // 5. Cleanup test user
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (cleanupError) {
      console.error('Failed to cleanup fixture test user:', cleanupError);
    }
  }
});

// Helper to manually clear database if needed in tests
export async function clearIndexedDB(page: any) {
  await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('HabitFlowDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const stores = Array.from(db.objectStoreNames);
        if (stores.length === 0) {
          resolve(true);
          return;
        }
        const tx = db.transaction(stores, 'readwrite');
        for (const storeName of stores) {
          tx.objectStore(storeName).clear();
        }
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
}

// Helper to manually seed database if needed in tests
export async function seedIndexedDB(
  page: any,
  userId: string,
  data: { habits?: any[]; completions?: any[]; settings?: any }
) {
  await page.evaluate(async ({ userId, data }: { userId: string; data: any }) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('HabitFlowDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const storesToLock = ['habits', 'completions', 'userSettings'];
        const tx = db.transaction(storesToLock, 'readwrite');

        if (data.habits) {
          const habitsStore = tx.objectStore('habits');
          habitsStore.clear();
          for (const habit of data.habits) {
            habitsStore.add({ userId, ...habit });
          }
        }
        if (data.completions) {
          const completionsStore = tx.objectStore('completions');
          completionsStore.clear();
          for (const comp of data.completions) {
            completionsStore.add({ userId, ...comp });
          }
        }
        if (data.settings) {
          const settingsStore = tx.objectStore('userSettings');
          settingsStore.clear();
          settingsStore.add({ userId, ...data.settings });
        }

        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { userId, data });
}

export { expect } from '@playwright/test';
