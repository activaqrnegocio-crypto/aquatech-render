# ✅ Checklist de Progreso — Migración a App Móvil

> Actualizar este checklist conforme se avance en cada fase.
> **Estado**: 🔴 No iniciado

---

## Fase 1: Configuración Base
**Estimado**: 3-4 días | **Estado**: 🔴

- [ ] Instalar dependencias de Capacitor
  ```bash
  npm install @capacitor/core @capacitor/cli
  npx cap init "Aquatech CRM" "com.aquatech.crm" --web-dir=out
  ```
- [ ] Instalar plugins nativos esenciales
  ```bash
  npm install @capacitor/splash-screen @capacitor/status-bar
  npm install @capacitor/push-notifications @capacitor/camera
  npm install @capacitor/filesystem @capacitor/browser
  ```
- [ ] Crear `capacitor.config.ts` con configuración correcta
- [ ] Instalar Android Studio + Android SDK (API 34)
- [ ] Agregar plataforma Android
  ```bash
  npx cap add android
  ```
- [ ] Configurar signing keystore para APK
- [ ] Primer build de prueba exitoso
- [ ] APK instala y abre en emulador

---

## Fase 2: Integración Web → Nativa
**Estimado**: 5-7 días | **Estado**: 🔴

- [ ] Decidir modo: **Server URL** vs **Local Build**
  - Server URL: WebView carga `https://crm.aquatech.com`
  - Local Build: Copia estática dentro del APK
  - **Recomendado**: Server URL (para mantener un solo deployment)
- [ ] Configurar `server.url` en capacitor.config.ts
- [ ] Probar autenticación (NextAuth) funciona en WebView
- [ ] Resolver CORS si hay problemas
- [ ] Probar Service Worker registra correctamente en WebView
- [ ] Probar IndexedDB funciona en WebView
- [ ] Splash screen con logo Aquatech (#036BB2)
- [ ] Status bar theming (color corporativo)
- [ ] Configurar deep links scheme: `aquatech://`
- [ ] App icon generado (adaptive icon Android)
- [ ] Verificar offline shells cargan correctamente

---

## Fase 3: Push Notifications Nativas
**Estimado**: 3-5 días | **Estado**: 🔴

- [ ] Crear proyecto en Firebase Console
- [ ] Descargar `google-services.json` → `android/app/`
- [ ] Implementar `PushNotificationBridge.ts`
  - Detectar si es Capacitor o Web
  - Usar FCM en Capacitor, Web Push en browser
- [ ] Registrar FCM token en backend
  - Modificar `/api/push/subscribe` para aceptar FCM tokens
- [ ] Modificar `push.ts` (servidor) para enviar via FCM API
- [ ] Probar notificación llega en background
- [ ] Probar notificación llega con app cerrada
- [ ] Probar deep link desde notificación → proyecto específico
- [ ] Dual-registration: web + native tokens coexisten

---

## Fase 4: Features Nativos
**Estimado**: 3-5 días | **Estado**: 🔴

- [ ] Cámara nativa (Capacitor Camera)
  - Modificar `MediaCapture.tsx` para usar plugin nativo
  - Fallback a HTML5 Camera API si no es Capacitor
- [ ] Biometric authentication
  - Plugin: `@capacitor-community/biometric-auth`
  - Integrar en login flow
  - Guardar session token en Keystore
- [ ] Filesystem access
  - Export PDF directo a Descargas
  - Export Excel directo a Descargas
- [ ] App badge para notificaciones pendientes
  - Plugin: `@capacitor/badge`
- [ ] Haptic feedback en acciones importantes

---

## Fase 5: Testing y QA
**Estimado**: 3-5 días | **Estado**: 🔴

### Funcionalidad Core
- [ ] Login funciona
- [ ] Dashboard admin carga correctamente
- [ ] Dashboard operador carga correctamente
- [ ] Crear proyecto funciona
- [ ] Editar proyecto funciona
- [ ] Subir fotos/videos funciona
- [ ] Cotizaciones CRUD funciona
- [ ] Calendario funciona
- [ ] Inventario funciona
- [ ] Chat/WhatsApp funciona
- [ ] Reportes funcionan
- [ ] PDF generation funciona

### Offline
- [ ] App funciona sin internet
- [ ] Sync queue procesa al reconectar
- [ ] Media upload offline → online funciona
- [ ] Offline shells cargan correctamente
- [ ] No hay crash por storage limits

### Dispositivos Reales
- [ ] Samsung Galaxy A (gama baja)
- [ ] Samsung Galaxy S (gama alta)
- [ ] Xiaomi Redmi
- [ ] Motorola
- [ ] Huawei (sin Google Play → APK directo)
- [ ] iPhone (si aplica)

### Performance
- [ ] Cold start < 4 segundos
- [ ] Navigation entre páginas < 1 segundo
- [ ] Animaciones > 50fps
- [ ] Memory usage < 200MB
- [ ] Battery drain aceptable (< 5% por hora activo)

---

## Fase 6: Publicación
**Estimado**: 2-3 días | **Estado**: 🔴

### Play Store
- [ ] Cuenta Google Play Console creada ($25)
- [ ] App listing completo:
  - Nombre: "Aquatech CRM — Gestión de Proyectos"
  - Descripción corta (80 chars)
  - Descripción completa (4000 chars)
  - Screenshots (mínimo 2, recomendado 8)
  - Feature graphic (1024x500)
  - App icon (512x512)
- [ ] Categoría: "Negocios" o "Herramientas"
- [ ] Política de privacidad URL
- [ ] Content rating questionnaire completado
- [ ] AAB firmado y subido
- [ ] Internal testing track → probado por equipo
- [ ] Production track → publicado
- [ ] Verificar indexación en Play Store

### Descarga Directa
- [ ] APK firmado generado
- [ ] Página de descarga en web Aquatech
- [ ] QR code para descarga rápida
- [ ] Instrucciones de instalación (habilitar "fuentes desconocidas")

---

## Post-Lanzamiento

- [ ] Monitorear crash reports (Firebase Crashlytics)
- [ ] Monitorear ANR (Application Not Responding) reports
- [ ] Configurar CI/CD para builds automáticos
- [ ] Planificar Fase iOS (si aplica)
- [ ] Implementar Capacitor Live Update (OTA)
