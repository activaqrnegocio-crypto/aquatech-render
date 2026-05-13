# 🛠️ PLAN DE REFACTORIZACIÓN — OPERADOR (ProjectExecutionClient)

> **Basado en:** Lo que ya hicimos con Admin. Mismos hooks, mismos componentes compartidos.  
> **Archivo objetivo:** `src/components/ProjectExecutionClient.tsx` (3464 líneas → ~300 líneas)  
> **Frontend:** RESPETAR el diseño actual del Operador (es diferente al Admin)

---

## 📊 Estado Actual

| Archivo | Líneas | Rol |
|---|---|---|
| `ProjectExecutionClient.tsx` | **3464** | Operador |
| `ProjectDetailClient.tsx` (Admin) | ~~4066~~ → **14** ✅ |

### Lo que YA tenemos compartido:

| Componente/Hook | Ubicación | Usado en Admin |
|---|---|---|
| `useProjectCache` | `src/hooks/` | ✅ |
| `ProjectDetailBase` | `src/components/project/` | ✅ (role="admin") |
| `ProjectHeader` | `src/components/project/` | ✅ |
| `ProjectTabs` | `src/components/project/` | ✅ |
| `ProjectTeamSection` | `src/components/project/` | ✅ |
| `ProjectClientInfo` | `src/components/project/` | ✅ |
| `ProjectGalleryTab` | `src/components/project/` | ✅ Creado |
| `LightboxPreview` | `src/components/project/` | ✅ |

### Lo que es EXCLUSIVO del Operador (NO está en Admin):

| Feature | Archivo | Líneas aprox |
|---|---|---|
| Day Records (fichar entrada/salida) | `ProjectExecutionClient` | ~200 |
| GPS Location tracking | `ProjectExecutionClient` | ~80 |
| Tareas (appointments) | `ProjectExecutionClient` | ~150 |
| Records/Tasks tab (diferente al Admin) | `ProjectExecutionClient` | ~300 |
| Outbox status (barra de sincronización) | `ProjectExecutionClient` | ~50 |

---

## 🗺️ Arquitectura Post-Refactorización

```
┌────────────────────────────────────────────────────────────┐
│  admin/operador/proyecto/[id]/page.tsx (server component)  │
│  → 74 líneas (no tocar, solo cambia el import)             │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  ProjectExecutionClient.tsx  ← WRAPPER (~300 líneas)       │
│  Props: project, initialChat, activeRecord, expenses,      │
│         userId, clientName, projectCity, etc.              │
│                                                             │
│  Cosas EXCLUSIVAS que van AQUÍ:                             │
│  ├── Day Record (fichar)                                    │
│  ├── GPS Location                                           │
│  ├── Tareas                                                 │
│  ├── Records/Tasks Tab JSX                                  │
│  └── useProjectCache({ role: 'operator' })                  │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  ProjectDetailBase.tsx  (role="operator")                   │
│                                                             │
│  Usa COMPARTIDO (desde el hook y componentes):              │
│  ├── Chat, Galería, Gastos, Equipo, Cliente                │
│  ├── Header, Tabs, Lightbox                                 │
│  ├── Online/Offline (Dexie recovery)                        │
│  └── TODO igual que Admin                                   │
└────────────────────────────────────────────────────────────┘
```

---

## 📋 Orden de Ejecución (PASO A PASO)

### ⚠️ REGLA DE ORO
1. **Backup:** Siempre tener backup del archivo original
2. **Compilar:** `npx tsc --noEmit` después de CADA paso
3. **Frontend:** NO cambiar el diseño del operador
4. **Online/Offline:** Verificar ambos modos

---

## FASE 1 — AGREGAR useProjectCache (10 min)

### 1.1 Importar el hook
En `src/components/ProjectExecutionClient.tsx`, AGREGAR al inicio:

```typescript
import { useProjectCache } from '@/hooks/useProjectCache'
```

### 1.2 Reemplazar states de Dexie
ELIMINAR los siguientes states y lógica DUPLICADA:

