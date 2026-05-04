'use client'

import { useState, useEffect, useCallback } from 'react'

type PushStatus = 'loading' | 'unsupported' | 'denied' | 'prompt' | 'subscribed' | 'unsubscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // v295: Limpieza robusta que soporta Base64 estándar (+/) y URL-safe (-_)
  // Eliminamos cualquier espacio, comilla o caracter invisible
  const base64Clean = base64String.trim().replace(/["']/g, '').replace(/[^A-Za-z0-9\-_+/]/g, '');
  
  if (!base64Clean) {
    console.error('[PUSH] La llave VAPID está vacía después de la limpieza');
    throw new Error('La llave VAPID está vacía o es inválida en el .env');
  }

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
    return outputArray;
  } catch (err) {
    console.error('[PUSH] Error crítico en atob decodificando VAPID:', err);
    console.log('[PUSH] Valor fallido (limpio):', base64);
    throw new Error('La llave VAPID no tiene un formato Base64 válido. Verifica tu .env');
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

    // If permission is default, they are definitely not subscribed. Show prompt instantly!
    if (permission === 'default') {
      setStatus('prompt')
      return
    }

    // Solo esperamos a SW ready si el permiso ya fue otorgado
    // Añadimos un timeout de 3 segundos para evitar que la UI se quede en "loading" eternamente
    let isTimeout = false;
    const checkTimeout = setTimeout(() => {
      isTimeout = true;
      setStatus(permission === 'granted' ? 'unsubscribed' : 'prompt');
    }, 3000);

    navigator.serviceWorker.ready.then(registration => {
      registration.pushManager.getSubscription().then(sub => {
        clearTimeout(checkTimeout);
        if (isTimeout) return; // Si ya pasó el timeout, no cambiamos el estado
        
        if (sub) {
          setStatus('subscribed');
        } else {
          setStatus(permission === 'granted' ? 'unsubscribed' : 'prompt');
        }
      }).catch(() => {
        clearTimeout(checkTimeout);
        if (!isTimeout) setStatus('unsupported');
      });
    }).catch(() => {
      clearTimeout(checkTimeout);
      if (!isTimeout) setStatus('unsupported');
    });
  }, []);

  const subscribe = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (status === 'unsupported') return { success: false, error: 'Tu navegador no soporta notificaciones.' };
    if (status === 'denied') return { success: false, error: 'Permiso denegado. Habilítalo en los ajustes del navegador.' };

    setIsSubscribing(true);
    
    let isTimeout = false;

    // Convertimos todo en una promesa para poder rechazarla con el timeout
    return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
      const finishSub = (success: boolean, error?: string) => {
        setIsSubscribing(false);
        resolve({ success, error });
      };

      const safetyTimeout = setTimeout(() => {
        isTimeout = true;
        console.warn('[PUSH] Subscription timed out after 15s');
        finishSub(false, 'Tiempo de espera agotado. Verifica tu conexión a internet.');
      }, 15000);

      try {
        // 1. Request notification permission (v286: Robust callback fallback)
        console.log('[PUSH] Requesting permission...');
        let permission: NotificationPermission;
        try {
          permission = await Notification.requestPermission();
        } catch (e) {
          // Fallback for older browsers/iOS versions that use callbacks
          permission = await new Promise((res) => {
            Notification.requestPermission((result) => res(result));
          });
        }

        if (isTimeout) return;

        console.log('[PUSH] Permission result:', permission);
        if (permission !== 'granted') {
          setStatus('denied');
          console.warn('[PUSH] Permission denied by user');
          clearTimeout(safetyTimeout);
          return finishSub(false, 'Permiso denegado por el usuario.');
        }

      // 2. Get service worker registration
      console.log('[PUSH] Waiting for Service Worker ready...');
      const registration = await navigator.serviceWorker.ready;
      if (isTimeout) return;

      if (!registration.pushManager) {
        console.error('[PUSH] PushManager not available in this browser');
        setStatus('unsupported');
        clearTimeout(safetyTimeout);
        return finishSub(false, 'Tu navegador no soporta notificaciones Push.');
      }

      // 3. Get VAPID key from server (v296: Dynamic runtime fetch to bypass Docker build-time issues)
      console.log('[PUSH] Fetching VAPID key from server...');
      const configRes = await fetch('/api/push/config');
      if (isTimeout) return;

      if (!configRes.ok) {
        clearTimeout(safetyTimeout);
        return finishSub(false, 'No se pudo obtener la configuración de notificaciones del servidor.');
      }
      const { publicKey: vapidKey, error: serverError } = await configRes.json();
      
      if (serverError) {
        clearTimeout(safetyTimeout);
        return finishSub(false, `Error del servidor: ${serverError}`);
      }

      if (!vapidKey || vapidKey === 'dummy') {
        console.error('[PUSH] Invalid VAPID key received:', vapidKey);
        clearTimeout(safetyTimeout);
        return finishSub(false, `Error de Configuración: La llave VAPID recibida es ${!vapidKey ? 'nula' : 'dummy'}. Verifica las variables NEXT_PUBLIC_VAPID_PUBLIC_KEY en el servidor.`);
      }
      
      console.log('[PUSH] Subscribing with dynamic VAPID key (first 10 chars):', vapidKey.substring(0, 10) + '...');

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as any
      });

      if (isTimeout) return;

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

      if (isTimeout) return;

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

        clearTimeout(safetyTimeout);
        return finishSub(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('[PUSH] Server rejected subscription:', res.status, errorData);
        clearTimeout(safetyTimeout);
        return finishSub(false, `El servidor rechazó la suscripción (${res.status})`);
      }
    } catch (error: any) {
      console.error('[PUSH] Subscription error details:', error);
      clearTimeout(safetyTimeout);
      if (!isTimeout) {
        return finishSub(false, `Error técnico: ${error.message || 'Desconocido'}`);
      }
    }
    });
  }, [status]);

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
