# 🚀 Plan de Estabilización: Sincronización Multimedia Offline-Online

Este documento define la ruta para arreglar los fallos de sincronización en segundo plano.

## PROBLEMAS Y SOLUCIONES

### 1. Convertir archivos a Base64 ANTES de guardar en outbox
Las `blob:` URLs mueren al minimizar la app. Debemos guardar el contenido real (Base64) en el outbox.
**Donde:** En todos los componentes que llaman a `db.outbox.add`.

### 2. Error en storageConfig (Fallo Silencioso)
Si el SW no obtiene la config, hoy "pasa" del item y lo marca como sincronizado (roto).
**Solución:** `throw new Error` si no hay config para forzar reintento.

### 3. Retry de Configuración
Añadir un reintento de fetch de config justo antes de procesar items con media.

---

## ROADMAP DE IMPLEMENTACIÓN

### [X] Paso 1: Blindaje de Service Worker (custom-sw.js)
- Cambiar lógica de `processMedia` para abortar si no hay config.
- Añadir retry de config en el loop de procesamiento.

### [ ] Paso 2: Utilidad Base64 en el Cliente
- Crear `fileToBase64` en un lugar común o usarlo en cada hook.

### [ ] Paso 3: Chat (ProjectExecutionClient.tsx)
- Convertir imágenes/audios a base64 antes de `db.outbox.add`.

### [ ] Paso 4: Gastos (ExpenseForm.tsx)
- Convertir comprobante a base64.

### [ ] Paso 5: Galería (GalleryManager.tsx)
- Convertir subidas masivas a base64.

---
**ESTADO ACTUAL:** Iniciando Paso 1.
