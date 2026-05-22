# 📱 Plan Maestro — Aquatech CRM: Migración a Aplicación Móvil

> **Proyecto**: Aquatech CRM  
> **Estado actual**: Next.js 16 + PWA funcional (Service Worker v340)  
> **Objetivo**: Distribuir como aplicación descargable en celulares  
> **Fecha**: Mayo 2026

---

## 📋 Índice

1. [Inventario del Proyecto Actual](#1-inventario-del-proyecto-actual)
2. [PWA vs App Nativa — Comparativa Completa](#2-pwa-vs-app-nativa--comparativa-completa)
3. [Recomendación Técnica](#3-recomendación-técnica)
4. [Compatibilidad de Dispositivos](#4-compatibilidad-de-dispositivos)
5. [Arquitectura Propuesta](#5-arquitectura-propuesta)
6. [Roadmap de Migración](#6-roadmap-de-migración)
7. [Riesgos y Mitigaciones](#7-riesgos-y-mitigaciones)
8. [Estructura de Archivos](#8-estructura-de-archivos)

---

## 1. Inventario del Proyecto Actual

### Stack Tecnológico
| Componente | Tecnología |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| UI | React 19.2.4 + TailwindCSS 4.2 |
| Animaciones | Framer Motion 12.38 |
| Base de datos | MySQL (via Prisma 6.19) |
| Autenticación | NextAuth 4.24 |
| Offline | Custom Service Worker v340 + IndexedDB (Dexie 4.3) |
| Push Notifications | Web Push (web-push 3.6.7 + VAPID) |
| Almacenamiento | Bunny CDN |
| Mapas | Leaflet + React Leaflet |
| PDF | jsPDF + jsPDF-AutoTable |
| Deploy | Cloudflare (standalone output) |

### Módulos del CRM (22 API routes)
| Módulo | Ruta | Offline? |
|---|---|---|
| Dashboard Admin | `/admin` | ✅ |
| Dashboard Operador | `/admin/operador` | ✅ |
| Proyectos (CRUD + ejecución) | `/admin/proyectos` | ✅ Con sync |
| Cotizaciones | `/admin/cotizaciones` | ✅ |
| Calendario | `/admin/calendario` | ✅ |
| Inventario | `/admin/inventario` | ✅ |
| Blog/Marketing | `/admin/blog` | ❌ |
| WhatsApp Integration | `/admin/whatsapp` | ❌ |
| Reportes | `/admin/reportes` | ❌ |
| Subcontratistas | `/admin/subcontratista` | Parcial |
| Equipo/Team | `/admin/team` | ❌ |
| Recursos Humanos | `/admin/recursos` | ❌ |
| Login/Auth | `/admin/login` | ❌ |

### Capacidades Offline Críticas
- **Service Worker v340**: Cache-first navigation, RSC caching, outbox sync
- **IndexedDB (Dexie)**: Almacena proyectos, cotizaciones, registros diarios
- **Background Sync**: Poller agresivo cada 15s, auto-waking
- **Media Upload**: Chunked uploads hasta 200MB+, offline queue
- **Offline Shells**: Pre-cached shells para proyecto admin/operador

### Componentes Pesados (>10KB)
| Componente | Tamaño | Función |
|---|---|---|
| ProjectExecutionClient.tsx | 154KB | Ejecución completa de proyectos |
| GlobalSyncWorker.tsx | 51KB | Motor de sincronización offline |
| ProjectCreationWizard.tsx | 53KB | Wizard de creación |
| Sidebar.tsx | 33KB | Navegación lateral |
| DashboardClient.tsx | 36KB | Dashboard principal |
| ProjectUploader.tsx | 28KB | Subida de archivos |
| BudgetBuilder.tsx | 25KB | Constructor de presupuestos |
| MediaCapture.tsx | 18KB | Captura de fotos/video |

---

## 2. PWA vs App Nativa — Comparativa Completa

### ✅ Lo que la PWA YA hace bien
| Capacidad | Estado PWA |
|---|---|
| Instalar en pantalla de inicio | ✅ Funciona |
| Modo offline completo | ✅ Service Worker v340 |
| Push notifications | ✅ Web Push API |
| Cámara/fotos | ✅ MediaCapture component |
| Geolocalización | ✅ Disponible |
| Pantalla completa | ✅ `display: standalone` |

### 🔥 Beneficios de una App Nativa sobre PWA

| Beneficio | PWA | App Nativa |
|---|---|---|
| **Presencia en Play Store** | ❌ No aparece | ✅ Descargable desde tienda |
| **Confianza del usuario** | ⚠️ "Es solo un link" | ✅ "Es una app real" |
| **Notificaciones en iOS** | ⚠️ Limitado (requiere iOS 16.4+, Safari) | ✅ Nativas, confiables |
| **Acceso a archivos del sistema** | ⚠️ Limitado por sandbox | ✅ Acceso completo |
| **Background tasks** | ⚠️ Service Worker puede morir | ✅ Persistentes |
| **Acceso a contactos** | ❌ No disponible | ✅ API nativa |
| **Bluetooth / NFC** | ⚠️ Parcial en Chrome | ✅ Completo |
| **Deep Links** | ⚠️ Requiere workarounds | ✅ Nativos |
| **Auto-update** | ✅ Automático (SW) | ✅ Via store o in-app |
| **Rendimiento animaciones** | ⚠️ JS-based (Framer Motion) | ✅ GPU acelerado |
| **Tamaño offline storage** | ⚠️ ~250MB (varía por browser) | ✅ Sin límite práctico |
| **Ícono con badge** | ⚠️ Solo Android Chrome | ✅ Nativo ambas plataformas |
| **Biometric auth** | ⚠️ WebAuthn (parcial) | ✅ Completo |

### 🚧 Limitaciones de una App

| Limitación | Detalle |
|---|---|
| **Proceso de publicación** | Play Store requiere cuenta ($25 una vez), revisión 1-3 días |
| **Apple Store** | Requiere cuenta Developer ($99/año), revisión más estricta |
| **Actualizaciones** | Los usuarios deben actualizar (con Capacitor se puede hacer OTA) |
| **Tamaño del APK** | El APK pesa más que un bookmark (~15-30MB) |
| **Mantenimiento dual** | Si mantienes PWA + App, son 2 deployments |

---

## 3. Recomendación Técnica

### 🏆 Recomendación: **Capacitor.js** (Ionic Capacitor)

**¿Por qué Capacitor y NO React Native o Flutter?**

Tu proyecto es un **CRM Next.js completo** con 154KB de lógica de ejecución de proyectos, 51KB de sync engine, 22 API routes, y un Service Worker de 2,456 líneas. **Reescribir esto en React Native o Flutter tomaría 4-6 MESES**. Con Capacitor, tu código web existente corre tal cual dentro de un WebView nativo, y solo agregas plugins nativos donde los necesitas.

### ¿Qué es Capacitor?

Capacitor es un runtime creado por el equipo de Ionic que empaqueta tu app web dentro de un contenedor nativo (Android/iOS). Piensa en ello como un "Chrome optimizado" que vive como APK/IPA con acceso a APIs nativas.

### Comparativa de opciones

| Criterio | Capacitor | React Native | Flutter | TWA |
|---|---|---|---|---|
| **Reutilización de código** | 99% | 0% (reescribir) | 0% (reescribir) | 100% |
| **Tiempo de migración** | 2-4 semanas | 4-6 meses | 5-7 meses | 1 semana |
| **APIs nativas** | ✅ Via plugins | ✅ Nativo | ✅ Nativo | ❌ Solo web |
| **Rendimiento** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Push Notifications** | ✅ FCM | ✅ FCM | ✅ FCM | ⚠️ Web Push |
| **Offline** | ✅ Tu SW | ✅ SQLite | ✅ SQLite | ✅ Tu SW |
| **Play Store** | ✅ | ✅ | ✅ | ✅ |
| **Apple Store** | ✅ | ✅ | ✅ | ❌ (rechazado) |
| **Mantenimiento** | Bajo | Alto | Alto | Muy bajo |

**Capacitor es la elección correcta porque:**
1. Tu CRM ya funciona — no queremos reescribir 500KB+ de componentes React
2. Tu Service Worker y sistema offline se mantienen intactos
3. Puedes agregar features nativos incrementalmente
4. Un solo codebase para web + Android + iOS

---

## 4. Compatibilidad de Dispositivos

### Android (APK / AAB)
| Aspecto | Detalle |
|---|---|
| **Versión mínima** | Android 5.1+ (API 22) — cubre 99.2% de dispositivos |
| **Recomendada** | Android 8.0+ (API 26) para todas las features |
| **WebView** | Android System WebView (Chromium, auto-update) |
| **Formato** | AAB para Play Store, APK para sideload |
| **Marcas** | Samsung, Xiaomi, Huawei, Motorola, OPPO, Vivo, OnePlus, Pixel, LG, etc. |

### iOS (IPA)
| Aspecto | Detalle |
|---|---|
| **Versión mínima** | iOS 14+ (~97% de iPhones activos) |
| **Recomendada** | iOS 16+ para push notifications web |
| **WebView** | WKWebView (Safari engine) |
| **Distribución** | App Store o TestFlight (beta) |
| **Dispositivos** | iPhone 6s+, iPad Air 2+ |

> **Nota**: En Ecuador y LATAM, ~85% del mercado es Android. Priorizar Android primero.

---

## 5. Arquitectura Propuesta

### Flujo de la App

```
┌─────────────────────────────────────────────────┐
│               DISTRIBUCIÓN                       │
│                                                   │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │Play Store│  │APK Directo│  │Apple Store   │  │
│  │  (AAB)   │  │(Download) │  │(Fase 2/IPA) │  │
│  └────┬─────┘  └─────┬─────┘  └──────┬───────┘  │
│       └───────────────┼───────────────┘           │
└───────────────────────┼───────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────┐
│            CAPACITOR SHELL                         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │          WebView Nativo                      │   │
│  │     (Chromium Android / WKWebView iOS)       │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
│  ┌──────────┬───────┼───────┬──────────┐           │
│  │ FCM Push │ Cámara│Biometrics│ FileSystem│        │
│  │  Plugin  │ Nativa│ Plugin   │  Plugin   │        │
│  └──────────┴───────┴──────────┴──────────┘        │
└─────────────────────┬─────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────┐
│         TU APP EXISTENTE (sin cambios)             │
│                                                     │
│  ┌────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Next.js 16 │  │ SW v340  │  │ IndexedDB     │  │
│  │ App Router │  │ Offline  │  │ Dexie 4.3     │  │
│  └────────────┘  └──────────┘  └───────────────┘  │
│                                                     │
│  ┌────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ 22 APIs    │  │ NextAuth │  │ Bunny CDN     │  │
│  │ Routes     │  │ Auth     │  │ Storage       │  │
│  └────────────┘  └──────────┘  └───────────────┘  │
└───────────────────────────────────────────────────┘
```

### Flujo de Datos
```
Usuario abre APK
  → Capacitor carga WebView
    → WebView carga tu app Next.js (desde servidor o cache local)
      → Service Worker intercepta requests
        → IndexedDB maneja offline
          → API Routes procesan datos
            → MySQL/Prisma persiste
```

---

## 6. Roadmap de Migración

### ⏱️ Tiempo estimado total: **4-6 semanas**

---

### Fase 1: Configuración Base (3-4 días)
- [ ] Instalar Capacitor en el proyecto existente
- [ ] Configurar `capacitor.config.ts`
- [ ] Setup Android Studio + SDK
- [ ] Crear proyecto Android nativo
- [ ] Primer build de prueba (APK vacío con WebView)

### Fase 2: Integración Web → Nativa (5-7 días)
- [ ] Configurar la URL del servidor como punto de carga
- [ ] Adaptar Service Worker para contexto Capacitor
- [ ] Resolver conflictos de cookies/auth en WebView
- [ ] Ajustar `manifest.json` para coexistencia PWA + App
- [ ] Configurar deep links (`aquatech://`)
- [ ] Splash screen + ícono de app
- [ ] Status bar theming (color Aquatech `#036BB2`)

### Fase 3: Push Notifications Nativas (3-5 días)
- [ ] Configurar Firebase Cloud Messaging (FCM)
- [ ] Migrar de Web Push (VAPID) a FCM para la app
- [ ] Implementar bridge: detectar si es PWA o App nativa
- [ ] Mantener Web Push para la versión web
- [ ] Dual-registration: un usuario puede tener tokens web + FCM

### Fase 4: Features Nativos (3-5 días)
- [ ] Plugin de cámara nativa (mejor calidad que MediaCapture web)
- [ ] Biometric authentication (huella/face para login)
- [ ] Acceso al filesystem para exports (PDF, Excel)
- [ ] Manejo de archivos grandes (>300MB sin límite de browser)
- [ ] Badge en ícono para notificaciones pendientes

### Fase 5: Testing y QA (3-5 días)
- [ ] Testing offline completo en APK
- [ ] Testing de sync (outbox poller en contexto nativo)
- [ ] Testing de media upload (chunked, hasta 500MB)
- [ ] Testing en dispositivos reales:
  - Samsung Galaxy (gama baja/media/alta)
  - Xiaomi/Redmi
  - Huawei (sin Google Play → APK directo)
  - iPhone (si aplica Fase iOS)
- [ ] Performance profiling (WebView vs Chrome)
- [ ] Battery impact testing

### Fase 6: Publicación (2-3 días)
- [ ] Crear cuenta Google Play Console ($25 único)
- [ ] Preparar assets (screenshots, descripción, política de privacidad)
- [ ] Firmar APK/AAB con keystore
- [ ] Subir a Play Store (internal testing → production)
- [ ] Configurar link de descarga directa (APK) en web Aquatech
- [ ] Documentar proceso de actualización

---

## 7. Riesgos y Mitigaciones

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | WebView performance inferior a Chrome | Media | Medio | Capacitor usa Chromium actualizado; optimizar con lazy loading |
| 2 | Cookies/Auth no persisten en WebView | Alta | Alto | Capacitor Cookie plugin + shared preferences para tokens |
| 3 | Service Worker se comporta diferente | Media | Alto | Testing exhaustivo; fallback a Capacitor Storage |
| 4 | Archivos grandes causan crash | Baja | Alto | Ya hay chunked upload; agregar Capacitor Filesystem |
| 5 | Play Store rechaza por "solo wrapper" | Baja | Alto | Agregar 2-3 features nativos (biometrics, FCM, cámara) |
| 6 | iOS WebView tiene limitaciones | Media | Medio | Postponer iOS a Fase 2; priorizar Android |
| 7 | Huawei sin Google Play | Media | Bajo | APK directo + Huawei AppGallery |
| 8 | Actualizaciones requieren re-publicar | Baja | Bajo | Capacitor Live Update (OTA sin Store) |

**RIESGO CLAVE**: Google Play puede rechazar apps que son "solo un WebView sin valor nativo". La solución es integrar biometrics + push nativo + cámara nativa para demostrar funcionalidad nativa real.

---

## 8. Estructura de Archivos

```
AplicacionAqua/
├── PLAN_MAESTRO.md            ← Este documento
├── COMPARATIVA_DETALLADA.md   ← PWA vs App análisis profundo
├── GUIA_CAPACITOR.md          ← Paso a paso de instalación
├── CHECKLIST.md               ← Checklist de progreso
└── config/                    ← Configuraciones listas para copiar
    ├── capacitor.config.ts
    ├── firebase/
    │   └── google-services.json (placeholder)
    └── android/
        └── variables.gradle
```

---

## 🎯 Resumen Ejecutivo

| Pregunta | Respuesta |
|---|---|
| **¿App o PWA?** | **AMBAS** — mantén la PWA + agrega App nativa con Capacitor |
| **¿Qué tipo de app?** | **APK/AAB** via Capacitor.js (Android primero, iOS después) |
| **¿Beneficios sobre PWA?** | Play Store, push confiable, cámara nativa, biometrics, sin límites de storage |
| **¿Limitaciones?** | Necesitas Android Studio, cuenta Play ($25), y testing en dispositivos reales |
| **¿En qué celulares?** | Android 5.1+ (99.2% del mercado), iOS 14+ (97% de iPhones) |
| **¿Tiempo de migración?** | **4-6 semanas** (manteniendo todo el código actual) |
| **¿Cuánto código hay que reescribir?** | **Casi nada** — Capacitor envuelve tu web existente |
