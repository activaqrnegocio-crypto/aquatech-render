# Plan: Reducción de tamaño del APK (400MB → ~50MB)

---

## 1. Feedback del problema

**Síntoma:** Al generar el APK con `./gradlew assembleDebug`, el archivo resultante pesa **~400MB**.

**Causa raíz encontrada:**

| Componente | Tamaño | Problema |
|------------|--------|----------|
| `.next/cache` | **544 MB** | Webpack build cache - NO debería estar en el APK |
| `.next/standalone` | 113 MB | Servidor Node.js standalone |
| `.next/server` | 13 MB | Server-side code (no usado en APK) |
| `.next/static` | 4 MB | Único necesario (JS/CSS del frontend) |
| **Total .next** | **675 MB** | |

**El problema principal:** `capacitor.config.ts` tiene `webDir: '.next'`, lo que hace que Capacitor empaquete la carpeta `.next` **COMPLETA** dentro del APK, incluyendo 544MB de caché de webpack que solo sirve para builds.

**Problemas secundarios:**
- `minifyEnabled false` → El código nativo (Java/Kotlin) no se minifica/obfusca
- `shrinkResources false` → Recursos no usados se incluyen
- Sin ABI splits → Librerías nativas para todas las arquitecturas ARM/x86

---

## 2. Objetivo

Reducir el APK de **400MB a ~40-50MB** (formato AAB para Play Store) **SIN DAÑAR** ninguna funcionalidad nativa.

### Funcionalidades nativas que NO deben romperse

| Funcionalidad | Plugin | Prioridad |
|---------------|--------|-----------|
| 📷 Cámara (foto/video) | `@capacitor/camera` | 🔴 Crítica |
| 🗄️ SQLite offline | `@capacitor-community/sqlite` | 🔴 Crítica |
| 📁 FileSystem | `@capacitor/filesystem` | 🔴 Crítica |
| 📍 Geolocalización | `@capacitor/geolocation` | 🔴 Crítica |
| 🔔 Push Notifications + FCM | `@capacitor/push-notifications` + Firebase | 🔴 Crítica |
| 🔔 Notificaciones locales | `@capacitor/local-notifications` | 🔴 Crítica |
| 🎤 Grabación audio | `@capgo/capacitor-audio-recorder` | 🔴 Crítica |
| 🔗 Deep linking notificaciones | `PendingNavPlugin` (custom) | 🔴 Crítica |
| ⚙️ Preferencias nativas | `NativePreferences` (custom) | 🔴 Crítica |
| 🏃 Background Runner | `@capacitor/background-runner` | 🟡 Media |
| 📲 Sincronización en 2º plano | Custom SW + outbox | 🟡 Media |

---

## 3. Plan de implementación (5 pasos)

### Paso 1: Crear carpeta `dist/` limpia para el APK

**Qué:** Crear una carpeta separada con SOLO los assets necesarios (`.next/static` + HTML mínimo), eliminando el cache de webpack.

**Archivos a crear:**
- `dist/index.html` - Página de carga mínima
- `dist/manifest.json` - Copia del manifest de la PWA
- Copia de `.next/static` - Los JS/CSS chunks

**Por qué:** El APK no necesita el cache de webpack (544MB). Solo necesita los JS/CSS del frontend.

**Riesgo:** 🟢 Ninguno - Solo se separan archivos, no se modifica lógica.

---

### Paso 2: Cambiar `webDir` en `capacitor.config.ts`

**Qué:** Apuntar `webDir` a la nueva carpeta `dist/` en lugar de `.next`.

```typescript
// ANTES
webDir: '.next',

// DESPUÉS
webDir: 'dist',
```

**Riesgo:** 🟢 Ninguno - Solo cambia qué carpeta se empaqueta.

---

### Paso 3: Agregar reglas ProGuard para proteger plugins nativos

**Qué:** Escribir en `android/app/proguard-rules.pro` las reglas `-keep` para TODOS los plugins nativos.

**Reglas necesarias:**

