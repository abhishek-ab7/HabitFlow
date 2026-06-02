import { type Page, expect } from '@playwright/test';

export class AuthPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByPlaceholder('Email address').fill(email);
    await this.page.getByPlaceholder('Password').fill(password);
    await this.page.locator('form button[type="submit"]').click();
  }

  async verifySignOut() {
    await this.page.goto('/settings');
    const signOutBtn = this.page.getByRole('button', { name: /sign out/i });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();
    await this.page.waitForURL('**/login');
  }
}
