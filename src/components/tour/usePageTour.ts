'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UsePageTourOptions {
  autoPrompt?: boolean;
  delayMs?: number;
}

export function usePageTour(tourKey: string, options: UsePageTourOptions = {}) {
  const { autoPrompt = true, delayMs = 600 } = options;
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!autoPrompt) return;

    try {
      const storageKey = `habitflow_tour_${tourKey}_completed`;
      const isCompleted = localStorage.getItem(storageKey) === 'true';
      
      // Also check legacy dashboard key if tourKey is dashboard
      if (tourKey === 'dashboard') {
        const legacyCompleted = localStorage.getItem('habitflow_dashboard_tutorial_completed') === 'true';
        if (legacyCompleted) return;
      }

      if (!isCompleted) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, delayMs);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      // Graceful fallback if localStorage is disabled
    }
  }, [tourKey, autoPrompt, delayMs]);

  const startTour = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
  }, []);

  const completeTour = useCallback(() => {
    try {
      localStorage.setItem(`habitflow_tour_${tourKey}_completed`, 'true');
      if (tourKey === 'dashboard') {
        localStorage.setItem('habitflow_dashboard_tutorial_completed', 'true');
      }
    } catch (e) {}
    setIsOpen(false);
  }, [tourKey]);

  return {
    isOpen,
    startTour,
    closeTour,
    completeTour,
  };
}
