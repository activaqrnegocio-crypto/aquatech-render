// src/lib/push-native.ts
// Registro de token FCM para Android nativo
// NO reemplaza push.ts — es complementario

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// v412: Handler para notificaciones foreground
// Este handler se invoca desde pushNotificationReceived cuando llega una notificación
let foregroundMessageHandler: ((notification: any) => void) | null = null;

export function setForegroundMessageHandler(handler: (notification: any) => void) {
  foregroundMessageHandler = handler;
}

// v412: Mostrar notificación nativa del sistema
async function showNativeNotification(title: string, body: string, data?: Record<string, string>) {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    // Crear canal si no existe
    await LocalNotifications.createChannel({
      id: 'foreground',
      name: 'Notificaciones Aquatech',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    
    await LocalNotifications.schedule({
      notifications: [{
        id: Date.now() % 100000,
        title,
        body,
        channelId: 'foreground',
      }]
    });
    console.log('[PushNative] Notificación native mostrada:', title);
  } catch (e) {
    console.warn('[PushNative] Error mostrando notificación native:', e);
  }
}

export async function registerFCMToken(userId: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[PushNative] No es plataforma nativa, omitiendo registro FCM');
    return;
  }

  try {
    // v415: PushNotifications para foreground y tap handling
    // 1. Manejar notificaciones cuando la app está en primer plano
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNative] pushNotificationReceived (foreground):', JSON.stringify(notification));
      
      // Mostrar notificación nativa del sistema
      showNativeNotification(
        notification.title || 'Aquatech',
        notification.body || '',
        notification.data
      );
      
      // También invocar el handler de foreground si está configurado
      if (foregroundMessageHandler) {
        foregroundMessageHandler(notification);
      }
    });

    // 2. Manejar tap en notificación (app en background o cerrada)
    PushNotifications.addListener('pushNotificationActionPerformed', async (action) => {
      console.log('[PushNative] Tap en notificación:', JSON.stringify(action));
      const notification = action.notification || {};
      const data = notification.data || {};
      const url = data.url || '';

      console.log('[PushNative] URL de navegación:', url);
      console.log('[PushNative] Data completa:', JSON.stringify(data));

      // v-fix: Obtener el rol del usuario para navegar correctamente según su perfil
      let userRole: string = 'OPERADOR';
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const session = await res.json();
          userRole = session?.user?.role || 'OPERADOR';
        }
      } catch (e) {
        console.warn('[PushNative] No se pudo obtener sesión, usando OPERADOR por defecto');
      }
      console.log('[PushNative] Rol del usuario:', userRole);

      // Helper: resuelve URL_PROJECT_CHAT:123 al slug correcto según rol
      function resolveProjectChatUrl(rawUrl: string, role: string): string {
        if (rawUrl.startsWith('URL_PROJECT_CHAT:')) {
          const parts = rawUrl.replace('URL_PROJECT_CHAT:', '').split(':');
          const projectId = parts[0];
          const upperRole = role.toUpperCase();
          if (['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(upperRole)) {
            return `/admin/proyectos/${projectId}?view=CHAT`;
          } else if (upperRole === 'SUBCONTRATISTA') {
            return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
          } else {
            return `/admin/operador/proyecto/${projectId}?view=chat`;
          }
        }
        if (rawUrl.startsWith('URL_PROJECT:')) {
          const projectId = rawUrl.replace('URL_PROJECT:', '');
          const upperRole = role.toUpperCase();
          if (['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(upperRole)) {
            return `/admin/proyectos/${projectId}?view=CHAT`;
          } else if (upperRole === 'SUBCONTRATISTA') {
            return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
          } else {
            return `/admin/operador/proyecto/${projectId}?view=chat`;
          }
        }
        return rawUrl;
      }

      if (url.startsWith('URL_PROJECT_CHAT:') || url.startsWith('URL_PROJECT:')) {
        const navUrl = resolveProjectChatUrl(url, userRole);
        console.log('[PushNative] Navegando a proyecto/chat según rol:', navUrl);
        window.location.href = navUrl;
      } else if (url.startsWith('URL_TASK:')) {
        const parts = url.replace('URL_TASK:', '').split(':');
        const projectId = parts[0];
        const appointmentId = parts[1];
        console.log('[PushNative] Navegando a tarea:', appointmentId, 'proyecto:', projectId);
        window.location.href = `/admin/calendario?task=${appointmentId}&project=${projectId}`;
      } else if (data.projectId) {
        const navUrl = resolveProjectChatUrl(`URL_PROJECT_CHAT:${data.projectId}`, userRole);
        console.log('[PushNative] Navegando a proyecto (data.projectId):', navUrl);
        window.location.href = navUrl;
      } else if (data.type === 'appointment') {
        window.location.href = '/admin/calendario';
      } else if (data.type === 'chat') {
        window.location.href = '/admin/proyectos';
      } else if (data.type === 'new-project') {
        window.location.href = '/admin/proyectos';
      } else if (data.type === 'info' || data.type === 'announcement') {
        // v610: Las notificaciones de campana (info/announcement) NO hacen nada al tocarlas
        console.log('[PushNative] Notificación de campana, no se navega');
      } else {
        console.log('[PushNative] Navegando a dashboard (default)');
        window.location.href = '/admin';
      }
    });

    // 3. Manejar errores de registro
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNative] Error de registro FCM:', error);
    });

    // 4. Solicitar permiso al usuario
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('[PushNative] Permiso de notificaciones denegado');
      return;
    }

    // 5. Crear canal para Android 8+ (OBLIGATORIO)
    await PushNotifications.createChannel({
      id: 'default',
      name: 'Notificaciones Aquatech',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    console.log('[PushNative] Canal de notificaciones creado');

    // 6. LISTENER DE REGISTRATION - después de los otros listeners
    PushNotifications.addListener('registration', async (token) => {
      console.log('[PushNative] Token FCM recibido:', token.value, 'userId:', userId);

      // 4. Enviar token al backend
      try {
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'fcm',           // Distinguir de VAPID
            token: token.value,
            userId,
          }),
        });
        console.log('[PushNative] Request body:', JSON.stringify({ type: 'fcm', token: token.value, userId }));

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          console.log('[PushNative] Token FCM guardado en backend:', JSON.stringify(data));
          
          // v412: Mostrar notificación local usando LocalNotifications (funciona en foreground)
          try {
            // Primero crear el canal si no existe
            await LocalNotifications.createChannel({
              id: 'confirmacion',
              name: 'Confirmación Aquatech',
              importance: 4,
              visibility: 1,
              sound: 'default',
              vibration: true,
            });
            
            // Mostrar notificación local
            await LocalNotifications.schedule({
              notifications: [{
                id: Date.now() % 100000,
                title: '✅ Notificaciones activadas',
                body: '¡Perfecto! A partir de ahora recibirás alertas de Aquatech.',
                channelId: 'confirmacion',
              }]
            });
            console.log('[PushNative] Notificación local mostrada');
          } catch (e) {
            console.warn('[PushNative] Error mostrando notificación local:', e);
            alert('¡Notificaciones activadas! Recibirás alertas de proyectos y mensajes.');
          }
          
          // v410: Enviar notificación de prueba desde el servidor para confirmar
          try {
            await fetch('/api/push/test', { 
              method: 'POST',
              credentials: 'include'  // Incluir cookies de sesión
            });
            console.log('[PushNative] Notificación de prueba enviada');
          } catch (e) {
            console.warn('[PushNative] Error enviando notificación de prueba:', e);
          }
        } else {
          const text = await response.text().catch(() => 'unknown error');
          console.error('[PushNative] Error guardando token:', response.status, text);
        }
      } catch (err) {
        console.error('[PushNative] Error enviando token al backend:', err);
      }
    });

    // 7. REGISTER AL FINAL - después de tener los listeners
    await PushNotifications.register();
    console.log('[PushNative] Dispositivo registrado para notificaciones');
  } catch (err) {
    console.error('[PushNative] Error en registro FCM:', err);
  }
}
