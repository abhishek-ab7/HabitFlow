'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SuccessRippleProps {
  trigger: boolean;
  className?: string;
  color?: string;
}

export function SuccessRipple({ 
  trigger, 
  className,
  color = 'bg-success/30',
}: SuccessRippleProps) {
  return (
    <AnimatePresence>
      {trigger && (
        <motion.div
          className={cn(
            'absolute inset-0 rounded-lg pointer-events-none',
            color,
            className
          )}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      )}
    </AnimatePresence>
  );
}
