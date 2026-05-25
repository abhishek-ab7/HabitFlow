'use client';

import { useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';

export function ServiceWorkerRegistration() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Only register service worker after auth is loaded and user is authenticated
    // This prevents issues with service worker caching login pages
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Wait for auth to finish loading
    if (isLoading) {
      return;
    }

    // Only register if authenticated to avoid caching auth redirects
    if (!isAuthenticated) {
      // Unregister any existing service workers if user is not authenticated
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

    // Register service worker after page load
    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000); // Check every hour
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
      return () => window.removeEventListener('load', registerSW);
    }
  }, [isAuthenticated, isLoading]);

  return null;
}
