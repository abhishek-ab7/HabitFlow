import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PWAInstallPrompt } from '../pwa-install-prompt';
import { expect, test, vi, beforeEach, describe } from 'vitest';

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('PWAInstallPrompt', () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
    });

    vi.stubGlobal('navigator', {
      userAgent: 'mozilla/5.0 (linux; android 11; pixel 5) applewebkit/537.36 (khtml, like gecko) chrome/90.0.4430.91 mobile safari/537.36',
    });

    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    vi.clearAllMocks();
  });

  test('does not render if already marked as installed', () => {
    localStorageMock['habitflow_pwa_installed'] = 'true';
    const { container } = render(<PWAInstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  test('does not render if dismissed today', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    localStorageMock['habitflow_pwa_dismissed_date'] = todayStr;
    const { container } = render(<PWAInstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  test('does not render if prompted today', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    localStorageMock['habitflow_pwa_prompted_date'] = todayStr;
    const { container } = render(<PWAInstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  test('checks getInstalledRelatedApps and sets installed state if app is installed', async () => {
    const getInstalledRelatedAppsMock = vi.fn().mockResolvedValue([{ platform: 'webapp' }]);
    vi.stubGlobal('navigator', {
      userAgent: 'chrome',
      getInstalledRelatedApps: getInstalledRelatedAppsMock,
    });

    render(<PWAInstallPrompt />);

    // Wait for the async promise to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getInstalledRelatedAppsMock).toHaveBeenCalled();
    expect(localStorageMock['habitflow_pwa_installed']).toBe('true');
  });

  test('triggers beforeinstallprompt and displays the prompt, setting prompted date', () => {
    const { container } = render(<PWAInstallPrompt />);

    const promptEvent = new Event('beforeinstallprompt') as any;
    promptEvent.prompt = vi.fn();
    promptEvent.userChoice = Promise.resolve({ outcome: 'accepted' });

    act(() => {
      window.dispatchEvent(promptEvent);
    });

    expect(screen.getByText('Install HabitFlow')).toBeInTheDocument();
    
    const todayStr = new Date().toISOString().split('T')[0];
    expect(localStorageMock['habitflow_pwa_prompted_date']).toBe(todayStr);
  });

  test('clicking maybe later hides the prompt and sets dismissed date', () => {
    render(<PWAInstallPrompt />);

    const promptEvent = new Event('beforeinstallprompt') as any;
    promptEvent.prompt = vi.fn();
    promptEvent.userChoice = Promise.resolve({ outcome: 'dismissed' });

    act(() => {
      window.dispatchEvent(promptEvent);
    });

    const dismissButton = screen.getByText('Maybe Later');
    act(() => {
      fireEvent.click(dismissButton);
    });

    expect(screen.queryByText('Install HabitFlow')).not.toBeInTheDocument();
    const todayStr = new Date().toISOString().split('T')[0];
    expect(localStorageMock['habitflow_pwa_dismissed_date']).toBe(todayStr);
  });
});
