'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AccentTheme } from '@/lib/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSettings, updateSettings } from '@/lib/db';
import { getSyncEngine } from '@/lib/sync';

export type Theme = 'light' | 'dark' | 'system';

const VALID_THEMES: Theme[] = ['light', 'dark', 'system'];
const VALID_ACCENTS: AccentTheme[] = ['mint', 'cobalt', 'forest', 'ink'];
const ACCENT_STORAGE_KEY = 'habitflow_accent';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  accent: AccentTheme;
  setAccent: (accent: AccentTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyAccentToDom(accent: AccentTheme) {
  const root = window.document.documentElement;
  if (accent === 'mint') {
    delete root.dataset.accent;
  } else {
    root.dataset.accent = accent;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [accent, setAccentState] = useState<AccentTheme>('mint');
  const [mounted, setMounted] = useState(false);

  // Hydrate theme & accent from localStorage immediately on client mount
  useEffect(() => {
    const rawTheme = localStorage.getItem('theme');
    if (rawTheme === 'auto') {
      // Gracefully migrate retired clock-based auto mode to system preference
      localStorage.setItem('theme', 'system');
      setThemeState('system');
    } else if (rawTheme && VALID_THEMES.includes(rawTheme as Theme)) {
      setThemeState(rawTheme as Theme);
    }

    const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentTheme | null;
    if (storedAccent && VALID_ACCENTS.includes(storedAccent)) {
      setAccentState(storedAccent);
      applyAccentToDom(storedAccent);
    } else {
      applyAccentToDom('mint');
    }

    setMounted(true);
  }, []);

  // Reconcile persisted UserSettings accent for signed-in users
  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const hydrateSyncedAccent = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !active) return;

        const settings = await getSettings(session.user.id);
        if (!active) return;

        const localStored = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentTheme | null;
        if (settings?.accent && VALID_ACCENTS.includes(settings.accent)) {
          if (!localStored) {
            setAccentState(settings.accent);
            localStorage.setItem(ACCENT_STORAGE_KEY, settings.accent);
            applyAccentToDom(settings.accent);
          }
        } else if (localStored && VALID_ACCENTS.includes(localStored)) {
          await updateSettings({ userId: session.user.id, accent: localStored, isDirty: true });
        }
      } catch {
        // Offline or guest mode safely uses localStorage accent
      }
    };

    hydrateSyncedAccent();
    return () => {
      active = false;
    };
  }, [mounted]);

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
      localStorage.setItem('theme', 'system');
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applySurface(theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }, [theme, mounted]);

  // Apply accent preset attribute
  useEffect(() => {
    if (!mounted) return;
    applyAccentToDom(accent);
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  }, [accent, mounted]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', nextTheme);
    }
  }, []);

  const setAccent = useCallback((nextAccent: AccentTheme) => {
    if (!VALID_ACCENTS.includes(nextAccent)) return;
    setAccentState(nextAccent);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
      applyAccentToDom(nextAccent);
    }

    // Persist asynchronously to UserSettings (Dexie + Supabase sync)
    void (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const existing = await getSettings(session.user.id);
        const nextCounter = (existing?.generationCounter || 0) + 1;
        await updateSettings({
          userId: session.user.id,
          accent: nextAccent,
          generationCounter: nextCounter,
          isDirty: true,
        });

        const updated = await getSettings(session.user.id);
        if (updated) {
          await getSyncEngine().pushUserSettings(updated);
        }
      } catch {
        // Saved locally; background sync will reconcile when online
      }
    })();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, accent, setAccent }}>
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
