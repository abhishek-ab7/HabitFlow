'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShortcutItem {
  label: string;
  keys: string;
}

const NAV_SHORTCUTS: ShortcutItem[] = [
  { label: 'Go to Dashboard', keys: 'D' },
  { label: 'Go to Habits', keys: 'H' },
  { label: 'Go to Goals', keys: 'G' },
  { label: 'Go to Analytics', keys: 'A' },
];

const ACTION_SHORTCUTS: ShortcutItem[] = [
  { label: 'Create New Habit', keys: 'N' },
  { label: 'Create New Goal', keys: 'C' },
  { label: 'Toggle Shortcuts Menu', keys: 'Shift+?' },
];

function isTypingInField(active: Element | null): boolean {
  if (!active) return false;
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true;
  return active.getAttribute('contenteditable') === 'true';
}

function ShortcutSection({ title, items, bordered }: { title: string; items: ShortcutItem[]; bordered?: boolean }) {
  return (
    <div className={bordered ? 'border-t pt-4' : undefined}>
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono shadow-sm">
              {item.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShortcutsModal({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingInField(document.activeElement)) return;
      if (event.key === '?' && event.shiftKey) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleToggle = () => setIsOpen((prev) => !prev);

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('toggle-shortcuts', handleToggle);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggle-shortcuts', handleToggle);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 relative overflow-hidden"
          >
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-lg">Keyboard Shortcuts</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <ShortcutSection title="Navigation" items={NAV_SHORTCUTS} />
              <ShortcutSection title="Actions" items={ACTION_SHORTCUTS} bordered />
            </div>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Shift+?</kbd> or <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Esc</kbd> to close at any time.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
