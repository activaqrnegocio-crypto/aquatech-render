# PLAN DE PUBLICACIÓN EN GOOGLE PLAY STORE

**Proyecto:** Aquatech CRM  
**Fecha:** 25 Junio 2026  
**Objetivo:** Publicar la APK híbrida (Capacitor) en Google Play Store

---

## 📌 ARQUITECTURA PRODUCCIÓN

```
APK (Google Play)
    │
    ├── server.url → https://178.238.238.158.sslip.io (carga la UI)
    │
    └── fetch('/api/...') → resuelve contra el VPS (rutas relativas)

Los cambios de código normales se suben al VPS
→ la app se actualiza automáticamente (sin Play Store)

Solo cambios NATIVOS (plugins Android, permisos, etc.)
→ requieren nueva versión en Play Store
```

---

## 🗺️ PASO A PASO

### PASO 1: VPS funcionando con HTTPS ✅

- [x] VPS corriendo con Docker (contenedor `aquatech-crm-v2`)
- [x] Dominio/HTTPS funcionando (`https://178.238.238.158.sslip.io`)
- [x] Repo GitHub conectado: `github.com/activaqrnegocio-crypto/aquatech-render`

---

### PASO 2: Configurar `capacitor.config.ts` para producción ✅

- [x] `server.url` → `https://178.238.238.158.sslip.io`
- [x] `server.cleartext` → `false`
- [x] `android.webContentsDebuggingEnabled` → `false`
- [x] `network_security_config.xml` → agregado VPS, removido IP local

| Cambio | Desarrollo | Producción |
|--------|-----------|------------|
| `server.url` | `https://192.168.100.43:3443` | `https://178.238.238.158.sslip.io` |
| `server.cleartext` | `true` | `false` |
| `android.webContentsDebuggingEnabled` | `true` | `false` |

```ts
server: {
    url: 'https://178.238.238.158.sslip.io',
    cleartext: false,
    appStartPath: '/admin',
},
android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#036BB2',
},
```

**¿Google Play acepta `server.url`?** ✅ **SÍ.** Es el diseño normal de apps híbridas (Capacitor, Cordova). No hay ninguna regla que lo prohíba.

---

### PASO 3: Actualizar `android/app/src/main/res/xml/network_security_config.xml`

Este archivo solo permite conexión a `192.168.100.43` con certificado local. Hay que:

```xml
<network-security-config>
    <!-- Producción: confiar en nuestro VPS -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">178.238.238.158.sslip.io</domain>
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
</network-security-config>
```

- ✅ Cambiar `192.168.100.43` → `178.238.238.158.sslip.io`
- ✅ Quitar el certificado local (`@raw/mkcert_ca`)
- ✅ Dejar solo certificados del sistema (SSL normal)

---

### PASO 3: Generar Keystore de Producción ✅

- [x] Keystore generado: `D:\Abel paginas\Aquatech\Llaves play store\aquatech-release.keystore`
- [x] Alias: `aquatech`
- [x] Contraseña: `Aquatech2026`
- [x] Validez: 10,000 días

---

### PASO 4: Configurar firma Release en `android/app/build.gradle` ✅

- [x] Configurado `signingConfigs.release` apuntando al keystore
- [x] `buildTypes.release` usa la firma de release

Agregar configuración de release signing:

```gradle
signingConfigs {
    release {
        storeFile file("D:/ruta-segura/aquatech-release.keystore")
        storePassword 'tu-contraseña'
        keyAlias 'aquatech'
        keyPassword 'tu-contraseña'
        enableV1Signing = true
        enableV2Signing = true
        enableV3Signing = false
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

---

### PASO 6: Versionado

| Archivo | Campo | Actual | Primera Publicación |
|---------|-------|--------|-------------------|
| `android/app/build.gradle` | `versionCode` | 1 | **1** (empieza en 1) |
| `android/app/build.gradle` | `versionName` | "1.0" | **"1.0.0"** |

Para actualizaciones futuras:
- `versionCode`: incrementar en 1 cada release
- `versionName`: seguir semver (`1.0.1`, `1.1.0`, etc.)

---

### PASO 7: Generar el Android App Bundle (.aab)

```powershell
cd android
.\gradlew bundleRelease
```

El archivo se genera en:
```
android/app/build/outputs/bundle/release/app-release.aab
```

**Google Play exige .aab** (ya no acepta APK directo para nuevas apps).

---

### PASO 8: Subir a Google Play Console

1. Ir a [play.google.com/console](https://play.google.com/console)
2. Crear cuenta de desarrollador (pago único ~$25 USD)
3. Crear nueva app
4. Subir `app-release.aab`
5. Completar Store Listing:

| Requisito | Descripción | Estado |
|-----------|-------------|--------|
| **Política de privacidad** | URL en tu VPS (`/privacy.html` o similar) | ⏳ Pendiente |
| **Capturas de pantalla** | Mínimo 2 (teléfono + tableta) | ⏳ Pendiente |
| **Feature Graphic** | 1024x500 px | ⏳ Pendiente |
| **Ícono 512x512** | Logo Aquatech | ✅ Listo |
| **Descripción corta** | Max 80 caracteres | ⏳ Pendiente |
| **Descripción completa** | Max 4000 caracteres | ⏳ Pendiente |
| **Categoría** | Productividad / Negocios | ⏳ Pendiente |
| **Calificación de contenido** | Cuestionario en Play Console | ⏳ Pendiente |
| **Precio** | Gratuita o paga | ⏳ Decidir |

---

### PASO 9: Probar antes de publicar

- [ ] Probar en dispositivo físico (Xiaomi)
- [ ] Verificar que login funciona
- [ ] Verificar que galería funciona online/offline
- [ ] Verificar que las notificaciones push llegan
- [ ] Verificar que la sincronización offline funciona
- [ ] Probar cámara, audio, video
- [ ] Desconectar internet y probar funcionalidad offline

---

## 🔄 CICLO DE VIDA POST-PUBLICACIÓN

```
Cambio de código normal (UI, lógica, etc.)
    │
    ├── 1. Subir cambios a GitHub
    ├── 2. VPS se actualiza (git pull, docker-compose up --build)
    └── 3. Usuarios ven los cambios automáticamente
        (No necesitan actualizar desde Play Store)

Cambio NATIVO (plugins, permisos, Capacitor, Android)
    │
    ├── 1. Hacer cambios nativos
    ├── 2. Incrementar versionCode en build.gradle
    ├── 3. .\gradlew bundleRelease
    └── 4. Subir nuevo .aab a Google Play Console
```

---

## 📋 CHECKLIST FINAL

- [ ] VPS funcionando con HTTPS
- [ ] `capacitor.config.ts` apunta al VPS
- [ ] `network_security_config.xml` actualizado (sin IP local)
- [ ] Keystore de producción generado y respaldado
- [ ] `build.gradle` con firma release configurada
- [ ] `versionCode` y `versionName` correctos
- [ ] `.aab` generado sin errores
- [ ] Política de privacidad publicada en VPS
- [ ] Capturas de pantalla listas
- [ ] Cuenta de Google Play Developer creada
- [ ] App subida y publicada ✅

---

> **Nota importante:** Como la UI se carga desde el VPS, los usuarios necesitan internet para USAR la app (aunque tenga funcionalidad offline para datos sincronizados). La primera carga siempre requiere conexión.
