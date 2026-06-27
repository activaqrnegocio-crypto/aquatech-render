# Plan Fase: SQLite Nativo Completo + Offline APK

## Estado Actual (Junio 2026)

| Componente | PWA | APK |
|-----------|-----|-----|
| Notificaciones push | - | ✅ Nativo funcional |
| SQLite nativo (`native-storage.ts`) | - | ✅ Inicializado con 7 tablas |
| Router storage (`storage.ts`) | Dexie | ✅ SQLite |
| SW Bridge (postMessage) | - | ✅ Configurado |
| Outbox Admin (`ProjectDetailBase`) | Dexie | ✅ SQLite (via `addToOutbox`) |
| Outbox Operador (`ProjectExecutionClient`) | Dexie | ❌ **Dexie directo** |
| Outbox Acciones (`useProjectActions`) | Dexie | ❌ **Dexie directo** |
| Outbox Team (`ProjectTeamSection`) | Dexie | ❌ **Dexie directo** |
| Offline páginas (SW cache) | ✅ Funciona | ❌ **No funciona** |

---

## Objetivo

Que la APK funcione offline **exactamente igual que la PWA**, pero con:
- ✅ **SQLite nativo** para almacenamiento de datos
- ✅ **Service Worker** para caché de páginas (mismo que PWA)
- ✅ Sincronización en 2º plano nativa

---

## Plan de Implementación

### Fase 1: Conectar outbox del operador a SQLite nativo
**Archivo:** `src/components/ProjectExecutionClient.tsx`

| # | Cambio | Archivo | Riesgo |
|---|--------|---------|--------|
| 1.1 | Cambiar `db.outbox.add(...)` por `addToOutbox(...)` (8 ocurrencias) | `ProjectExecutionClient.tsx` | 🟡 Medio |
| 1.2 | Mismo cambio en `useProjectActions.ts` (4 ocurrencias) | `useProjectActions.ts` | 🟡 Medio |
| 1.3 | Mismo cambio en `ProjectTeamSection.tsx` (2 ocurrencias) | `ProjectTeamSection.tsx` | 🟡 Medio |

**Verificación:** Outbox de operador guarda en SQLite en APK, Dexie en PWA.

---

### Fase 2: Cachear datos offline en SQLite nativo
**Archivos:** `storage.ts`, `native-storage.ts`

Actualmente `storage.ts` ya tiene funciones para cachear proyectos, chat, materiales en SQLite. Pero los hooks (`useProjectCache`) usan Dexie directamente.

| # | Cambio | Riesgo |
|---|--------|--------|
| 2.1 | Verificar que `useProjectCache` guarde en `storage.ts` en vez de Dexie directo | 🟡 Medio |
| 2.2 | Verificar que el chat offline se guarde en SQLite para APK | 🟡 Medio |

---

### Fase 3: Service Worker - Caché de páginas para APK
**Archivo:** `public/custom-sw.js`

El SW ya tiene lógica especial para APK (`isAndroidNative`), pero las páginas no se están cacheando correctamente.

| # | Cambio | Riesgo |
|---|--------|--------|
| 3.1 | Verificar que el SW se registre en APK (logs) | 🟢 Bajo |
| 3.2 | Verificar que offline-shell se cachee correctamente | 🟢 Bajo |
| 3.3 | Probar: abrir app online → cerrar → WiFi off → abrir app | 🟢 Bajo |

---

### Cosas que NO se tocan

| Funcionalidad | Motivo |
|--------------|--------|
| ❌ Notificaciones push nativas | Ya funcionan en APK |
| ❌ Código de PWA (`custom-sw.js`) | Solo se agrega lógica APK condicional |
| ❌ Envío de mensajes, fotos, videos | No tocar |
| ❌ `db.ts` (Dexie) | Sigue siendo el fallback para PWA |
| ❌ `Capacitor config` | Solo si es necesario |
| ❌ Plugins nativos (cámara, GPS, audio) | Ya funcionan |

---

## Orden de trabajo

```
Paso 1: ProjectExecutionClient.tsx (operador outbox → SQLite) 
Paso 2: useProjectActions.ts (acciones outbox → SQLite)
Paso 3: ProjectTeamSection.tsx (team outbox → SQLite)
Paso 4: Probar outbox en APK (enviar mensaje offline, verificar SQLite)
Paso 5: Diagnosticar SW caching en APK
Paso 6: Arreglar SW caching si es necesario
Paso 7: Probar offline completo en APK
```

---

## Verificación final

| Prueba | Resultado esperado |
|--------|-------------------|
| Abrir APK con WiFi | App carga, SQLite inicializado |
| Enviar mensaje offline | Mensaje va a outbox SQLite |
| Apagar WiFi, abrir app frío | SW sirve página desde caché |
| Volver online | Outbox se sincroniza automáticamente |
| Push notifications | Siguen funcionando |
