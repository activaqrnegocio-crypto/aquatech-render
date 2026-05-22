# 📊 PLAN COMPLETO DE OPTIMIZACIÓN — Aquatech CRM
## Auditoría Integral: VPS → MySQL → Caddy → Next.js → Frontend

**Fecha:** 4 de Mayo 2026
**Versión:** 2.0 — COMPLETO (5 Capas + MySQL en VPS)
**Estado:** ⏳ ESPERANDO APROBACIÓN

---

## 🎯 SÍNTOMAS REALES (Lo que tú sientes como creador/usuario)

| # | Síntoma | Causa Raíz Detectada |
|---|---------|---------------------|
| 1 | **Navegación inestable** — a veces recarga de 0, a veces fluye veloz | `router.refresh()` forzado en 14 lugares. Healthcheck roto (Docker cree que app está muerta). |
| 2 | **Datos lentísimos** — calendario, proyectos, operador | `connection_limit=3` en MySQL remoto estrangula todo. Latencia de internet en cada query. |
| 3 | **Saltar entre secciones** imposible de rápido (header/footer) | Caddy sin compresión gzip ni caché de estáticos. |

---

## 🔬 MÉTRICAS REALES RECOLECTADAS (Diagnóstico Completo)

| Métrica | Valor | Estado |
|---------|-------|--------|
| CPU VPS | 99.5% idle | ✅ Excelente |
| RAM VPS | 689MB usada / 7.8GB total | ✅ Excelente |
| SWAP | 0B (sin swap) | ⚠️ Riesgo |
| Disco | 6.8GB / 145GB (5%) | ✅ Excelente |
| Contenedor RAM | 58MB | ✅ Excelente |
| MySQL Buffer Pool | 8GB (compartido en stackcp) | ✅ |
| MySQL Conexiones | 37 activas / 1024 max | ✅ |
| MySQL Slow Queries | 0 (pero log DESACTIVADO) | ⚠️ Ciego |
| Healthcheck Container | UNHEALTHY (92 fallos) | 🔴 CRÍTICO |
| Firewall (ufw) | INACTIVO | 🔴 CRÍTICO |
| Tabla users | 18.55 MB (por base64 en LongText) | ⚠️ Hinchada |

---

## 🏗️ CAPA 1 — VPS / SERVIDOR (178.238.238.158)

### Estado Actual
- Ubuntu 24.04.4 LTS, Kernel 6.8.0, 4-core AMD EPYC
- 8GB RAM (solo 689MB usada), 145GB SSD
- Sin SWAP, sin firewall (ufw), sin fail2ban
- Docker corriendo 1 contenedor: `aquatech-crm-v2` (Next.js standalone)
- Caddy v2.11.2 como proxy inverso (configuración mínima de 3 líneas)
- **MySQL es REMOTO** — `mysql.gb.stackcp.com:39643` (hosting compartido)

### ⭐ ANÁLISIS CLAVE: ¿Mover MySQL al VPS?

Tu MySQL está en `mysql.gb.stackcp.com` — un hosting compartido. Cada consulta viaja por internet (50-200ms de latencia). Y solo permite 3 conexiones simultáneas.

| Factor | MySQL Remoto (Actual) | MySQL en VPS (Propuesto) |
|--------|----------------------|--------------------------|
| Latencia por query | ~50-200ms (internet) | ~0.1ms (localhost) |
| Connection limit | 3 (forzado por hosting) | 30+ (tú decides) |
| InnoDB Buffer Pool | 8GB (compartido con otros) | 2-4GB (100% para ti) |
| Dependencia externa | Si stackcp.com cae → CRM muerto | Solo depende de tu VPS |
| Backups | Depende del hosting | Tú controlas (automated dump diario) |
| Costo | Incluido en hosting actual | $0 (mismo VPS, ya lo pagas) |
| Mantenimiento | Cero (gestionado por stackcp) | Tú gestionas updates/backups |

**Conclusión:** Mover MySQL al VPS **eliminaría la latencia de red** (50-200ms por query) y el cuello de botella de `connection_limit=3`. Es el cambio de mayor impacto posible en TODO el sistema.

### Optimizaciones Capa 1

