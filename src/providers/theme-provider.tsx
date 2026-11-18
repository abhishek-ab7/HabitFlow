'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setTheme(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    
    // Remove all theme classes first
    root.classList.remove('light', 'dark', 'theme-morning', 'theme-afternoon', 'theme-night');

    let newResolved: 'light' | 'dark';
    let classesToAdd: string[] = [];

    if (theme === 'system') {
      newResolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      classesToAdd.push(newResolved);
    } else if (theme === 'auto') {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) {
        newResolved = 'light';
        classesToAdd.push('theme-morning');
      } else if (hour >= 12 && hour < 18) {
        newResolved = 'light';
        classesToAdd.push('theme-afternoon');
      } else {
        newResolved = 'dark';
        classesToAdd.push('theme-night', 'dark');
      }
    } else {
      newResolved = theme as 'light' | 'dark';
      classesToAdd.push(newResolved);
    }

    root.classList.add(...classesToAdd);
    setResolvedTheme(newResolved);

    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  // Listen for system theme changes and time changes for auto
  useEffect(() => {
    if (!mounted) return;

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark', 'theme-morning', 'theme-afternoon', 'theme-night');
        const newTheme = e.matches ? 'dark' : 'light';
        root.classList.add(newTheme);
        setResolvedTheme(newTheme);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (theme === 'auto') {
      // Check every minute if time theme needs to change
      const interval = setInterval(() => {
        const hour = new Date().getHours();
        const root = window.document.documentElement;
        
        let shouldUpdate = false;
        let isDark = hour >= 18 || hour < 5;
        
        if (isDark && !root.classList.contains('theme-night')) shouldUpdate = true;
        if (hour >= 5 && hour < 12 && !root.classList.contains('theme-morning')) shouldUpdate = true;
        if (hour >= 12 && hour < 18 && !root.classList.contains('theme-afternoon')) shouldUpdate = true;

        if (shouldUpdate) {
          root.classList.remove('light', 'dark', 'theme-morning', 'theme-afternoon', 'theme-night');
          if (hour >= 5 && hour < 12) {
            root.classList.add('theme-morning');
            setResolvedTheme('light');
          } else if (hour >= 12 && hour < 18) {
            root.classList.add('theme-afternoon');
            setResolvedTheme('light');
          } else {
            root.classList.add('theme-night', 'dark');
            setResolvedTheme('dark');
          }
        }
      }, 60000);
      
      return () => clearInterval(interval);
    }
  }, [theme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
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
