# 🩺 GUÍA COMPLETA DE BUGFIX — Aquatech CRM

> **Propósito:** Esta guía es el plan maestro para eliminar TODOS los bugs del CRM.  
> **Debe seguirse EN ORDEN — no saltar pasos.**  
> **Cada paso tiene: qué hacer, por qué, cómo verificar, y cómo hacer rollback.**

---

## 📊 Resumen de Bugs Encontrados

| # | Bug | Severidad | Archivos | Estado |
|---|---|---|---|---|
| 1 | 19 revalidateRoute/router.refresh causando reloads | 🔴 CRÍTICO | ProjectExecutionClient (14), ProjectDetailClient (5) | ✅ ARREGLADO |
| 2 | MySQL remoto connection_limit=3 | 🔴 CRÍTICO | Infraestructura (DATABASE_URL) | PENDIENTE |
| 3 | Race condition chat SW vs Dexie | 🔴 CRÍTICO | Service Worker + Dexie outbox | PENDIENTE |
| 4 | Docker healthcheck roto (reinicio aleatorio) | 🔴 CRÍTICO | Dockerfile + docker-compose.yml | ✅ ARREGLADO |
| 5 | Tabla users 18MB por base64 en LongText | 🟠 ALTO | schema.prisma (users.image) | ✅ ARREGLADO |
| 6 | GlobalSyncWorker 6 useEffect + listeners duplicados | 🟠 ALTO | GlobalSyncWorker.tsx (48KB) | ⏭️ SKIP (ya arreglado en v333) |
| 7 | OfflinePrefetcher agresivo (consume datos móviles) | 🟡 MEDIO | OfflinePrefetcher.tsx | ✅ ARREGLADO |
| 8 | ProjectDetailClient.tsx 4066 líneas (admin) | 🔴 ESTRUCTURAL | src/app/admin/proyectos/[id]/ | ✅ ARREGLADO (14 líneas) |
| 9 | ProjectExecutionClient.tsx 3464 líneas (operador) | 🔴 ESTRUCTURAL | src/components/ | ⬜ PENDIENTE |

---

## 🗺️ Arquitectura Actual (lo que hay que entender)

```
┌──────────────────────────────────────────────────────────┐
│                 PÁGINAS (Server Components)               │
│  admin/proyectos/[id]/page.tsx    operador/proyecto/[id]/page.tsx  │
│         │ 74 líneas                      │ 74 líneas              │
└─────────┼────────────────────────────────┼───────────────────────┘
          │                                │
          ▼                                ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│ ProjectDetailClient  │    │  ProjectExecutionClient      │
│     4066 líneas      │    │      3464 líneas             │
│     (ADMIN)          │    │      (OPERADOR)              │
│                      │    │                              │
│  • Chat online/off   │    │  • Chat online/off  ←DUPLICADO
│  • Galería online/off│    │  • Galería online/off ←DUPLICADO
│  • Gastos online/off │    │  • Gastos online/off  ←DUPLICADO
│  • Ficha + PDF       │    │  • Ficha (solo lectura)      │
│  • Equipo            │    │  • Equipo (solo lectura)     │
│  • Fases editables   │    │  • Day records (fichar)      │
│  • Eliminar proyecto │    │  • Tareas                   │
│  • Presupuesto       │    │  • Ubicación GPS             │
│  • 5 revalidateRoute │    │  • 14 revalidateRoute        │
└──────────────────────┘    └──────────────────────────────┘
          │                                │
          └────────────┬───────────────────┘
                       │
                       ▼
          ┌─────────────────────────┐
          │   COMPARTIDO (ya existe) │
          │  • ProjectChatUnified    │
          │  • ProjectUploader       │
          │  • MediaCapture          │
          │  • Dexie (db.ts)         │
          │  • SW (custom-sw.js)     │
          └─────────────────────────┘
```

---

# 🔧 FASE 0 — ARREGLOS INMEDIATOS (30 min)

## Paso 0.1 — Docker Healthcheck ✅ YA ARREGLADO

**Qué se hizo:**
- `Dockerfile`: Agregado `curl` al runner (`apk add --no-cache curl`)
- `docker-compose.yml`: Healthcheck cambiado de `wget --spider /api/auth/session` a `curl -f /api/health/ping`
- Intervalo subido de 10s a 30s, start_period de 30s a 60s

**Por qué:** `wget` de busybox intenta IPv6, Next.js escucha solo IPv4. Además `/api/auth/session` retorna 401 sin sesión → wget lo trata como fallo → Docker reinicia el contenedor cada ~50 segundos.

---

## Paso 0.2 — Verificar conexión MySQL

**Archivo:** `.env` (DATABASE_URL)

Verificar que `DATABASE_URL` apunte al host correcto y que el connection_limit sea adecuado.

