'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { SplashScreen } from './SplashScreen';
import { AnimatePresence, motion } from 'framer-motion';

export function AppStartupGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [minimumTimerDone, setMinimumTimerDone] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // 1. Redirect authenticated users from '/' to '/dashboard' immediately on client-side
  useEffect(() => {
    if (!isLoading && isAuthenticated && pathname === '/') {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // 2. Minimum duration timer for splash screen (1.5 seconds for premium feel)
  useEffect(() => {
    const minSplashTimer = setTimeout(() => {
      setMinimumTimerDone(true);
    }, 1500);

    return () => clearTimeout(minSplashTimer);
  }, []);

  // 3. Resolve splash screen visibility
  useEffect(() => {
    if (minimumTimerDone && !isLoading) {
      // If we are currently redirecting an authenticated user away from '/', 
      // keep the splash screen up until navigation completes
      if (isAuthenticated && pathname === '/') {
        return;
      }
      setShowSplash(false);
    }
  }, [minimumTimerDone, isLoading, isAuthenticated, pathname]);

  return (
    <AnimatePresence mode="wait">
      {showSplash ? (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999]"
        >
          <SplashScreen />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col min-h-screen"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
