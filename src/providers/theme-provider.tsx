'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AccentTheme } from '@/lib/types';
import {
  ACCENT_OVERRIDE_STORAGE_KEY,
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_ACCENT_OVERRIDE,
  DEFAULT_COLOR_THEME,
  LEGACY_ACCENT_STORAGE_KEY,
  getColorThemeById,
  isValidAccentOverride,
  isValidColorTheme,
  type AccentOverrideId,
  type ColorThemeId,
} from '@/lib/themes';

export type Theme = 'light' | 'dark' | 'system';
export type { ColorThemeId, AccentOverrideId };

const VALID_THEMES: readonly Theme[] = ['light', 'dark', 'system'];
const LEGACY_ACCENTS: readonly AccentTheme[] = ['mint', 'cobalt', 'forest', 'ink'];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  colorTheme: ColorThemeId;
  setColorTheme: (colorTheme: ColorThemeId) => void;
  accentOverride: AccentOverrideId;
  setAccentOverride: (accent: AccentOverrideId) => void;
  resetAppearance: () => void;
  /** Backward-compatible alias mapped cleanly to accentOverride */
  accent: AccentTheme;
  /** Backward-compatible alias mapped cleanly to setAccentOverride */
  setAccent: (accent: AccentTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

function applyColorThemeToDom(colorTheme: ColorThemeId): void {
  const root = window.document.documentElement;
  if (colorTheme === DEFAULT_COLOR_THEME) {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', colorTheme);
  }
}

function applyAccentOverrideToDom(accentOverride: AccentOverrideId): void {
  const root = window.document.documentElement;
  if (accentOverride === DEFAULT_ACCENT_OVERRIDE) {
    root.removeAttribute('data-accent');
  } else {
    root.setAttribute('data-accent', accentOverride);
  }
}

function updateThemeColorMeta(colorTheme: ColorThemeId, resolved: 'light' | 'dark'): void {
  const definition = getColorThemeById(colorTheme);
  const nextColor = resolved === 'dark' ? definition.themeColorDark : definition.themeColorLight;
  const metas = window.document.querySelectorAll('meta[name="theme-color"]');

  if (metas.length > 0) {
    metas.forEach((meta) => {
      meta.setAttribute('content', nextColor);
    });
  } else {
    const meta = window.document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = nextColor;
    window.document.head.appendChild(meta);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [colorTheme, setColorThemeState] = useState<ColorThemeId>(DEFAULT_COLOR_THEME);
  const [accentOverride, setAccentOverrideState] = useState<AccentOverrideId>(DEFAULT_ACCENT_OVERRIDE);
  const [mounted, setMounted] = useState(false);

  // Hydrate brightness, colorTheme, and accentOverride from localStorage on client mount
  useEffect(() => {
    const rawTheme = safeStorageGet('theme');
    if (rawTheme === 'auto') {
      safeStorageSet('theme', 'system');
      setThemeState('system');
    } else if (rawTheme && VALID_THEMES.includes(rawTheme as Theme)) {
      setThemeState(rawTheme as Theme);
    }

    const rawColorTheme = safeStorageGet(COLOR_THEME_STORAGE_KEY);
    const initialColorTheme: ColorThemeId = isValidColorTheme(rawColorTheme)
      ? rawColorTheme
      : DEFAULT_COLOR_THEME;
    setColorThemeState(initialColorTheme);
    applyColorThemeToDom(initialColorTheme);

    const rawAccentOverride = safeStorageGet(ACCENT_OVERRIDE_STORAGE_KEY);
    let initialAccentOverride: AccentOverrideId = DEFAULT_ACCENT_OVERRIDE;

    if (isValidAccentOverride(rawAccentOverride)) {
      initialAccentOverride = rawAccentOverride;
    } else {
      // Seamlessly migrate legacy habitflow_accent preference if present
      const legacyAccent = safeStorageGet(LEGACY_ACCENT_STORAGE_KEY);
      if (legacyAccent && legacyAccent !== 'mint' && isValidAccentOverride(legacyAccent)) {
        initialAccentOverride = legacyAccent;
        safeStorageSet(ACCENT_OVERRIDE_STORAGE_KEY, initialAccentOverride);
      }
    }

    setAccentOverrideState(initialAccentOverride);
    applyAccentOverrideToDom(initialAccentOverride);
    setMounted(true);
  }, []);

  // Apply light/dark surface classes and listen to OS preference
  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    const applySurface = (isDark: boolean) => {
      root.classList.remove('light', 'dark', 'theme-morning', 'theme-afternoon', 'theme-night');
      const nextResolved: 'light' | 'dark' = isDark ? 'dark' : 'light';
      root.classList.add(nextResolved);
      setResolvedTheme(nextResolved);
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applySurface(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => applySurface(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      safeStorageSet('theme', 'system');
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    applySurface(theme === 'dark');
    safeStorageSet('theme', theme);
  }, [theme, mounted]);

  // Apply colorTheme attribute and keep mobile browser theme-color meta synced
  useEffect(() => {
    if (!mounted) return;
    applyColorThemeToDom(colorTheme);
    safeStorageSet(COLOR_THEME_STORAGE_KEY, colorTheme);
    updateThemeColorMeta(colorTheme, resolvedTheme);
  }, [colorTheme, resolvedTheme, mounted]);

  // Apply accentOverride attribute
  useEffect(() => {
    if (!mounted) return;
    applyAccentOverrideToDom(accentOverride);
    safeStorageSet(ACCENT_OVERRIDE_STORAGE_KEY, accentOverride);
  }, [accentOverride, mounted]);

  const setTheme = useCallback((nextTheme: Theme) => {
    if (!VALID_THEMES.includes(nextTheme)) return;
    setThemeState(nextTheme);
    if (typeof window !== 'undefined') {
      safeStorageSet('theme', nextTheme);
    }
  }, []);

  const setColorTheme = useCallback((nextColorTheme: ColorThemeId) => {
    if (!isValidColorTheme(nextColorTheme)) return;
    setColorThemeState(nextColorTheme);
    if (typeof window !== 'undefined') {
      safeStorageSet(COLOR_THEME_STORAGE_KEY, nextColorTheme);
      applyColorThemeToDom(nextColorTheme);
    }
  }, []);

  const setAccentOverride = useCallback((nextAccent: AccentOverrideId) => {
    if (!isValidAccentOverride(nextAccent)) return;
    setAccentOverrideState(nextAccent);
    if (typeof window !== 'undefined') {
      safeStorageSet(ACCENT_OVERRIDE_STORAGE_KEY, nextAccent);
      applyAccentOverrideToDom(nextAccent);
    }
  }, []);

  const resetAppearance = useCallback(() => {
    setColorThemeState(DEFAULT_COLOR_THEME);
    setAccentOverrideState(DEFAULT_ACCENT_OVERRIDE);
    if (typeof window !== 'undefined') {
      safeStorageSet(COLOR_THEME_STORAGE_KEY, DEFAULT_COLOR_THEME);
      safeStorageSet(ACCENT_OVERRIDE_STORAGE_KEY, DEFAULT_ACCENT_OVERRIDE);
      applyColorThemeToDom(DEFAULT_COLOR_THEME);
      applyAccentOverrideToDom(DEFAULT_ACCENT_OVERRIDE);
    }
  }, []);

  // Backward-compatible AccentTheme mapping
  const accent: AccentTheme = LEGACY_ACCENTS.includes(accentOverride as AccentTheme)
    ? (accentOverride as AccentTheme)
    : 'mint';

  const setAccent = useCallback(
    (nextAccent: AccentTheme) => {
      if (!LEGACY_ACCENTS.includes(nextAccent)) return;
      setAccentOverride(nextAccent);
    },
    [setAccentOverride]
  );

  const contextValue = useMemo<ThemeContextType>(
    () => ({
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
    }),
    [
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
    ]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