| # | Acción | Impacto | Riesgo | Downtime |
|---|--------|---------|--------|----------|
| 1.1 | **Instalar MySQL 8.0 en VPS** (`apt install mysql-server`) | ⭐⭐⭐⭐⭐ Latencia BD → ~0ms | 🟡 Medio | 0 min |
| 1.2 | **Migrar datos:** dump remoto → import local | ⭐⭐⭐⭐⭐ Adiós connection_limit=3 | 🟡 Medio | ~10 min |
| 1.3 | **Cambiar DATABASE_URL** a `localhost:3306` con `connection_limit=30` | ⭐⭐⭐⭐⭐ 14 consultas paralelas reales | 🟢 Bajo | Rebuild |
| 1.4 | Configurar backup automático diario (mysqldump + cron 3am) | ⭐⭐⭐ Seguridad de datos | 🟢 Bajo | 0 min |
| 1.5 | Activar SWAP 2GB | ⭐⭐⭐ Seguridad (evita OOM Kill) | 🟢 Bajo | 0 min |
| 1.6 | Activar `ufw` firewall (permitir solo 22,80,443) | ⭐⭐ Seguridad | 🟢 Bajo | 0 min |
| 1.7 | Instalar fail2ban (protección SSH) | ⭐⭐ Seguridad | 🟢 Bajo | 0 min |

---

## 🌐 CAPA 2 — PROXY INVERSO (Caddy v2.11.2)

### Estado Actual
```caddy
178.238.238.158.sslip.io {
    reverse_proxy localhost:3000
}
```
Solo 3 líneas. Sin compresión, sin caché de estáticos, sin rate limiting.

### Configuración Propuesta
```caddy
178.238.238.158.sslip.io {
    encode gzip zstd

    header {
        X-Frame-Options "DENY"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }

    # Static assets con content hash: cache 1 año
    handle /_next/static/* {
        header Cache-Control "public, max-age=31536000, immutable"
        reverse_proxy localhost:3000
    }

    rate_limit {
        zone dynamic {
            key {remote_host}
            events 100
            window 1m
        }
    }

    reverse_proxy localhost:3000
}
```

### Optimizaciones Capa 2

| # | Acción | Impacto | Riesgo |
|---|--------|---------|--------|
| 2.1 | Agregar compresión gzip + zstd | ⭐⭐⭐⭐⭐ JS/CSS 70% más pequeño | 🟢 Bajo |
| 2.2 | Cachear `/_next/static/*` 1 año (inmutables) | ⭐⭐⭐⭐⭐ Navegación instantánea | 🟢 Bajo |
| 2.3 | Rate limiting (100 req/min por IP) | ⭐⭐ Seguridad | 🟢 Bajo |
| 2.4 | Headers de seguridad (HSTS, X-Frame-Options) | ⭐⭐ Seguridad | 🟡 Medio |

**Requiere:** `systemctl reload caddy` (0 downtime).

---

## 🗄️ CAPA 3 — BASE DE DATOS (MySQL)

### Estado Actual
- MySQL 8.0 remoto en `mysql.gb.stackcp.com:39643` (hosting compartido)
- `connection_limit=3` — **ESTRANGULAMIENTO CRÍTICO**
- `pool_timeout=15` — 15 segundos de espera si no hay conexión libre
- `slow_query_log=OFF` — no sabemos qué consultas son lentas
- `long_query_time=10s` — demasiado alto, debería ser 2s
- Tabla `users`: 18.55 MB — el campo `image` (LongText) almacena base64 de avatares
- Tablas principales: todas <1MB excepto users (18.55), appointments (5.55), quotes (4.56)

### Si MySQL se QUEDA remoto (stackcp.com)

| # | Acción | Impacto | Riesgo |
|---|--------|---------|--------|
| 3.1 | Negociar `connection_limit` más alto con stackcp (mínimo 10) | ⭐⭐⭐⭐⭐ | 🟢 Bajo |
| 3.2 | Activar `slow_query_log` (`long_query_time=2`) | ⭐⭐⭐ Visibilidad | 🟢 Bajo |
| 3.3 | Agregar `@@index([createdAt])` en `chat_messages` | ⭐⭐⭐ | 🟢 Bajo |
| 3.4 | Agregar `@@index([status, updatedAt])` en `projects` | ⭐⭐⭐ | 🟢 Bajo |
| 3.5 | Migrar `users.image` (LongText base64) → Bunny.net URLs | ⭐⭐⭐ Tabla users 18MB→1MB | 🟡 Medio |

