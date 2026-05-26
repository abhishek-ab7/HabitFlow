'use client';

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import ShortcutsModal from '@/components/ui/ShortcutsModal';

export function ShortcutsProvider() {
  useKeyboardShortcuts();
  return <ShortcutsModal />;
}
