'use client';

import { useEffect } from 'react';
import { useFitnessStore } from '@/lib/stores/fitness';
import { getSupabaseClient } from '@/lib/supabase/client';

const BLOCKED_SHORTCUT_TAGS = new Set(['INPUT', 'TEXTAREA']);

function isToggleShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
}

function isQuickKeyShortcut(e: KeyboardEvent): boolean {
  const isUnmodifiedQ = e.key.toLowerCase() === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey;
  if (!isUnmodifiedQ) return false;
  return !BLOCKED_SHORTCUT_TAGS.has(document.activeElement?.tagName || '');
}

export function useQuickCaptureShortcuts(setIsOpen: React.Dispatch<React.SetStateAction<boolean>>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isToggleShortcut(e)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (isQuickKeyShortcut(e)) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    const handleCustomOpen = () => setIsOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-quick-capture', handleCustomOpen);

    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('capture') === '1') {
      setIsOpen(true);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-quick-capture', handleCustomOpen);
    };
  }, [setIsOpen]);
}

async function resolveActiveUserId(fallbackUserId: string): Promise<string> {
  let uid = useFitnessStore.getState().currentUserId || fallbackUserId || 'local-demo-user';
  try {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    if (session?.user?.id) uid = session.user.id;
  } catch {
    // Offline / demo session
  }
  return uid;
}

export function useQuickCaptureHydration(params: {
  isOpen: boolean;
  sessionUserId: string;
  setSessionUserId: React.Dispatch<React.SetStateAction<string>>;
  accountsLength: number;
  categoriesLength: number;
  fitnessLoaded: boolean;
  loadFinanceData: (uid: string) => Promise<unknown>;
  loadFitnessData: (uid: string) => Promise<unknown>;
}) {
  const { isOpen, sessionUserId, setSessionUserId, accountsLength, categoriesLength, fitnessLoaded, loadFinanceData, loadFitnessData } = params;
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const hydrate = async () => {
      const uid = await resolveActiveUserId(sessionUserId);
      if (!active) return;
      setSessionUserId(uid);
      if (accountsLength === 0 || categoriesLength === 0) loadFinanceData(uid).catch(() => undefined);
      if (!fitnessLoaded) loadFitnessData(uid).catch(() => undefined);
    };
    void hydrate();
    return () => { active = false; };
  }, [isOpen, sessionUserId, setSessionUserId, accountsLength, categoriesLength, fitnessLoaded, loadFinanceData, loadFitnessData]);
}
