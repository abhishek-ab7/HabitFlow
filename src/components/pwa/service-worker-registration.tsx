'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let updateIntervalId: number | undefined;

    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);

          // Proactively check for an updated SW immediately on page load
          registration.update().catch(() => {});

          // Check for updates periodically
          updateIntervalId = window.setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 60 * 1000); // Check every hour
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
      registerSW();
      return () => {
        if (updateIntervalId !== undefined) window.clearInterval(updateIntervalId);
      };
    } else {
      window.addEventListener('load', registerSW);
      return () => {
        window.removeEventListener('load', registerSW);
        if (updateIntervalId !== undefined) window.clearInterval(updateIntervalId);
      };
    }
  }, []);

  return null;
}