### Si MySQL se MIGRA al VPS (RECOMENDADO)

| # | Acción | Impacto | Riesgo |
|---|--------|---------|--------|
| 3.M1 | Instalar MySQL 8.0 local en VPS | ⭐⭐⭐⭐⭐ | 🟡 Medio |
| 3.M2 | `innodb_buffer_pool_size=2G` | ⭐⭐⭐⭐ | 🟢 Bajo |
| 3.M3 | `connection_limit=30`, `pool_timeout=5` | ⭐⭐⭐⭐⭐ Sin esperas | 🟢 Bajo |
| 3.M4 | Activar slow query log local (`long_query_time=2`) | ⭐⭐⭐ | 🟢 Bajo |
| 3.M5 | Backup diario automático (cron + mysqldump a las 3am) | ⭐⭐⭐ | 🟢 Bajo |

---

## ⚙️ CAPA 4 — BACKEND / NEXT.JS 16.2.1

### Estado Actual
- 14 consultas paralelas en `admin/page.tsx` (dashboard)
- Algunas rutas hacen `findMany` sin `select` (traen TODOS los campos)
- `force-dynamic` en dashboard (siempre SSR, nunca cache)
- 14 `router.refresh()` en `ProjectExecutionClient.tsx` — cada uno recarga la página COMPLETA
- Healthcheck del container ROTO (wget intenta IPv6, Next.js solo escucha IPv4)
- `staleTimes: { dynamic: 120, static: 1800 }` — buen inicio pero insuficiente
- `serverActions.bodySizeLimit: 200mb` — muy alto
- Sin caché de aplicación (Redis, etc.)

### Optimizaciones Capa 4

| # | Acción | Impacto | Riesgo | ¿Afecta funcionalidad? |
|---|--------|---------|--------|------------------------|
| 4.1 | Reemplazar `router.refresh()` → `revalidatePath()` + estado local | ⭐⭐⭐⭐⭐ Navegación fluida | 🟡 Medio | ❌ No |
| 4.2 | Agregar `select` explícito a consultas sin él | ⭐⭐⭐ Menos datos transferidos | 🟢 Bajo | ❌ No |
| 4.3 | Arreglar healthcheck (curl -4 en vez de wget) | ⭐⭐⭐ Docker no reinicia solo | 🟢 Bajo | ❌ No |
| 4.4 | Agregar `loading.tsx` (Suspense) en rutas de proyecto | ⭐⭐⭐ UX: skeleton mientras carga | 🟢 Bajo | ❌ No |
| 4.5 | `useOptimistic` en operaciones frecuentes (chat, fases) | ⭐⭐⭐⭐ UX instantánea | 🟡 Medio | ❌ No |
| 4.6 | Reducir `bodySizeLimit` 200MB → 50MB | ⭐ Seguridad | 🟢 Bajo | ❌ No |
| 4.7 | Aumentar `staleTimes.dynamic` 120s → 300s | ⭐⭐⭐ Menos refetches | 🟢 Bajo | ❌ No |

---

## 🎨 CAPA 5 — FRONTEND (React 19 + Tailwind 4)

### Estado Actual
- `ProjectExecutionClient.tsx`: **149 KB** — componente monstruo, hace demasiado
- `ProjectChatUnified.tsx`: **70 KB**
- `GlobalSyncWorker.tsx`: **48 KB** (6 useEffect)
- `AppointmentModal.tsx`: **58 KB**
- 30+ `useEffect` distribuidos en componentes
- Sin lazy loading de imágenes (usa compresión client-side con canvas)
- Bunny.net CDN para media uploads ✅, pero NO para assets estáticos de Next.js
- `OfflinePrefetcher` precachea rutas agresivamente
- Dexie/IndexedDB para capa offline (robusta pero con overhead de serialización)

### Optimizaciones Capa 5

