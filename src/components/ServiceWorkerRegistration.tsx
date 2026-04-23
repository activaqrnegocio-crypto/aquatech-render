'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((reg) => {
            console.log('[App] SW registered, scope:', reg.scope);
            // Check for updates every 30 minutes
            const interval = setInterval(() => {
              reg.update();
            }, 30 * 60 * 1000);
            return () => clearInterval(interval);
          })
          .catch((err) => {
            console.error('[App] SW registration failed:', err);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  return null;
}
