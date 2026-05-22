# 📱 La Realidad Completa — App Móvil para Empresa Privada

> **Sin adornos. Sin marketing. La verdad de lo que necesitas saber.**

---

## 🆓 ¿Se puede hacer 100% GRATIS?

### Respuesta corta: **SÍ**

| Ruta | Costo | ¿Funciona? | Limitación |
|---|---|---|---|
| **APK directo desde tu VPS** | **$0** | ✅ Sí | No aparece en Play Store |
| Play Store (Android) | $25 (una vez) | ✅ Sí | Pago único de por vida |
| Apple Store (iOS) | $99/año | ✅ Sí | Pago anual obligatorio |

### La ruta 100% gratuita: APK desde tu VPS

```
Tu VPS (donde ya corre el CRM)
  └── /var/www/aquatech/public/app-update/
       ├── latest.apk              (última versión)
       ├── aquatech-crm-v1.0.1.apk (backup de versión)
       └── version.json            (metadata de versión)

Flujo para el usuario:
  1. Abre link: https://crm.aquatech.com/descargar
  2. Descarga el APK (~15-25MB)
  3. Android pregunta "¿Instalar de fuente desconocida?" → Sí
  4. Se instala. Listo.
```

---

## 🔄 ¿Cómo Funcionan las Actualizaciones desde tu VPS?

### HAY DOS NIVELES de actualización:

### Nivel 1: Actualización del código web (90% de los casos)

**Esto ya lo haces HOY.** La app Capacitor carga tu web desde el servidor:

```
El APK contiene SOLO el shell nativo (WebView)
  → El WebView carga https://crm.aquatech.com
  → Cuando tú haces deploy en tu VPS → la app se actualiza SOLA
  → El usuario NO necesita descargar un APK nuevo

Ejemplo:
  Lunes:  Agregas feature "Reportes mejorados" al código
  Martes: Deploy al VPS (git pull + build + restart)
  Martes: El operador abre la app → ya ve los reportes nuevos
  ¡Sin tienda! ¡Sin que el usuario haga nada!
```

### Nivel 2: Actualización del shell nativo (10% de los casos)

```
¿Cuándo necesitas nuevo APK?
  → Cuando agregas un PLUGIN NATIVO nuevo
  → Cuando cambias el ícono o splash
  → Cuando Google pide nuevo API level (1-2 veces/año)

¿Cómo?
  → Compilas APK nuevo en tu máquina
  → Lo subes al VPS
  → Tu app detecta la versión nueva
  → Muestra banner: "Actualización disponible. Descargar."
  → El usuario descarga e instala encima (no pierde datos)
```

### Pipeline en tu VPS

```json
// /public/app-update/version.json
{
  "version": "1.0.3",
  "versionCode": 3,
  "releaseDate": "2026-05-10",
  "downloadUrl": "https://crm.aquatech.com/app-update/latest.apk",
  "changelog": "- Mejoras en cámara\n- Fix sincronización offline",
  "forceUpdate": false
}
```

---

## 💰 Costos Reales Desglosados

### Ruta 1: 100% Gratis

| Concepto | Costo |
|---|---|
| Capacitor (open source) | $0 |
| Android Studio (gratis) | $0 |
| Compilar APK | $0 |
| Hosting APK (tu VPS) | $0 (ya lo pagas) |
| Firebase FCM (push) | $0 (tier gratis) |
| Distribuir a empleados | $0 |
| **TOTAL** | **$0** |

### Ruta 2: Con Play Store

| Concepto | Costo |
|---|---|
| Todo lo anterior | $0 |
| Google Play Console | **$25 una vez para siempre** |
| **TOTAL** | **$25** |

---

## ⚠️ Verdades Incómodas

### 1. "Fuente desconocida" asusta
Android muestra advertencia al instalar APK fuera del Play Store.
**Para empresa interna = normal. Crear mini-guía con screenshots para el equipo.**

### 2. Play Protect puede alertar
Google Play Protect puede mostrar "No reconoce al desarrollador".
**El usuario puede continuar. Los $25 del Play Store eliminan esto.**

### 3. Las actualizaciones de shell NO son automáticas
El usuario debe descargar e instalar manualmente.
**Solución: Banner forzoso en la app + opción de bloquear versiones viejas.**

### 4. Keystore = tu vida. Si lo pierdes, pierdes TODO.
- No puedes publicar actualizaciones nunca más
- Guardarlo en 3 lugares diferentes
- Contraseña documentada fuera del código

### 5. WebView NO es Chrome exacto
95% funciona idéntico. 5% requiere ajustes (CSS, cookies, botón atrás).

### 6. Huawei sin Google Play Services
Push por FCM NO funciona en Huawei post-2019. Web Push sí.

---

## 🏢 Preparación para Empresa Privada

### Lo que necesitas ANTES de empezar

**Hardware/Software:**
- [ ] Android Studio + JDK 17
- [ ] Un teléfono Android real para testing
- [ ] 10GB+ libres en disco para Android SDK

**Archivos CRÍTICOS (proteger con tu vida):**
- [ ] Keystore (.jks) — 3 copias en lugares diferentes
- [ ] Contraseña del keystore documentada en lugar seguro

**Decisiones de negocio:**
- [ ] ¿Solo empleados o también clientes?
- [ ] ¿Quién firma los APKs?
- [ ] ¿Política de versiones? (cada cuánto)

---

## 🎯 Plan de Acción Recomendado

| Paso | Duración | Costo |
|---|---|---|
| 1. Setup Capacitor + primer APK | 3-4 días | $0 |
| 2. Integración + testing | 5-7 días | $0 |
| 3. Push nativas (FCM) | 3-5 días | $0 |
| 4. Publicar APK en VPS + updater | 1-2 días | $0 |
| 5. Testing con operadores reales | 3-5 días | $0 |
| **TOTAL antes de Play Store** | **~3-4 semanas** | **$0** |
| 6. Play Store (cuando esté listo) | +2-3 días | $25 |