| # | Acción | Impacto | Riesgo |
|---|--------|---------|--------|
| 5.1 | Dividir `ProjectExecutionClient.tsx` (149KB) en 4-5 subcomponentes | ⭐⭐⭐ Mantenibilidad + JS más pequeño | 🟡 Medio |
| 5.2 | `next/dynamic(() => import(...))` para componentes pesados | ⭐⭐⭐ JS inicial más pequeño | 🟢 Bajo |
| 5.3 | `next/image` con lazy loading para todas las imágenes | ⭐⭐⭐ LCP mejorado | 🟡 Medio |
| 5.4 | Mover compresión de imágenes a Web Worker | ⭐⭐ UI no se congela al subir fotos | 🟡 Medio |
| 5.5 | `loading.tsx` en `/admin/proyectos/[id]` y rutas lentas | ⭐⭐ UX skeleton inmediato | 🟢 Bajo |

---

## 🗺️ PLAN DE EJECUCIÓN (5 FASES — Menor a Mayor Riesgo)

---

### 🔵 FASE 1 — Código: Adiós Recargas Nucleares (1.5h, riesgo BAJO-MEDIO)

**Objetivo:** Eliminar las recargas de página completas. Es lo que MÁS vas a notar como usuario.

| Paso | Acción | Rollback |
|------|--------|----------|
| 1.1 | Reemplazar 14 `router.refresh()` → `revalidatePath()` + actualización estado local | `git revert` |
| 1.2 | Agregar `select` explícito a consultas Prisma sin él | `git revert` |
| 1.3 | Agregar `loading.tsx` en `/admin/proyectos/[id]` | Borrar archivo |
| 1.4 | Aumentar `staleTimes.dynamic` 120s → 300s en next.config | Revertir 1 línea |
| 1.5 | Reducir `bodySizeLimit` 200MB → 50MB en next.config | Revertir 1 línea |
| 1.6 | Agregar `prefetch` a links del Sidebar | Quitar prop |

**Requiere:** `npm run build` + deploy (~5 min downtime).
**Impacto:** Resuelve Síntoma 1 (navegación inestable).

---

### 🟢 FASE 2 — VPS + Caddy: Servidor Sólido (1h, riesgo BAJO)

**Objetivo:** Comprimir estáticos, arreglar healthcheck, asegurar servidor.

| Paso | Acción | Rollback |
|------|--------|----------|
| 2.1 | Arreglar healthcheck (`curl -4` en vez de `wget`) en docker-compose | Revertir 1 línea |
| 2.2 | Agregar compresión gzip + caché `/_next/static/*` en Caddyfile | Revertir archivo |
| 2.3 | Activar SWAP 2GB en VPS | `swapoff /swapfile && rm /swapfile` |
| 2.4 | Activar `ufw` firewall (permitir 22,80,443) | `ufw disable` |
| 2.5 | Instalar fail2ban | `apt remove fail2ban` |

**Requiere:** `systemctl reload caddy` (0 downtime). `docker compose up -d` (~3 seg).
**Impacto:** Resuelve Síntoma 3 (navegación entre secciones). Seguridad del VPS.

---

### 🟡 FASE 3 — MySQL al VPS: El Cambio Más Grande (2h, riesgo MEDIO)

**Objetivo:** Latencia BD de 100ms → 0.1ms. Conexiones de 3 → 30.

| Paso | Acción | Rollback |
|------|--------|----------|
| 3.1 | `apt install mysql-server-8.0` en VPS | `apt remove mysql-server` |
| 3.2 | `mysqldump` del remoto → copiar al VPS → importar local | Volver DATABASE_URL al remoto |
| 3.3 | Crear usuario `aquatech` en MySQL local con permisos | Borrar usuario |
| 3.4 | Cambiar `DATABASE_URL` a `mysql://aquatech:password@localhost:3306/aquatech?connection_limit=30&pool_timeout=5` | Revertir env var |
| 3.5 | Configurar `innodb_buffer_pool_size=2G` en `/etc/mysql/my.cnf` | Revertir config |
| 3.6 | Backup diario automático (cron: `mysqldump` a las 3am) | Borrar cron job |
| 3.7 | Agregar índices: `chat_messages(createdAt)`, `projects(status, updatedAt)` | `DROP INDEX` |

**Requiere:** ~10 min downtime (migración de datos). Rebuild y deploy (~5 min).
**Riesgo:** Medio. **Hacer backup del remoto ANTES.** Si falla, se vuelve al DATABASE_URL remoto.
**Impacto:** Resuelve Síntoma 2 (datos lentos) CASI COMPLETAMENTE.

