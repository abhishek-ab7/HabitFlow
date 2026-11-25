'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    let isMounted = true;
    let updateIntervalId: number | undefined;

    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((registration) => {
          if (!isMounted) return;

          // Proactively check for an updated SW immediately on page load
          registration.update().catch(() => {});

          // Check for updates periodically
          updateIntervalId = window.setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }

    return () => {
      isMounted = false;
      window.removeEventListener('load', registerSW);
      if (updateIntervalId !== undefined) window.clearInterval(updateIntervalId);
    };
  }, []);

  return null;
}
