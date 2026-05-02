'use client'

import { useState, useEffect, useCallback } from 'react'

type PushStatus = 'loading' | 'unsupported' | 'denied' | 'prompt' | 'subscribed' | 'unsubscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
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

  const subscribe = useCallback(async () => {
    if (status === 'unsupported' || status === 'denied') return false

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

      clearTimeout(safetyTimeout);
      console.log('[PUSH] Permission result:', permission);
      if (permission !== 'granted') {
        setStatus('denied');
        return finishSub(false);
      }

      // 2. Get service worker registration
      const registration = await navigator.serviceWorker.ready

      // 3. Subscribe to push
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('[PUSH] VAPID public key not found')
        return finishSub(false)
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as any
      })

      // 4. Send subscription to server
      const subJson = subscription.toJSON()
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
      })

      if (res.ok) {
        setStatus('subscribed')

        // 5. Send test notification
        fetch('/api/push/test', { method: 'POST' }).catch(() => {})
        
        // Trigger onboarding for mobile devices
        const isMobile = /android|iphone|ipad/i.test(navigator.userAgent)
        if (isMobile) {
          setShowOnboarding(true)
        }

        return finishSub(true)
      } else {
        console.error('[PUSH] Server rejected subscription')
        return finishSub(false)
      }
    } catch (error) {
      console.error('[PUSH] Subscription error:', error)
      return finishSub(false)
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