---

### 🟠 FASE 4 — Caché de Aplicación (1.5h, riesgo MEDIO)

**Objetivo:** Dashboard y páginas frecuentes se cargan desde caché, no desde BD.

| Paso | Acción | Rollback |
|------|--------|----------|
| 4.1 | `unstable_cache` en dashboard queries (30s TTL) | `git revert` |
| 4.2 | `useOptimistic` en chat y fases | `git revert` |
| 4.3 | Migrar `users.image` base64 → Bunny.net URLs | Restaurar backup BD |

**Requiere:** Rebuild y deploy (~5 min).
**Impacto:** Dashboard carga en <200ms. Operaciones se sienten instantáneas.

---

### 🔴 FASE 5 — Frontend Profundo (2h, riesgo MEDIO-ALTO)

**Objetivo:** Componentes más ligeros, imágenes optimizadas, carga inicial más rápida.

| Paso | Acción | Rollback |
|------|--------|----------|
| 5.1 | Dividir `ProjectExecutionClient.tsx` (149KB) en subcomponentes | `git revert` |
| 5.2 | `next/dynamic` lazy loading para componentes pesados | `git revert` |
| 5.3 | `next/image` con lazy loading para imágenes | `git revert` |
| 5.4 | Web Worker para compresión de imágenes | `git revert` |

**Requiere:** Rebuild y deploy (~5 min).
**Riesgo:** Medio-Alto por el refactor de ProjectExecutionClient. Probar exhaustivamente.

---

## 📈 IMPACTO ESTIMADO TOTAL

| Síntoma | Antes | Fase 1 | +Fase 2 | +Fase 3 (MySQL VPS) | +Fase 4 | +Fase 5 |
|---------|-------|--------|---------|---------------------|---------|---------|
| 🐌 Recargas nucleares | Aleatorio | ✅ Resuelto | — | — | — | — |
| 🐌 Datos lentos (calendario/proyectos) | 3-8s | — | — | ✅ <500ms | ✅ <200ms | — |
| 🐌 Navegación entre secciones | 2-4s | ✅ Fluida | ✅ <500ms | — | — | ✅ <200ms |

---

## ⚠️ ALERTAS OBLIGATORIAS

### ¿Algún cambio afecta funcionalidad del CRM?
**NO.** Todas las optimizaciones son transparentes. Misma lógica, mismos datos, mismo comportamiento visible. Solo cambia cómo se entregan.

### ¿Qué requiere reinicio/downtime?
| Cambio | Downtime |
|--------|----------|
| Fase 1 (código) | ~5 min (rebuild + deploy) |
| Fase 2.1 (healthcheck) | ~3 segundos |
| Fase 2.2 (Caddy reload) | 0 segundos |
| **Fase 3 (migración MySQL)** | **~10 min** |
| Fase 4-5 (código) | ~5 min cada una |

### ¿Qué implica riesgo de pérdida de datos?
- ⚠️ **Fase 3 (migración MySQL):** Hacer `mysqldump` del remoto ANTES de empezar. Si algo falla, se vuelve al DATABASE_URL remoto y no se pierde nada.
- ⚠️ **Fase 4.3 (migrar avatares):** Hacer backup de BD primero.

### ¿Impacto en otros sitios/servicios del VPS?
**No hay otros servicios.** Solo corre Aquatech CRM en este VPS.

---

## 🎯 RECOMENDACIÓN FINAL

**Mi recomendación: Fase 1 + Fase 3 como prioridad absoluta.**

Estos dos cambios solos resuelven el ~80% de los problemas que sientes:
- **Fase 1** → Adiós recargas nucleares al navegar y operar
- **Fase 3** → Los datos vuelan (MySQL local, sin latencia de internet, 30 conexiones)

Luego Fase 2 (Caddy) para pulir la navegación entre secciones.

---

## ✅ PRÓXIMO PASO

> **¿Autorizas comenzar con Fase 1 (código, sin riesgo para datos)?**
> 
> Es la más segura — solo cambios de código con rollback instantáneo vía git.
> Mientras la ejecuto, revisamos juntos el plan de Fase 3 (MySQL al VPS) para decidir si procedemos.
