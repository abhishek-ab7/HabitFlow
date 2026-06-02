import { render, screen } from '@testing-library/react';
import RootLayout, { metadata, viewport } from '../layout';
import { expect, test, vi } from 'vitest';

vi.mock('@/providers/theme-provider', () => ({
  ThemeProvider: ({ children }: any) => <div data-testid="theme-provider">{children}</div>,
}));

vi.mock('@/providers/auth-provider', () => ({
  AuthProvider: ({ children }: any) => <div data-testid="auth-provider">{children}</div>,
}));

vi.mock('@/providers/sync-provider', () => ({
  SyncProvider: ({ children }: any) => <div data-testid="sync-provider">{children}</div>,
}));

vi.mock('@/components/layout', () => ({
  Header: () => <div data-testid="header" />,
  MobileNav: () => <div data-testid="mobile-nav" />,
  ShortcutsProvider: () => <div data-testid="shortcuts-provider" />,
  AppStartupGate: ({ children }: any) => <div data-testid="app-startup-gate">{children}</div>,
}));

vi.mock('@/components/pwa', () => ({
  ServiceWorkerRegistration: () => <div data-testid="sw-reg" />,
  PWAInstallPrompt: () => <div data-testid="pwa-install-prompt" />,
}));

vi.mock('@/components/gamification/LevelUpModal', () => ({
  LevelUpModal: () => <div data-testid="level-up-modal" />,
}));

vi.mock('@/components/gamification/GamificationRulesModal', () => ({
  GamificationRulesModal: () => <div data-testid="gamification-rules-modal" />,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('@/components/dashboard/premium/PomodoroFloating', () => ({
  PomodoroFloating: () => <div data-testid="pomodoro-floating" />,
}));

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'geist-sans' }),
  Geist_Mono: () => ({ variable: 'geist-mono' }),
}));

test('metadata has the correct favicon configuration matching the HabitFlow logo', () => {
  expect(metadata.icons).toBeDefined();
  expect(metadata.icons).toEqual({
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' }
    ],
    apple: '/icons/apple-touch-icon.png',
  });
});

test('viewport configuration is correct', () => {
  expect(viewport).toBeDefined();
  expect(viewport.themeColor).toBeDefined();
});

test('RootLayout renders children and providers correctly', () => {
  render(
    <RootLayout>
      <div data-testid="test-child">Child Content</div>
    </RootLayout>
  );

  expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  expect(screen.getByTestId('sync-provider')).toBeInTheDocument();
  expect(screen.getByTestId('header')).toBeInTheDocument();
  expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  expect(screen.getByTestId('app-startup-gate')).toBeInTheDocument();
  expect(screen.getByTestId('pwa-install-prompt')).toBeInTheDocument();
  expect(screen.getByTestId('test-child')).toBeInTheDocument();
  expect(screen.getByTestId('test-child').textContent).toBe('Child Content');
});

