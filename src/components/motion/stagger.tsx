'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { Children, forwardRef } from 'react';

interface StaggerContainerProps extends HTMLMotionProps<'div'> {
  staggerDelay?: number;
  initialDelay?: number;
}

export const StaggerContainer = forwardRef<HTMLDivElement, StaggerContainerProps>(
  ({ children, staggerDelay = 0.05, initialDelay = 0, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              delayChildren: initialDelay,
              staggerChildren: staggerDelay,
            },
          },
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

StaggerContainer.displayName = 'StaggerContainer';

interface StaggerItemProps extends HTMLMotionProps<'div'> {
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
}

export const StaggerItem = forwardRef<HTMLDivElement, StaggerItemProps>(
  ({ children, direction = 'up', distance = 20, ...props }, ref) => {
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
        variants={{
          hidden: { 
            opacity: 0, 
            ...directions[direction] 
          },
          visible: { 
            opacity: 1, 
            x: 0, 
            y: 0,
            transition: {
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
            },
          },
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

StaggerItem.displayName = 'StaggerItem';