```typescript
// ❌ ELIMINAR estos useMemo y useState:
const idFromUrl = useMemo(() => { ... }, [pathname, searchParams]);  // DUPLICADO
const [isOnline, setIsOnline] = useState(true);                       // DUPLICADO
const [isOfflineMode, setIsOfflineMode] = useState(false);           // DUPLICADO
const [isSyncingOffline, setIsSyncingOffline] = useState(false);     // DUPLICADO
const [cacheNotFound, setCacheNotFound] = useState(false);            // DUPLICADO
const [localProject, setLocalProject] = useState<any>(null);         // DUPLICADO
const [localChat, setLocalChat] = useState<any[]>([]);               // DUPLICADO
const isIdentityMismatch = ...                                        // DUPLICADO
const project = ...                                                   // DUPLICADO
const [localClientName, setLocalClientName] = ...                    // PUEDE IRSE
const [localProjectAddress, setLocalProjectAddress] = ...            // PUEDE IRSE
const [localProjectCity, setLocalProjectCity] = ...                  // PUEDE IRSE
```

REEMPLAZAR con:

```typescript
const {
  idFromUrl,
  project,
  localProject,
  localChat,
  setLocalProject,
  setLocalChat,
  isOfflineMode,
  isSyncingOffline,
  cacheNotFound,
  triggerBackgroundSync,
  deduplicateMessages,
  pendingItems,
} = useProjectCache({ role: 'operator', initialProject })
```

### 1.3 Eliminar el viejo bloque de recovery
Encontrar y ELIMINAR todo el bloque que comienza con:
```typescript
// v253: Robust ID extraction
```
y termina con:
```typescript
// v315: Fix loop offline shell
```

Este bloque incluye:
- ID extraction useMemo
- fetchMessages (este se MANTIENE si tiene polling propio)
- triggerBackgroundSync (lo provee el hook)
- Deduplicate messages
- pending items useLiveQuery

### 1.4 Verificar
```bash
npx tsc --noEmit
```

---

## FASE 2 — USAR ProjectDetailBase (15 min)

### 2.1 Importar el Base
```typescript
import ProjectDetailBase from '@/components/project/ProjectDetailBase'
```

### 2.2 Reemplazar el return JSX
El Operador tiene su PROPIO layout con tabs: `RECORDS | CHAT | GALLERY`.  
NO reemplazar TODO el JSX — solo lo que es IDÉNTICO a Admin.

**Lo que SÍ se reemplaza (llama a ProjectDetailBase):**

| Sección del Operador | Componente Base |
|---|---|
| Header (título, estado, offline badge) | `<ProjectHeader>` |
| Tab navegación (Records/Chat/Gallery) | `<ProjectTabs>` |
| Chat unificado WhatsApp | `ProjectChatUnified` (ya lo usa) |
| Galería de Planos | `<ProjectGalleryTab>` |
| Galería de Finales | `<ProjectGalleryTab category="EVIDENCE">` |
| Sección de Equipo | `<ProjectTeamSection>` |
| Info del Cliente | `<ProjectClientInfo>` |
| Modal Lightbox | `<LightboxPreview>` |
| Header offline "Proyecto no disponible" | Se mantiene IGUAL |
| Spinner de sincronización | Se mantiene IGUAL |

**Lo que NO se reemplaza (se queda en el wrapper):**

| Sección | Razón |
|---|---|
| **Day Records** (fichar entrada/salida) | Solo Operador |
| **GPS Location** | Solo Operador |
| **Tareas / Appointments** | Solo Operador |
| **Records tab** (el primer tab) | Solo Operador |
| **Outbox Status bar** | Solo Operador |

### 2.3 Estructura final del wrapper

```tsx
export default function ProjectExecutionClient({ 
  project: initialProject, 
  initialChat, 
  activeRecord, 
  expenses, 
  userId,
  clientName,
  projectAddress,
  projectCity,
  availableOperators = [],
  panelBase = '/admin/operador'
}: any) {

  // ─── Hook compartido ───
  const {
    idFromUrl,
    project,
    localProject,
    localChat,
    setLocalProject,
    setLocalChat,
    isOfflineMode,
    isSyncingOffline,
    cacheNotFound,
    triggerBackgroundSync,
    deduplicateMessages,
    pendingItems,
  } = useProjectCache({ role: 'operator', initialProject })

  // ─── States del Operador ───
  const [liveChat, setLiveChat] = useState<any[]>(initialChat || [])
  const [localExpenses, setLocalExpenses] = useState<any[]>(expenses || [])
  const [activeTab, setActiveTab] = useState<'records' | 'chat' | 'gallery'>('records')

  // ─── Handlers EXCLUSIVOS del Operador ───
  // Day records, GPS, Tareas, etc.
  // (estos NO están en Admin)

  // ─── Render ───
  // Loading/Offline/Error states
  if (!mounted) return null
  if (cacheNotFound) return <div>Proyecto no disponible offline</div>
  if (isSyncingOffline) return <div>Sincronizando...</div>

  return (
    <div className="p-6">
      {/* Header compartido */}
      <ProjectHeader project={project} ... />
      
      {/* Tabs del operador (RECORDS | CHAT | GALLERY) */}
      <ProjectTabs activeTab={activeTab} ... />

      {/* SECCIÓN EXCLUSIVA DEL OPERADOR: RECORDS TAB */}
      {activeTab === 'records' && (
        <>
          {/* Day Records */}
          {/* GPS */}
          {/* Tareas */}
        </>
      )}

      {/* CHAT TAB - compartido */}
      {activeTab === 'chat' && (
        <ProjectChatUnified ... />
      )}

      {/* GALLERY TAB - compartido */}
      {activeTab === 'gallery' && (
        <ProjectGalleryTab ... />
      )}

      {/* Team y Cliente - compartidos */}
      <ProjectTeamSection ... />
      <ProjectClientInfo project={project} />

      {/* Lightbox - compartido */}
      <LightboxPreview ... />
    </div>
  )
}
```