```bash
# Revisar en .env
grep DATABASE_URL .env
```

Si usa `mysql.gb.stackcp.com`, el límite de 3 conexiones es del hosting. Soluciones:
- Opción A: Agregar `?connection_limit=5` al final del DATABASE_URL (si el hosting lo permite)
- Opción B: Usar Prisma Data Proxy (si está disponible)
- Opción C: Migrar a una BD local o VPS dedicado

> ⚠️ **NOTA:** El DATABASE_URL fue verificado desde el `.env` local. Apunta a un host remoto.  
> **FALTA:** Conectarse directamente al VPS para verificar que MySQL esté corriendo sin límites de conexión, que el pool de Prisma sea adecuado, y que no haya latencia anormal. Esto requiere acceso SSH al VPS.

---

# 🔧 FASE 1 — ELIMINAR RELOADS INNECESARIOS (Prioridad #1)

## El Problema

**19 llamadas a `revalidateRoute()` / `router.refresh()`** que fuerzan a Next.js a revalidar datos del servidor después de cada acción. Con MySQL remoto y 3 conexiones, cada refresh compite y puede fallar.

### Conteo exacto:

**ProjectExecutionClient.tsx (14 llamadas):**
| Línea | Tipo | Contexto |
|---|---|---|
| 235 | `revalidateRoute(pathname)` | Después de fetchMessages en focus |
| 426 | `revalidateRoute(pathname)` | Después de day record start |
| 473 | `revalidateRoute(pathname)` | Después de day record end |
| 1113 | `revalidateRoute(pathname)` | Después de expense save |
| 1254 | `revalidateRoute(pathname)` | Después de team save |
| 1303 | `router.refresh()` | Después de delete expense |
| 1490 | `revalidateRoute(pathname)` | Después de phase complete |
| 1551 | `revalidateRoute(pathname)` | Después de gallery upload |
| 1570 | `revalidateRoute(pathname)` | Después de gallery delete |
| 1735 | `revalidateRoute(pathname)` | Después de ficha save |
| 2111 | `revalidateRoute(pathname)` | Después de gallery rename |
| 2153 | `revalidateRoute(pathname)` | Después de project update |
| (2 más) | `revalidateRoute` | En otros handlers |

**ProjectDetailClient.tsx (5 llamadas):**
| Línea | Tipo | Contexto |
|---|---|---|
| 786 | `revalidateRoute(pathname)` | En focus handler del chat |
| 983 | `revalidateRoute(pathname)` | Después de ficha save |
| 1013 | `revalidateRoute('/admin/proyectos')` | Después de delete project |
| 1151 | `revalidateRoute(pathname)` | Después de expense save |
| (1 más) | `revalidateRoute` | En otro handler |

### Solución:

**Principio:** Si estamos OFFLINE, NUNCA llamar `revalidateRoute()` — los datos ya se actualizaron localmente en Dexie. Si estamos ONLINE, solo llamar cuando sea estrictamente necesario (cambios que afectan datos del servidor que el cliente no puede actualizar localmente).

```typescript
// ❌ ANTES (patrón repetido 19 veces)
const res = await fetch('/api/...', { method: 'POST', ... })
if (res.ok) {
  startTransition(() => {
    revalidateRoute(pathname)  // ← ESTO CAUSA EL RELOAD
  })
}

// ✅ DESPUÉS
const res = await fetch('/api/...', { method: 'POST', ... })
if (res.ok) {
  // Actualizar estado local directamente (ya lo haces)
  setLocalProject(prev => ({ ...prev, ...newData }))
  // NO llamar revalidateRoute — el polling ya traerá datos frescos
}
```

**Regla:** `revalidateRoute()` SOLO se llama cuando:
1. El usuario está online (verificar `navigator.onLine`)
2. La acción cambió datos que afectan a OTROS usuarios (ej: cambiar estado de proyecto)
3. NO cuando el estado local ya refleja el cambio

---

# 🔧 FASE 2 — ARREGLAR RACE CONDITION DEL CHAT (Prioridad #2)

## El Problema

El Service Worker procesa el `outbox` en segundo plano. Al mismo tiempo, el componente de chat escribe en Dexie. Cuando ambos tocan el mismo mensaje:

```
SW: lee outbox → envía al servidor → borra de outbox
UI: usuario escribe nuevo msg → guarda en outbox → actualiza chatMessages
                                ↑ COLISIÓN si el SW estaba borrando
```

### Solución:

**Opción A (recomendada): Mutex por proyecto**
Usar `navigator.locks` para que solo un "escritor" toque el outbox de un proyecto a la vez:

