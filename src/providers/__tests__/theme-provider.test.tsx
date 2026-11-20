import { render, screen, act, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../theme-provider';
import {
  ACCENT_OVERRIDE_STORAGE_KEY,
  COLOR_THEMES,
  COLOR_THEME_STORAGE_KEY,
  LEGACY_ACCENT_STORAGE_KEY,
} from '@/lib/themes';

function ThemeTestHarness() {
  const {
    theme,
    setTheme,
    resolvedTheme,
    colorTheme,
    setColorTheme,
    accentOverride,
    setAccentOverride,
    resetAppearance,
    accent,
    setAccent,
  } = useTheme();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <span data-testid="color-theme">{colorTheme}</span>
      <span data-testid="accent-override">{accentOverride}</span>
      <span data-testid="legacy-accent">{accent}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        set-dark
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        set-light
      </button>
      <button type="button" onClick={() => setColorTheme('warm-stone-forest')}>
        set-warm-stone
      </button>
      <button type="button" onClick={() => setColorTheme('monochrome-cobalt')}>
        set-mono-cobalt
      </button>
      <button type="button" onClick={() => setAccentOverride('cobalt')}>
        set-accent-cobalt
      </button>
      <button type="button" onClick={() => setAccentOverride('theme')}>
        set-accent-theme
      </button>
      <button type="button" onClick={() => setAccent('forest')}>
        set-legacy-forest
      </button>
      <button type="button" onClick={() => resetAppearance()}>
        reset-appearance
      </button>
    </div>
  );
}

describe('ThemeProvider multi-theme & accent override system', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-accent');
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('defaults to system brightness, obsidian-mint palette, and match-theme accent', () => {
    render(
      <ThemeProvider>
        <ThemeTestHarness />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme').textContent).toBe('system');
    expect(screen.getByTestId('color-theme').textContent).toBe('obsidian-mint');
    expect(screen.getByTestId('accent-override').textContent).toBe('theme');
    expect(screen.getByTestId('legacy-accent').textContent).toBe('mint');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  });

  it('switches colorTheme and accentOverride independently and restores Match Theme cleanly', () => {
    render(
      <ThemeProvider>
        <ThemeTestHarness />
      </ThemeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('set-dark'));
      fireEvent.click(screen.getByText('set-warm-stone'));
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('warm-stone-forest');
    expect(localStorage.getItem(COLOR_THEME_STORAGE_KEY)).toBe('warm-stone-forest');

    const warmStoneDef = COLOR_THEMES.find((t) => t.id === 'warm-stone-forest')!;
    const meta = document.head.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe(warmStoneDef.themeColorDark);

    act(() => {
      fireEvent.click(screen.getByText('set-accent-cobalt'));
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('warm-stone-forest');
    expect(document.documentElement.getAttribute('data-accent')).toBe('cobalt');
    expect(localStorage.getItem(ACCENT_OVERRIDE_STORAGE_KEY)).toBe('cobalt');

    act(() => {
      fireEvent.click(screen.getByText('set-accent-theme'));
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('warm-stone-forest');
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);

    act(() => {
      fireEvent.click(screen.getByText('reset-appearance'));
    });

    expect(screen.getByTestId('color-theme').textContent).toBe('obsidian-mint');
    expect(screen.getByTestId('accent-override').textContent).toBe('theme');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  });

  it('migrates legacy auto theme and habitflow_accent keys and ignores corrupted values', () => {
    localStorage.setItem('theme', 'auto');
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, 'not-a-real-theme');
    localStorage.setItem(LEGACY_ACCENT_STORAGE_KEY, 'cobalt');

    render(
      <ThemeProvider>
        <ThemeTestHarness />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme').textContent).toBe('system');
    expect(localStorage.getItem('theme')).toBe('system');
    expect(screen.getByTestId('color-theme').textContent).toBe('obsidian-mint');
    expect(screen.getByTestId('accent-override').textContent).toBe('cobalt');
    expect(document.documentElement.getAttribute('data-accent')).toBe('cobalt');
  });

  it('preserves backward-compatible setAccent API', () => {
    render(
      <ThemeProvider>
        <ThemeTestHarness />
      </ThemeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('set-legacy-forest'));
    });

    expect(screen.getByTestId('accent-override').textContent).toBe('forest');
    expect(screen.getByTestId('legacy-accent').textContent).toBe('forest');
    expect(document.documentElement.getAttribute('data-accent')).toBe('forest');
  });
});