---

## FASE 3 — ELIMINAR CÓDIGO DUPLICADO (5 min)

Después de Fase 1 y 2, eliminar:

- `import { db } from '@/lib/db'` → ya lo maneja useProjectCache
- `import { useLiveQuery } from 'dexie-react-hooks'` → ya lo maneja useProjectCache  
- `revalidateRoute` import y todas sus llamadas → ya se eliminaron en Fase 1 de Admin
- Todos los `router.refresh()` y `revalidateRoute()` → ya se eliminaron
- `idFromUrl` useMemo → ya está en useProjectCache
- `triggerBackgroundSync` → ya está en useProjectCache
- `deduplicateMessages` → ya está en useProjectCache
- `pendingItems` useLiveQuery → ya está en useProjectCache

---

## FASE 4 — LIMPIEZA DE IMPORTS (5 min)

Verificar y eliminar imports que ya no se usan:

```typescript
// ❌ Eliminar si ya no se usan directamente:
import { db } from '@/lib/db'               // Lo maneja useProjectCache
import { useLiveQuery } from 'dexie-react-hooks' // Lo maneja useProjectCache
import { prepareFileForOutbox, generateSyncId } from '@/lib/offline-utils'

// ✅ Mantener si aún se usan:
import { useSession } from 'next-auth/react'
import { formatToEcuador, ... } from '@/lib/date-utils'
import { compressImage as optimizedCompress, ... } from '@/lib/image-optimization'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useOutboxStatus } from '@/hooks/useOutboxStatus'
import ProjectChatUnified from './chat/ProjectChatUnified'
import { translateType, translateCategory } from '@/lib/constants'
```

---

## FASE 5 — VERIFICACIÓN FINAL (10 min)

### 5.1 Compilar
```bash
npx tsc --noEmit
```

### 5.2 Probar Online
1. `npm run dev`
2. Ir a `http://localhost:3000/admin/operador`
3. Abrir un proyecto
4. Verificar: Chat, Galería, Nota de gasto, Equipo, Ficha editable
5. Verificar: Day records (fichar entrada/salida)
6. Verificar: GPS location
7. Verificar: Tareas

### 5.3 Probar Offline
1. Abrir un proyecto mientras estás online
2. Abrir DevTools → Network → Marcar "Offline"
3. Recargar la página
4. Verificar que carga desde Dexie (IndexedDB)
5. Verificar: Chat, Galería, Gastos, Equipo
6. Desmarcar "Offline" y verificar sincronización

---

## 📊 Comparativa Final

| Métrica | Antes | Después |
|---|---|---|
| `ProjectExecutionClient.tsx` | **3464 líneas** | **~300 líneas** |
| Código duplicado con Admin | ~2500 líneas | ~0 líneas |
| Bugs online/offline | Repartidos en 2 archivos | Arreglados en 1 lugar |
| Nuevo componente | ninguno | MISMO que Admin |

---

## 🔄 Rollback

Si algo falla, el backup del archivo original está en:
```
src/components/ProjectExecutionClient.backup.tsx
```

Renombrar para restaurar:
```bash
mv ProjectExecutionClient.backup.tsx ProjectExecutionClient.tsx
```

---

*Creado: 12 de mayo de 2026*
*Basado en la refactorización exitosa de Admin*