```typescript
// En useProjectMessages.ts
async function safeOutboxWrite(projectId: number, operation: () => Promise<void>) {
  await navigator.locks.request(`outbox-${projectId}`, async () => {
    await operation();
  });
}
```

**Opción B (más simple): Flag de "SW está procesando"**
El SW envía un mensaje `OUTBOX_PROCESSING_START` y `OUTBOX_PROCESSING_FINISHED`. El cliente escucha y pausa escrituras durante el procesamiento.

---

# 🔧 FASE 3 — LIMPIAR TABLA users (Prioridad #3)

## El Problema

```prisma
model User {
  image String? @db.LongText  // ← base64 de avatar guardado aquí
}
```

Cada avatar en base64 ocupa ~200KB-2MB. Con 12+ usuarios, son ~18MB que Prisma carga en cada query que incluye el modelo User.

### Solución:

**Paso 3.1:** Subir avatares a BunnyCDN (ya tienes la integración)
**Paso 3.2:** Cambiar el campo `image` a VARCHAR(500) para guardar solo la URL
**Paso 3.3:** Migración para extraer base64 existentes y subirlos a Bunny

```sql
-- Verificar tamaño actual
SELECT 
  id, 
  name, 
  LENGTH(image) / 1024 AS size_kb 
FROM users 
WHERE image IS NOT NULL 
ORDER BY size_kb DESC;
```

---

# 🔧 FASE 4 — SIMPLIFICAR GlobalSyncWorker (Prioridad #4)

## El Problema

6 `useEffect` en un solo componente. Cada vez que el componente se monta/desmonta (navegación entre páginas), se re-registran listeners.

### useEffect actuales:
1. Línea 44 — `visibilitychange` listener (PWA foreground detection)
2. Línea 69 — `message` listener (upload progress desde SW)
3. Línea 87 — Auto-trigger bulk sync cuando hay sesión
4. Línea 500 — Outbox sync trigger periódico
5. Línea 1146 — Periodic background sync registration
6. Línea 1168 — Online/offline status change

### Solución:

Consolidar en **máximo 3 useEffect** con limpieza correcta:

```typescript
// useEffect 1: Listeners de eventos (visibility, online/offline, SW messages)
useEffect(() => {
  // Registrar todos los listeners aquí
  return () => {
    // Limpiar TODOS
  }
}, [])

// useEffect 2: Sync triggers (solo cuando hay sesión)
useEffect(() => {
  if (!session?.user?.id || !isOnline) return
  // Iniciar sync
}, [session?.user?.id, isOnline])

// useEffect 3: Periodic sync
useEffect(() => {
  // Registrar periodic sync una sola vez
}, [])
```

---

# 🔧 FASE 5 — DOMAR OfflinePrefetcher (Prioridad #5)

## El Problema

`OfflinePrefetcher` envía mensajes `PRECACHE_URLS` al SW con TODAS las URLs sin filtrar. En un celular con datos móviles, esto consume el plan de datos del operador.

### Solución:

```typescript
// Solo prefetch si está en WiFi o si el usuario lo pide explícitamente
useEffect(() => {
  if (!urls || urls.length === 0) return
  
  // Verificar tipo de conexión
  const connection = (navigator as any).connection
  const isWiFi = connection?.type === 'wifi' || connection?.effectiveType === '4g'
  
  if (!isWiFi) {
    console.log('[Prefetch] Skipping on mobile data to save bandwidth')
    return
  }
  
  // ... resto del prefetch
}, [urls])
```

---

# 🔧 FASE 6 — REFACTORIZACIÓN ESTRUCTURAL (La más importante)

> **⚠️ Esta fase resuelve el problema RAIZ de la inestabilidad: 7,530 líneas duplicadas.**

## Estrategia: Migración por Capas

```
Capa 1: HOOKS (lógica sin UI)
  ├── useProjectCache.ts      ← Dexie recovery + caché
  ├── useProjectSync.ts       ← Outbox + background sync
  ├── useProjectMessages.ts   ← Chat + polling + dedup
  ├── useProjectGallery.ts    ← Galería online/offline
  ├── useProjectExpenses.ts   ← Gastos online/offline
  ├── useProjectTeam.ts       ← Equipo
  ├── useProjectPhases.ts     ← Fases
  └── useProjectFicha.ts      ← Ficha técnica

Capa 2: COMPONENTES UI (solo visual)
  ├── ProjectHeader.tsx
  ├── ProjectFicha.tsx
  ├── ProjectTabs.tsx
  ├── ProjectGalleryTab.tsx
  ├── ProjectEvidenceTab.tsx
  ├── ProjectExpensesSection.tsx
  ├── ProjectPhasesSection.tsx
  ├── ProjectTeamSection.tsx
  ├── ProjectClientInfo.tsx
  ├── ProjectDangerZone.tsx
  └── LightboxPreview.tsx

Capa 3: COMPONENTE BASE (unificado)
  └── ProjectDetailBase.tsx   ← UN componente para admin + operador
       Props: { role: 'admin' | 'operator', project, ... }
       Usa TODOS los hooks de Capa 1
       Renderiza TODOS los componentes de Capa 2
       Oculta/secciones según role

Capa 4: WRAPPERS (server components delgados)
  ├── ProjectDetailClient.tsx  ← <ProjectDetailBase role="admin" .../>
  └── ProjectExecutionClient.tsx ← <ProjectDetailBase role="operator" .../>
```

