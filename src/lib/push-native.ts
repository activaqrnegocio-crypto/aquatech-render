// src/lib/push-native.ts
// Registro de token FCM para Android nativo
// NO reemplaza push.ts — es complementario

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { parseProjectChatUrl } from './pending-nav';

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
  console.log('[PushNative] showNativeNotification start. title:', title, 'body:', body);
  
  if (!Capacitor.isNativePlatform()) {
    console.log('[PushNative] showNativeNotification: not native platform, skipping');
    return;
  }
  
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
    
    const notifId = Date.now() % 100000;
    console.log('[PushNative] showNativeNotification. Generated ID:', notifId);
    
    const checkPerms = await LocalNotifications.checkPermissions();
    console.log('[PushNative] showNativeNotification. checkPermissions result:', JSON.stringify(checkPerms));
    
    await LocalNotifications.schedule({
      notifications: [{
        id: notifId,
        title,
        body,
        channelId: 'foreground',
      }]
    });
    console.log('[PushNative] Notificación native mostrada:', title, 'ID:', notifId);
  } catch (e) {
    console.error('[PushNative] Error mostrando notificación native. error:', JSON.stringify(e));
  }
}

export async function registerFCMToken(userId: number): Promise<boolean | false> {
  console.log('[PushNative] registerFCMToken start. userId:', userId, 'isNativePlatform:', Capacitor.isNativePlatform());
  
  if (!Capacitor.isNativePlatform()) {
    console.log('[PushNative] No es plataforma nativa, omitiendo registro FCM');
    return false;
  }

  try {
    // v417: NO mostrar notificaciones aquí - el servicio nativo AquatechFirebaseMessagingService
    // es la ÚNICA fuente de notificaciones. Esto evita duplicados en foreground.
    // El listener solo registra el evento y pasa datos al handler si existe
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNative] pushNotificationReceived (solo log, sin mostrar). notification:', JSON.stringify(notification));
      
      // NO llamar a showNativeNotification() - el servicio nativo Android muestra todo
      // Solo invocar el handler de foreground si está configurado para lógica interna
      if (foregroundMessageHandler) {
        foregroundMessageHandler(notification);
      }
    });

    // 2. Manejar tap en notificación (app en background o cerrada)
    // v421: Usar parseProjectChatUrl para consistencia
    PushNotifications.addListener('pushNotificationActionPerformed', async (action) => {
      console.log('[PushNative] Tap en notificación:', JSON.stringify(action));
      const notification = action.notification || {};
      const data = notification.data || {};
      const url = data.url || '';
      
      console.log('[PushNative] URL recibida:', url);
      console.log('[PushNative] Data completa:', JSON.stringify(data));
      
      // v421: Obtener el rol del usuario para navegación correcta
      let userRole = 'ADMIN'; // Default
      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        userRole = sessionData?.user?.role || 'ADMIN';
      } catch (e) {
        console.log('[PushNative] Error obteniendo sesión:', e);
      }
      console.log('[PushNative] User role para navegación:', userRole);
      
      // Usar parseProjectChatUrl para consistencia
      if (url.startsWith('URL_PROJECT_CHAT:')) {
        const navigateUrl = parseProjectChatUrl(url, userRole);
        console.log('[PushNative] Navegando a:', navigateUrl);
        window.location.href = navigateUrl;
      } else if (url.startsWith('URL_TASK:')) {
        // Tarea: URL_TASK:projectId:appointmentId → /admin/calendario?task=X&project=Y
        const parts = url.replace('URL_TASK:', '').split(':');
        const projectId = parts[0];
        const appointmentId = parts[1];
        window.location.href = `/admin/calendario?task=${appointmentId}&project=${projectId}`;
      } else if (data.projectId) {
        window.location.href = `/admin/proyectos/${data.projectId}`;
      } else if (data.type === 'appointment') {
        window.location.href = '/admin/calendario';
      } else if (data.type === 'chat') {
        window.location.href = '/admin/proyectos';
      } else if (data.type === 'new-project') {
        window.location.href = '/admin/proyectos/nuevo';
      } else if (data.type === 'info' || data.type === 'announcement') {
        // v610: Las notificaciones de campana (info/announcement) NO hacen nada al tocarlas
        console.log('[PushNative] Notificación de campana, no se navega');
      } else if (url && url.startsWith('/')) {
        // Es una URL relativa
        window.location.href = url;
      } else {
        // Default: ir a dashboard según rol
        if (userRole === 'OPERATOR' || userRole === 'OPERADOR') {
          window.location.href = '/admin/operador';
        } else if (userRole === 'SUBCONTRATISTA') {
          window.location.href = '/admin/subcontratista';
        } else {
          window.location.href = '/admin';
        }
      }
    });

    // 3. Manejar errores de registro
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNative] registrationError. error:', JSON.stringify(error));
    });

    // 4. Solicitar permiso al usuario
    const permission = await PushNotifications.requestPermissions();
    console.log('[PushNative] Permission result:', JSON.stringify(permission));
    
    if (permission.receive !== 'granted') {
      console.log('[PushNative] Permiso de notificaciones DENEGADO');
      
      // v416: Informar al usuario que necesita habilitar notificaciones manualmente
      // Android 13+ requiere permiso del usuario - no se puede solicitar programáticamente después de negar
      alert(
        '🔕 Notificaciones bloqueadas\n\n' +
        'Para recibir notificaciones de Aquatech CRM:\n\n' +
        '1. Ve a Configuración > Apps > Aquatech CRM\n' +
        '2. Toca "Notificaciones"\n' +
        '3. Activa todas las opciones de notificación\n\n' +
        'Luego cierra y abre la app para intentar de nuevo.'
      );
      return false;  // v416: Indicar que el registro falló
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
          
          // Eliminada notificación falsa de confirmación
          // Las notificaciones ahora vienen del servidor via FCM data-only
          
          // v410: Enviar notificación de prueba desde el servidor via FCM
          // La notificación real llegará via notificationReceived si todo funciona
          try {
            await fetch('/api/push/test', { 
              method: 'POST',
              credentials: 'include'  // Incluir cookies de sesión
            });
            console.log('[PushNative] Notificación de prueba enviada via FCM');
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
    
    return true;  // v416: Registro exitoso

  } catch (err) {
    console.error('[PushNative] Error inicializando FCM:', err);
    return false;  // v416: Registro fallido
  }
}

// ============================================
// DESREGISTRAR (logout)
// ============================================
export async function unregisterFCMToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.unregister();
    console.log('[PushNative] Token FCM desregistrado');
  } catch (err) {
    console.error('[PushNative] Error desregistrando:', err);
  }
}
