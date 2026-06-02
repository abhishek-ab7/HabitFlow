import { type Page, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate() {
    await this.page.goto('/dashboard');
    await this.page.waitForURL('**/dashboard');
  }

  async getLevelText() {
    const text = await this.page.locator('text=/Lv\\.\\d+/').innerText();
    return text;
  }

  async getXPText() {
    const text = await this.page.locator('text=/\\d+\\s*/\\s*\\d+\\s*XP/').first().innerText();
    return text;
  }

  async expectWidgets() {
    // Check if the main widgets load successfully
    const tasksWidget = this.page.locator('.tour-tasks-widget');
    const aiCoachWidget = this.page.locator('.tour-ai-coach-widget');
    const goalsWidget = this.page.locator('.tour-goals-widget');

    await expect(tasksWidget.first()).toBeVisible();
    await expect(aiCoachWidget.first()).toBeVisible();
    await expect(goalsWidget.first()).toBeVisible();
  }
}