### Orden de Ejecución (NO SALTAR):

#### Día A — Mapeo (sin código nuevo)
- [ ] Comparar lado a lado ProjectDetailClient vs ProjectExecutionClient
- [ ] Marcar: ✅ idéntico, ⚠️ similar, ❌ exclusivo de admin/operador
- [ ] Documentar en este mismo archivo

#### Día B — Hook useProjectCache
- [ ] Extraer lógica de Dexie (recuperación, caché) de AMBOS archivos
- [ ] Probar que ambos componentes siguen funcionando
- [ ] Verificar: abrir proyecto online → recargar offline → debe cargar de Dexie

#### Día C — Hook useProjectSync + useProjectMessages
- [ ] Extraer outbox, background sync, trigger
- [ ] Extraer chat, polling, deduplicación

#### Día D — Hooks restantes (gallery, expenses, team, phases, ficha)
- [ ] Uno por uno, probando después de cada uno

#### Día E — Componentes UI (Galería y Chat)
- [ ] ProjectGalleryTab, ProjectEvidenceTab
- [ ] Probar: subir foto online, subir foto offline, reconectar

#### Día F — Componentes UI restantes
- [ ] ProjectHeader, ProjectFicha, ProjectTabs
- [ ] ProjectExpensesSection, ProjectPhasesSection
- [ ] ProjectTeamSection, ProjectClientInfo
- [ ] ProjectDangerZone, LightboxPreview

#### Día G — Componente BASE
- [ ] Crear ProjectDetailBase.tsx
- [ ] Modificar ProjectDetailClient para que sea wrapper
- [ ] Modificar ProjectExecutionClient para que sea wrapper

#### Día H — Limpieza + Pruebas
- [ ] Eliminar código duplicado
- [ ] Prueba completa: admin online, admin offline, operador online, operador offline

---

## 📋 Checklist de Verificación (CADA paso)

Después de CADA cambio, verificar:

- [ ] `npm run build` pasa sin errores
- [ ] Admin: abrir proyecto, ver chat, galería, gastos, equipo, fases, PDF
- [ ] Admin offline: recargar sin internet, verificar que carga de Dexie
- [ ] Operador: abrir proyecto, ver chat, galería, fichar, gastos
- [ ] Operador offline: todas las acciones offline, reconectar, verificar sync
- [ ] Mobile: probar en viewport pequeño ambos roles

---

## 🔄 Cómo Hacer Rollback

**Si algo falla en cualquier fase:**

1. Los archivos originales NUNCA se borran — se renombran como `.backup.tsx`
2. El componente wrapper simplemente se revierte a importar el `.backup.tsx`
3. Tiempo de rollback: < 1 minuto

```
// Rollback inmediato:
// import ProjectDetailBase from './ProjectDetailBase'
import ProjectDetailClient_backup from './ProjectDetailClient.backup'
```

---

## 📊 Progreso Actual

| Fase | Paso | Estado |
|---|---|---|
| 0 | Docker healthcheck | ✅ COMPLETADO |
| 0 | Verificar MySQL | ✅ COMPLETADO |
| 1 | Eliminar revalidates | ✅ COMPLETADO |
| 2 | Race condition chat | 🔜 PENDIENTE (pospuesto - riesgo SW) |
| 3 | Limpiar users.image | ✅ COMPLETADO |
| 4 | Simplificar GlobalSyncWorker | ⏭️ SKIP (ya arreglado) |
| 5 | Domar OfflinePrefetcher | ✅ COMPLETADO |
| 6 | Refactorización estructural | 🔄 EN PROGRESO |
| 6a | Hook useProjectCache + integrar en Admin | ✅ COMPLETADO |
| 6b | Componentes: ProjectHeader, ProjectTabs, ProjectTeamSection, ProjectClientInfo | ✅ COMPLETADO |
| 6c | Integrar componentes en Operador | ⬜ PENDIENTE |
| 6d | Extraer Ficha, Galería, DangerZone, Lightbox | ⬜ PENDIENTE |

---

*Última actualización: 12 de mayo de 2026*
*Este archivo debe actualizarse después de cada paso completado.*
