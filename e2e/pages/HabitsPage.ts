import { type Page, expect } from '@playwright/test';

export class HabitsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate() {
    await this.page.goto('/habits');
    await this.page.waitForURL('**/habits');
  }

  async createHabit(name: string, category: string, difficulty: 'easy' | 'medium' | 'hard') {
    // Click New Habit button
    await this.page.getByRole('button', { name: 'New Habit' }).click();

    // Fill habit name
    const nameInput = this.page.locator('#habit-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(name);

    // Select category (find button with the category label)
    // Categories on HabitFlow: Health, Work, Learning, Personal, Finance, Relationships
    await this.page.getByRole('button', { name: new RegExp(category, 'i') }).click();

    // Select difficulty
    await this.page.getByRole('combobox').click();
    await this.page.getByRole('option', { name: new RegExp(difficulty, 'i') }).click();

    // Click submit/create button
    await this.page.getByRole('button', { name: 'Create Habit', exact: true }).click();

    // Verify dialog closes and habit is visible
    await expect(this.page.locator('div.group').filter({ hasText: name }).first()).toBeVisible();
  }

  async toggleTodayCompletion(habitName: string) {
    const row = this.page.locator('div.group').filter({ hasText: habitName }).first();
    await expect(row).toBeVisible();
    
    // Locates the button for today's cell (using data-today attribute)
    const todayButton = row.locator('button[data-today="true"]');
    await expect(todayButton).toBeVisible();
    await todayButton.click();
    
    // Wait brief duration for transition animation
    await this.page.waitForTimeout(500);
  }

  async deleteHabit(habitName: string) {
    const row = this.page.locator('div.group').filter({ hasText: habitName }).first();
    await expect(row).toBeVisible();

    // Open dropdown actions menu
    const menuButton = row.locator('button.h-7.w-7').first();
    await menuButton.click();

    // Click Delete option in menu
    const deleteMenuItem = this.page.getByRole('menuitem', { name: 'Delete' });
    await expect(deleteMenuItem).toBeVisible();
    await deleteMenuItem.click();

    // Confirm deletion inside the dialog
    const confirmDeleteBtn = this.page.getByRole('button', { name: 'Delete', exact: true });
    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();

    // Verify it is no longer displayed
    await expect(this.page.locator('div.group').filter({ hasText: habitName })).not.toBeVisible();
  }
}
