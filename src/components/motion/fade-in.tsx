'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
}

export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  ({ 
    children, 
    delay = 0, 
    duration = 0.4, 
    direction = 'up', 
    distance = 20,
    ...props 
  }, ref) => {
    const directions = {
      up: { y: distance },
      down: { y: -distance },
      left: { x: distance },
      right: { x: -distance },
      none: {},
    };

    return (
      <motion.div
        ref={ref}
        initial={{ 
          opacity: 0, 
          ...directions[direction] 
        }}
        animate={{ 
          opacity: 1, 
          x: 0, 
          y: 0 
        }}
        transition={{
          duration,
          delay,
          ease: [0.16, 1, 0.3, 1], // ease-out-expo
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

FadeIn.displayName = 'FadeIn';