```proguard
# Capacitor Core - Protección completa de plugins
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }

# SQLite (capacitor-community)
-keep class com.getcapacitor.community.** { *; }

# Audio Recorder (capgo)
-keep class ee.forgr.capacitor_audio_recorder.** { *; }

# Firebase Cloud Messaging
-keep class com.google.firebase.** { *; }
-keep class com.aquatech.crm.AquatechFirebaseMessagingService { *; }

# Plugins personalizados
-keep class com.aquatech.crm.PendingNavPlugin { *; }
-keep class com.aquatech.crm.NativePreferences { *; }

# MainActivity
-keep class com.aquatech.crm.MainActivity { *; }

# WebView JavaScript interface
-keepclassmembers class * extends android.webkit.WebView {
   public *;
}

# Gson (usado por algunos plugins)
-keep class com.google.gson.** { *; }
```

**Riesgo:** 🟡 Medio - Si falta alguna regla, el plugin correspondiente dejará de funcionar.

**Mitigación:** Probar CADA plugin después de aplicar ProGuard.

---

### Paso 4: Habilitar minificación y compresión en `build.gradle`

**Qué:** Cambiar `minifyEnabled false` a `true` y agregar `shrinkResources true`.

```gradle
release {
    minifyEnabled true      // Minifica código Java/Kotlin
    shrinkResources true    // Elimina recursos no usados
    proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
}
```

**Riesgo:** 🟡 Medio - Depende de que las reglas ProGuard estén completas.

---

### Paso 5: Configurar AAB (Android App Bundle) para Play Store

**Qué:** En `android/build.gradle`, agregar configuración de bundle:

```gradle
android {
    // ...existing config...
    bundle {
        language {
            enableSplit = false
        }
        density {
            enableSplit = true
        }
        abi {
            enableSplit = true
        }
    }
}
```

Luego generar con:
```powershell
cd android
.\gradlew bundleRelease
```

**Riesgo:** 🟢 Ninguno - Google Play Store recomienda AAB.

---

## 4. Cosas a cuidar (checklist de verificación)

### Antes de aplicar cambios
- [ ] Hacer backup de `capacitor.config.ts`
- [ ] Hacer backup de `android/app/build.gradle`
- [ ] Hacer backup de `proguard-rules.pro`

### Después de aplicar cambios - Probar CADA funcionalidad

| Funcionalidad | Cómo probar | ✅ |
|---------------|-------------|---|
| 📷 Cámara foto | Abrir cámara, tomar foto, enviar al chat | ☐ |
| 🎥 Cámara video | Abrir cámara, grabar video, enviar al chat | ☐ |
| 🗄️ Offline SQLite | Poner offline, crear proyecto, volver online, sincronizar | ☐ |
| 📍 Ubicación | Enviar ubicación desde el chat | ☐ |
| 🔔 Push notifications | Enviar notificación desde admin, recibir en APK | ☐ |
| 🎤 Audio | Grabar nota de voz, reproducir | ☐ |
| 📁 Subir foto/video al chat | Seleccionar desde galería, enviar | ☐ |
| 📲 Sincronización offline | Enviar mensaje offline, verificar que llega al volver online | ☐ |
| 🔗 Deep linking | Tap en notificación, debe abrir proyecto correcto | ☐ |

### Si algo falla
- Revisar que la regla ProGuard para ese plugin específico existe
- Probar con `minifyEnabled false` temporalmente para aislar el problema
- Si el error persiste, revisar si el plugin usa reflection adicional

---

## 5. Resultados esperados

| Formato | Tamaño actual | Tamaño esperado | Reducción |
|---------|--------------|-----------------|-----------|
| APK Debug | **400 MB** | ~120 MB | **-70%** |
| APK Release (minifyEnabled) | - | ~60-80 MB | **-80%** |
| AAB (Play Store) | - | **~40-50 MB** ✅ | **-90%** |

### Notas importantes
- La reducción principal viene de **eliminar el cache de webpack** (544MB)
- ProGuard reduce código nativo en ~30-50% adicional
- AAB divide el APK por arquitectura, reduciendo aún más
- **Ninguna funcionalidad nativa se pierde** si las reglas ProGuard son correctas
- El tiempo de build puede aumentar ligeramente con ProGuard habilitado

---

## 6. Comandos para generar

```powershell
# 1. Build web app
npm run build

# 2. Preparar dist/ (assets mínimos)
node prepare-dist.js

# 3. Sync Capacitor
npx cap sync android

# 4. Generar APK Debug (para pruebas)
cd android
.\gradlew assembleDebug

# 5. Generar AAB Release (para Play Store)
cd android
.\gradlew bundleRelease
```
