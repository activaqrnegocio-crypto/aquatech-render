'use client'

import { useEffect } from 'react'

/**
 * Service Worker Registration — TEMPORARILY DISABLED.
 * This component now acts as a "kill switch" to unregister all active service workers
 * and prevent the sticky ERR_FAILED issue on Android WebAPK.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Unregister any existing service workers to clean up the browser state
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('[App] Successfully unregistered service worker:', registration.scope);
          }
        });
      }
    }).catch((err) => {
      console.warn('[App] Failed to unregister service workers:', err);
    });

    // We do NOT register any new service workers.
  }, []);

  return null;
}

