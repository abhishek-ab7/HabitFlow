'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { SplashScreen } from './SplashScreen';

export function AppStartupGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect authenticated users from '/' to '/dashboard' immediately on client-side
  useEffect(() => {
    if (!isLoading && isAuthenticated && pathname === '/') {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  return (
    <>
      <div className="flex-1 flex flex-col min-h-screen">
        {children}
      </div>
      {isLoading && pathname === '/' && (
        <div className="fixed inset-0 z-[9999]">
          <SplashScreen />
        </div>
      )}
    </>
  );
}
