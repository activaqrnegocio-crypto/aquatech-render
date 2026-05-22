# Arquitectura de Sincronización Aquatech PWA (v2.0)

Este documento describe la arquitectura de sincronización de "Grado Industrial" implementada para garantizar que el CRM funcione perfectamente en condiciones de baja conectividad.

## 🚀 Fases Implementadas

### Fase 1: Background Fetch API (Multimedia Resiliente)
*   **Problema**: Las subidas de fotos/videos se cancelaban si el usuario cerraba la pestaña.
*   **Solución**: Implementación de `BackgroundFetch`. Ahora el navegador gestiona la subida de forma independiente al ciclo de vida de la pestaña.
*   **Alcance**: Galería de fotos, videos de chat, PDFs de cotizaciones.

### Fase 2: Web Locks API (Integridad Multi-Pestaña)
*   **Problema**: Si el usuario abría el CRM en varias pestañas, se enviaban datos duplicados al reconectar.
*   **Solución**: Uso de `navigator.locks`. Solo una instancia (la primera) obtiene la "llave" para procesar el outbox.
*   **Alcance**: Tareas de calendario, gastos, mensajes de texto, cambios de estado de proyecto.

### Fase 3: Causal Ordering (Chat Secuencial)
*   **Problema**: Los mensajes enviados offline podían llegar desordenados al servidor.
*   **Solución**: Sistema de `sequenceNumber` lógico. Los mensajes se ordenan por secuencia de creación, no por llegada al servidor.
*   **Alcance**: Chat de proyectos (texto y media).

### Fase 4: Optimización Pro (Estabilidad de Producción)
*   **Exponential Backoff**: Si un envío falla, el sistema espera más tiempo para el siguiente intento (2s, 4s, 8s...), ahorrando batería y CPU.
*   **Retry Limit**: Límite estricto de 5 reintentos para evitar "items zombies" que nunca se envían.
*   **Notificaciones de Robot**: El usuario recibe notificaciones silenciosas del progreso de sincronización en segundo plano.

### Fase 5: Resiliencia de Visualización y Limpieza Automática (v317)
*   **Persistent Previews**: Se corrigió el problema de "imágenes rotas" regenerando Object URLs dinámicamente desde el almacenamiento binario (ArrayBuffer) si el original expira.
*   **Storage Monitoring**: El Service Worker ahora verifica el espacio disponible antes de subidas pesadas para prevenir fallos críticos del sistema operativo por falta de cuota.
*   **Auto-Cleanup**: El sistema limpia automáticamente notificaciones de sincronización "colgadas" al activar el Service Worker o al finalizar procesos fatales.
*   **Mapeo de Categorías**: Se unificaron las categorías de galería (EVIDENCE/FINALES) para asegurar que todo lo subido sea visible inmediatamente en la UI del operador.

---

## 🛠️ Flujo de Datos Actualizado

1.  **Captura**: El usuario realiza una acción (foto, mensaje, tarea).
2.  **Persistence**: Se guarda inmediatamente en **IndexedDB (Dexie)** con estado `pending`.
3.  **Trigger**: La app llama a `triggerBackgroundSync()`.
4.  **Lock**: El Service Worker intenta adquirir `aquatech_outbox_lock`.
5.  **Process**:
    *   Si es pesado (>1MB): Inicia `BackgroundFetch`.
    *   Si es ligero: Envío directo con reintentos y backoff.
6.  **Cleanup**: Una vez confirmado por el servidor (o subido a Bunny.net), el item se elimina del outbox local.

**Estado Actual: RESILIENCIA MÁXIMA ALCANZADA — v333 HEARTBEAT**

---

## 🩺 v333 — Monitoreo y Visibilidad (Mayo 2026)

### Problema Detectado
Los logs en `/admin/debug/sync` no mostraban actividad real. El robot trabajaba en silencio sin confirmación visible.

### Correcciones Implementadas

1. **Logs unificados**: `GlobalSyncWorker` ahora escribe a `db.syncLogs` en cada evento clave (inicio sync, éxito, error, desconexión).
2. **Listeners duplicados eliminados**: El SW tenía 2 `sync` listeners que competían. Se consolidó en uno solo.
3. **Heartbeat cada 30s**: El robot emite un latido periódico visible en la UI como "Robot VIVO hace X segundos".
4. **Panel de estado en /admin/debug/sync**: Muestra 5 indicadores: Robot VIVO/DORMIDO, último latido, ítems pendientes, estado de red, versión SW.
5. **Confirmación de instalación**: Al registrarse el SW, escribe un log `🤖 Robot vXXX instalado correctamente`.
6. **PING/PONG**: El cliente hace ping al SW cada 60s y el SW responde con su versión y estado.
7. **Bug fix**: `addRobotLog()` no existía en el SW → reemplazado por `logSyncSW()`.
