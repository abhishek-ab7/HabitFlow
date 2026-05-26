'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in an input/textarea
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      console.log('ShortcutsModal keydown event:', event.key, 'code:', event.code, 'shift:', event.shiftKey);
      if (event.key === '?' && event.shiftKey) {
        event.preventDefault();
        setIsOpen(prev => !prev);
      } else if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleToggle = () => {
      console.log('ShortcutsModal toggle-shortcuts event received');
      setIsOpen(prev => !prev);
    };

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 relative overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-lg">Keyboard Shortcuts</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* List of shortcuts */}
            <div className="space-y-4">
              {/* Navigation Group */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Navigation</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Go to Dashboard</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono shadow-sm">D</kbd>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Go to Habits</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono shadow-sm">H</kbd>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Go to Goals</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono shadow-sm">G</kbd>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Go to Analytics</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono shadow-sm">A</kbd>
                  </div>
                </div>
              </div>

              {/* Actions Group */}
              <div className="border-t pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Actions</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Create New Habit</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono shadow-sm">N</kbd>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Create New Goal</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono shadow-sm">C</kbd>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Toggle Shortcuts Menu</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono shadow-sm">Shift+?</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Shift+?</kbd> or <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Esc</kbd> to close at any time.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
