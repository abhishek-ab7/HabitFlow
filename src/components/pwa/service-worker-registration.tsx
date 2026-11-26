'use client';

import { useEffect } from 'react';

function isServiceWorkerSupported(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator;
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!isServiceWorkerSupported()) return;

    let isMounted = true;
    let updateIntervalId: number | undefined;

    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((registration) => {
          if (!isMounted) return;
          registration.update().catch(() => {});
          updateIntervalId = window.setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') registerSW();
    else window.addEventListener('load', registerSW);

    return () => {
      isMounted = false;
      window.removeEventListener('load', registerSW);
      if (updateIntervalId !== undefined) window.clearInterval(updateIntervalId);
    };
  }, []);

  return null;
}
