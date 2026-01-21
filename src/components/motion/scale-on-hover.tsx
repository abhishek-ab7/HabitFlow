'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ScaleOnHoverProps extends HTMLMotionProps<'div'> {
  scale?: number;
  lift?: boolean;
}

export const ScaleOnHover = forwardRef<HTMLDivElement, ScaleOnHoverProps>(
  ({ children, scale = 1.02, lift = true, className, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn('transition-shadow', className)}
        whileHover={{ 
          scale,
          y: lift ? -4 : 0,
        }}
        whileTap={{ scale: 0.98 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 25,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

ScaleOnHover.displayName = 'ScaleOnHover';
