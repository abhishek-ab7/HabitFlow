import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('sign in form exists and validates', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.getByPlaceholder('Email address');
    const passwordInput = page.getByPlaceholder('Password');
    const signInButton = page.locator('form button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // Click without entering details to trigger client-side validation
    await signInButton.click();
    
    // HTML5 native validation blocks submission, so button shouldn't show loading state
    await expect(signInButton).toBeEnabled();
    await expect(signInButton).toHaveText('Sign in');
  });

  test('Google sign in button is present', async ({ page }) => {
    await page.goto('/login');
    const googleButton = page.getByRole('button', { name: /Continue with Google/i, exact: false });
    await expect(googleButton).toBeVisible();
  });
});
