# 🔧 Guía de Instalación — Capacitor.js para Aquatech CRM

> Guía paso a paso para integrar Capacitor en el proyecto existente.

---

## Pre-requisitos

### Software Necesario
| Software | Versión | Propósito |
|---|---|---|
| Node.js | 18+ | Ya lo tienes |
| Android Studio | Ladybug+ (2024) | IDE + SDK Manager |
| Java JDK | 17 | Compilación Android |
| Gradle | 8+ | Build system Android |
| ADB | Latest | Debug en dispositivo real |

### Android SDK (via Android Studio)
```
SDK Platforms:
  - Android 14 (API 34) — Target
  - Android 13 (API 33) — Compat

SDK Tools:
  - Android SDK Build-Tools 34
  - Android SDK Command-line Tools
  - Android Emulator
  - Android SDK Platform-Tools
```

---

## Paso 1: Instalar Capacitor

```bash
# Desde la raíz del proyecto Aquatech CRM
cd "d:\Abel paginas\Aquatech\Crm Aquatech - cloudfare 4"

# Instalar core
npm install @capacitor/core @capacitor/cli

# Inicializar (NO ejecutar aún, se hará en Fase 1)
# npx cap init "Aquatech CRM" "com.aquatech.crm"
```

---

## Paso 2: Configurar capacitor.config.ts

```typescript
// capacitor.config.ts — COLOCAR EN LA RAÍZ DEL PROYECTO
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquatech.crm',
  appName: 'Aquatech CRM',
  
  // ═══ MODO SERVER (Recomendado para CRM con backend) ═══
  // El WebView carga tu app desde el servidor
  // Ventaja: actualizaciones instantáneas sin re-publicar
  server: {
    url: 'https://crm.aquatech.com', // Tu URL de producción
    cleartext: false, // Solo HTTPS
    // En desarrollo:
    // url: 'http://192.168.1.X:3000', // IP local para dev
  },
  
  // ═══ PLUGINS ═══
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#036BB2', // Aquatech blue
      androidSplashResourceName: 'splash',
      showSpinner: true,
      spinnerColor: '#FFFFFF',
    },
    StatusBar: {
      style: 'DARK', // Light text on dark background
      backgroundColor: '#036BB2',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {
      // Use the camera plugin for native camera access
    },
  },

  // ═══ ANDROID ESPECÍFICO ═══
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // true para dev
    // Permisos automáticos
    includePlugins: [
      '@capacitor/camera',
      '@capacitor/push-notifications',
      '@capacitor/filesystem',
      '@capacitor/splash-screen',
      '@capacitor/status-bar',
    ],
  },

  // ═══ iOS ESPECÍFICO (Fase 2) ═══
  ios: {
    contentInset: 'automatic',
    scheme: 'Aquatech',
  },
};

export default config;
```

---

## Paso 3: Instalar Plugins

```bash
# Plugins oficiales de Capacitor
npm install @capacitor/splash-screen
npm install @capacitor/status-bar
npm install @capacitor/push-notifications
npm install @capacitor/camera
npm install @capacitor/filesystem
npm install @capacitor/browser
npm install @capacitor/haptics
npm install @capacitor/keyboard
npm install @capacitor/app          # App lifecycle
npm install @capacitor/network      # Network status

# Plugins de comunidad (opcionales, Fase 4)
npm install @capacitor-community/biometric-auth
```

---

## Paso 4: Agregar Plataforma Android

```bash
# Genera la carpeta android/ con el proyecto nativo
npx cap add android

# Sincronizar web → native
npx cap sync android
```

Esto crea:
```
android/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── AndroidManifest.xml
│   │       ├── java/com/aquatech/crm/
│   │       │   └── MainActivity.java
│   │       └── res/
│   │           ├── drawable/     ← Splash screen
│   │           ├── mipmap-*/     ← App icons
│   │           ├── values/       ← Colors, styles
│   │           └── xml/          ← Network security
│   ├── build.gradle
│   └── google-services.json     ← Firebase (Fase 3)
├── build.gradle
├── gradle.properties
├── settings.gradle
└── variables.gradle
```

---

## Paso 5: Configurar Splash Screen e Íconos

### App Icon
Necesitas generar adaptive icons para Android:
- `mipmap-mdpi` (48x48)
- `mipmap-hdpi` (72x72)
- `mipmap-xhdpi` (96x96)
- `mipmap-xxhdpi` (144x144)
- `mipmap-xxxhdpi` (192x192)

Herramienta: https://icon.kitchen/ o Android Studio Image Asset Studio

### Splash Screen
```xml
<!-- android/app/src/main/res/values/styles.xml -->
<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.NoActionBar">
    <item name="android:background">@drawable/splash</item>
    <item name="android:statusBarColor">#036BB2</item>
    <item name="android:navigationBarColor">#036BB2</item>
</style>
```

---

## Paso 6: Build y Run

### Desarrollo
```bash
# Abrir en Android Studio
npx cap open android

# O ejecutar directamente (si ADB conectado)
npx cap run android
```

### Producción (APK/AAB)
```bash
# En Android Studio:
# Build → Generate Signed Bundle / APK
# Seleccionar AAB para Play Store, APK para descarga directa

# O por línea de comando:
cd android
./gradlew assembleRelease  # APK
./gradlew bundleRelease    # AAB
```

### Ubicación del APK generado:
```
android/app/build/outputs/apk/release/app-release.apk
android/app/build/outputs/bundle/release/app-release.aab
```

---

## Paso 7: Bridge de Detección (PWA vs App)

Agregar a tu app web para detectar si corre en Capacitor:

```typescript
// src/lib/platform.ts
import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): 'web' | 'android' | 'ios' {
  return Capacitor.getPlatform() as 'web' | 'android' | 'ios';
}

// Uso en componentes:
// if (isNativeApp()) {
//   // Usar Capacitor Camera plugin
// } else {
//   // Usar HTML5 Camera API (MediaCapture.tsx actual)
// }
```

---

## Comandos Frecuentes

```bash
# Sincronizar cambios web → native
npx cap sync

# Solo copiar assets (sin instalar plugins)
npx cap copy

# Abrir en Android Studio
npx cap open android

# Ejecutar en dispositivo/emulador
npx cap run android

# Live reload (desarrollo)
# 1. Iniciar dev server: npm run dev
# 2. Configurar server.url en capacitor.config.ts con tu IP local
# 3. npx cap run android
```

---

## Notas Importantes

1. **NO necesitas `next export`**: Como usamos modo `server.url`, el WebView carga tu app desde el servidor. No necesitas generar una build estática.

2. **Service Worker**: Funciona en WebView de Android (Chromium-based). En iOS WKWebView tiene limitaciones con SW — pero para Fase 1 (Android) no hay problema.

3. **Hot Reload en Dev**: Configura `server.url` apuntando a tu IP local (`http://192.168.x.x:3000`) y el WebView carga con hot reload.

4. **Debugging**: Habilita `webContentsDebuggingEnabled: true` en capacitor.config.ts y usa Chrome DevTools → `chrome://inspect` para debug remoto.
