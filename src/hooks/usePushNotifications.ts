'use client'

import { useState, useEffect, useCallback } from 'react'

type PushStatus = 'loading' | 'unsupported' | 'denied' | 'prompt' | 'subscribed' | 'unsubscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // 1. Limpieza agresiva: eliminar comillas, espacios y caracteres no base64url
  const base64Clean = base64String.replace(/['"]/g, '').trim();
  
  // 2. Cálculo de padding estándar
  const padding = '='.repeat((4 - (base64Clean.length % 4)) % 4);
  const base64 = (base64Clean + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  try {
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    // Log de seguridad para depuración en consola
    console.log(`[PUSH] VAPID Key decodificada: ${outputArray.length} bytes`);
    return outputArray;
  } catch (err) {
    console.error('[PUSH] Error crítico decodificando VAPID Key. La llave en el .env podría estar corrupta.');
    throw err;
  }
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported')
      return
    }

    // Check current permission
    const permission = Notification.permission
    if (permission === 'denied') {
      setStatus('denied')
      return
    }

    // Check if already subscribed
    navigator.serviceWorker.ready.then(registration => {
      registration.pushManager.getSubscription().then(sub => {
        if (sub) {
          setStatus('subscribed')
        } else {
          setStatus(permission === 'granted' ? 'unsubscribed' : 'prompt')
        }
      })
    }).catch(() => {
      setStatus('unsupported')
    })
  }, [])

  const subscribe = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (status === 'unsupported') return { success: false, error: 'Tu navegador no soporta notificaciones.' };
    if (status === 'denied') return { success: false, error: 'Permiso denegado. Habilítalo en los ajustes del navegador.' };

    setIsSubscribing(true)
    
    const isSubRef = { current: true };
    const safetyTimeout = setTimeout(() => {
      if (isSubRef.current) {
        console.warn('[PUSH] Subscription timed out after 15s');
        setIsSubscribing(false);
        isSubRef.current = false;
      }
    }, 15000);

    const finishSub = (success: boolean) => {
      clearTimeout(safetyTimeout);
      setIsSubscribing(false);
      isSubRef.current = false;
      return success;
    };

    try {
      // 1. Request notification permission (v286: Robust callback fallback)
      console.log('[PUSH] Requesting permission...');
      let permission: NotificationPermission;
      try {
        permission = await Notification.requestPermission();
      } catch (e) {
        // Fallback for older browsers/iOS versions that use callbacks
        permission = await new Promise((resolve) => {
          Notification.requestPermission((result) => resolve(result));
        });
      }

      console.log('[PUSH] Permission result:', permission);
      if (permission !== 'granted') {
        setStatus('denied');
        console.warn('[PUSH] Permission denied by user');
        return { success: false, error: 'Permiso denegado por el usuario.' };
      }

      // 2. Get service worker registration
      console.log('[PUSH] Waiting for Service Worker ready...');
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        console.error('[PUSH] PushManager not available in this browser');
        setStatus('unsupported');
        return { success: false, error: 'Tu navegador no soporta notificaciones Push.' };
      }

      // 3. Subscribe to push
      const rawVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!rawVapidKey) {
        console.error('[PUSH] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing in the environment');
        return { success: false, error: 'Falta configuración en el servidor (VAPID Key).' };
      }
      
      const vapidKey = rawVapidKey.trim();
      console.log('[PUSH] Subscribing with VAPID key (first 10 chars):', vapidKey.substring(0, 10) + '...');

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as any
      });

      console.log('[PUSH] Subscription successful, sending to server...');

      // 4. Send subscription to server
      const subJson = subscription.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth
            }
          },
          deviceName: getDeviceName()
        })
      });

      if (res.ok) {
        console.log('[PUSH] Server registration successful');
        setStatus('subscribed');

        // 5. Send test notification
        fetch('/api/push/test', { method: 'POST' }).catch(() => {});
        
        // Trigger onboarding for mobile devices
        const isMobile = /android|iphone|ipad/i.test(navigator.userAgent);
        if (isMobile) {
          setShowOnboarding(true);
        }

        return { success: finishSub(true) };
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('[PUSH] Server rejected subscription:', res.status, errorData);
        return { success: finishSub(false), error: `El servidor rechazó la suscripción (${res.status})` };
      }
    } catch (error: any) {
      console.error('[PUSH] Subscription error details:', error);
      return { 
        success: finishSub(false), 
        error: `Error técnico: ${error.message || 'Desconocido'}` 
      };
    }
  }, [status])

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()

        // Remove from server
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint })
        })
      }

      setStatus('unsubscribed')
      return true
    } catch (error) {
      console.error('[PUSH] Unsubscribe error:', error)
      return false
    }
  }, [])

  return {
    status,
    isSubscribing,
    subscribe,
    unsubscribe,
    showOnboarding,
    setShowOnboarding,
    isSupported: status !== 'unsupported',
    isSubscribed: status === 'subscribed',
  }
}


function getDeviceName(): string {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'Android'
  if (/iPad|iPhone|iPod/.test(ua)) return 'iOS'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac/.test(ua)) return 'Mac'
  return 'Desconocido'
}
