// src/lib/native-storage.ts
// SQLite nativo para Android - NO toca db.ts (Dexie sigue para iOS/browser)
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

let db: any = null;
let useNative = false;
let sqliteConn: any = null;
let initPromise: Promise<void> | null = null;

// ─── v380: SW BRIDGE FOR APK SYNC ────────────────────────
// El Service Worker necesita un puente para acceder a SQLite nativo
// ya que el SW no puede importar módulos directamente en el contexto Android.
// ============================================
// INIT - Llamar al arrancar la app
// ============================================
export async function init(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    useNative = false;
    return;
  }
  
  // Evitar doble inicialización (incluso en llamadas simultáneas)
  if (db !== null && useNative) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    let lastError: any = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[NativeStorage] Retry attempt ${attempt}/5...`);
          await new Promise(r => setTimeout(r, 1000));
        }
        
        const sqlite = new SQLiteConnection(CapacitorSQLite);
        let conn;
        
        try {
          conn = await sqlite.createConnection('aquatech-offline', false, 'no-encryption', 1, false);
        } catch (createErr: any) {
          if (createErr?.message?.includes('already exists')) {
            console.log('[NativeStorage] Connection exists, closing and recreating...');
            await sqlite.closeConnection('aquatech-offline', false);
            conn = await sqlite.createConnection('aquatech-offline', false, 'no-encryption', 1, false);
          } else {
            throw createErr;
          }
        }
        await conn.open();
        
        db = conn;
        sqliteConn = sqlite;
        useNative = true;

        // Crear las 6 tablas críticas
        await db.execute(`
          CREATE TABLE IF NOT EXISTS outbox (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            payload TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            processed INTEGER DEFAULT 0,
            attempts INTEGER DEFAULT 0
          )
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS syncLogs (
            id TEXT PRIMARY KEY,
            syncId TEXT UNIQUE NOT NULL,
            resultId TEXT,
            createdAt TEXT NOT NULL
          )
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS projectsCache (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            lastAccessedAt TEXT NOT NULL
          )
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS chatCache (
            id TEXT PRIMARY KEY,
            projectId INTEGER NOT NULL,
            data TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          )
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS materialsCache (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            lastAccessedAt TEXT NOT NULL
          )
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS appointmentsCache (
            id TEXT PRIMARY KEY,
            userId INTEGER NOT NULL,
            data TEXT NOT NULL,
            date TEXT NOT NULL,
            lastAccessedAt TEXT NOT NULL
          )
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS authCache (
            id TEXT PRIMARY KEY,
            token TEXT NOT NULL,
            userId TEXT NOT NULL,
            expires TEXT
          )
        `);

        console.log('[NativeStorage] SQLite initialized with 7 tables');

        // ─── v412: SW BRIDGE FIJO ────────────────────────────────
        // El SW usa clients.postMessage(), NO window.postMessage()
        // La app recibe mensajes del SW via navigator.serviceWorker.onmessage
        if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
          navigator.serviceWorker.addEventListener('message', async (event: MessageEvent) => {
            if (event.data?.type === 'SW_NATIVE_SYNC_REQUEST') {
              console.log('[NativeStorage] SW sync request received');
              const pending = await getOutboxPending();
              // Responder al SW via event.source.postMessage
              if (event.source && 'postMessage' in event.source) {
                (event.source as any).postMessage({
                  type: 'SW_NATIVE_SYNC_RESPONSE',
                  items: pending,
                  timestamp: Date.now()
                });
              }
            }
            
            if (event.data?.type === 'SW_NATIVE_MARK_PROCESSED') {
              const id = event.data.id;
              if (id) {
                console.log('[NativeStorage] Marking item as processed:', id);
                await markOutboxProcessed(String(id));
              }
            }
          });
          console.log('[NativeStorage] SW message listener registered');
        }

        return;
      } catch (err) {
        lastError = err;
        console.warn(`[NativeStorage] Attempt ${attempt}/5 failed:`, err);
        useNative = false;
        db = null;
        // Continuar al siguiente intento
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    console.warn('[NativeStorage] SQLite not available after 5 attempts, using Dexie fallback:', lastError);
    useNative = false;
    db = null;
  })();

  try {
    await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

// ============================================
// HELPERS
// ============================================
export function isNative(): boolean {
  return useNative && db !== null;
}

// ============================================
// OUTBOX - Operaciones pendientes de sync
// ============================================
export async function addToOutbox(item: {
  id?: string;
  type?: string;
  payload?: any;
  createdAt?: string;
  timestamp?: number;
  [key: string]: any;
}): Promise<void> {
  if (!isNative()) throw new Error('SQLite not initialized');
  
  // v412: Generar valores por defecto si faltan (los callers pueden pasar timestamp en vez de createdAt)
  const outboxId = item.id || `native_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  const outboxCreatedAt = item.createdAt || now;
  const outboxType = item.type || 'UNKNOWN';
  const rawPayload = item.payload || item;

  // ─── BUG FIX: File/Blob no son serializables con JSON.stringify ─────────
  // Evitamos pasar File, Blob y otros objetos binarios o ArrayBuffers grandes a JSON.stringify,
  // ya que en Android WebView esto puede congelar el hilo o crashearla app (OOM/Violación de Acceso).
  // Los archivos binarios originales se conservan intactos en Dexie (IndexedDB) para el SyncWorker.
  const sanitizeForSqlite = (val: any): any => {
    if (val === null || val === undefined) return val;
    
    // Si tiene características de File/Blob/ArrayBuffer, lo eliminamos
    if (val instanceof File || val instanceof Blob || val instanceof ArrayBuffer ||
        (val.constructor && (val.constructor.name === 'File' || val.constructor.name === 'Blob' || val.constructor.name === 'ArrayBuffer')) ||
        (typeof val.slice === 'function' && typeof val.size === 'number')) {
      return undefined;
    }
    
    if (Array.isArray(val)) {
      return val.map(item => sanitizeForSqlite(item)).filter(x => x !== undefined);
    }
    
    if (typeof val === 'object') {
      const clean: any = {};
      for (const k in val) {
        if (Object.prototype.hasOwnProperty.call(val, k)) {
          // Omitir explícitamente llaves conocidas por almacenar binarios
          if (k === 'file' || k === 'fileData' || k === 'buffer' || k === 'base64' || k === 'receiptFileData') {
            continue;
          }
          const cleanVal = sanitizeForSqlite(val[k]);
          if (cleanVal !== undefined) {
            clean[k] = cleanVal;
          }
        }
      }
      return clean;
    }
    
    if (typeof val === 'string' && (val.startsWith('data:') || val.length > 50000)) {
      return '';
    }
    
    return val;
  };

  const outboxPayload = sanitizeForSqlite(rawPayload);

  await db.run(
    'INSERT INTO outbox (id, type, payload, createdAt) VALUES (?, ?, ?, ?)',
    [outboxId, outboxType, JSON.stringify(outboxPayload), outboxCreatedAt]
  );

  // FASE 3: Sincronizar con CapacitorKV para Background Runner
  try {
    const { syncOutboxToKV } = await import('./background-service');
    await syncOutboxToKV();
  } catch (e) {
    // Ignorar errores del background runner (no crítico)
  }
}

export async function getOutboxPending(): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.query(
    'SELECT * FROM outbox WHERE processed = 0 ORDER BY createdAt ASC'
  );
  
  return result.values?.map((row: any) => {
    const payload = JSON.parse(row.payload || '{}');
    // v_crash_fix: Exponer projectId y status al nivel root para que
    // useProjectCache los pueda filtrar correctamente tras un crash/reinicio.
    // SQLite guarda projectId dentro del payload pero el filter lo busca en el root.
    const projectId = payload.projectId ?? payload.project_id ?? payload.id ?? null;
    // `processed = 0` → pendiente; mapeamos a 'pending' para consistencia con Dexie.
    const status = row.attempts > 0 ? 'pending' : 'pending'; // siempre pending si processed=0
    return {
      id: row.id,
      type: row.type,
      projectId,            // ← ahora en el root
      status,               // ← consistente con Dexie
      payload,
      timestamp: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      createdAt: row.createdAt,
      attempts: row.attempts || 0,
      syncId: payload.syncId || row.id
    };
  }) || [];
}

export async function markOutboxProcessed(id: string): Promise<void> {
  if (!isNative()) return;
  await db.run('UPDATE outbox SET processed = 1 WHERE id = ? OR id IN (SELECT id FROM outbox WHERE payload LIKE ?)', [id, `%"syncId":"${id}"%`]);
}

export async function removeFromOutbox(id: string): Promise<void> {
  if (!isNative()) return;
  await db.run('DELETE FROM outbox WHERE id = ? OR id IN (SELECT id FROM outbox WHERE payload LIKE ?)', [id, `%"syncId":"${id}"%`]);
}

export async function incrementRetries(id: string): Promise<void> {
  if (!isNative()) return;
  // Add retry count column if not exists
  try {
    await db.execute('ALTER TABLE outbox ADD COLUMN retries INTEGER DEFAULT 0');
  } catch (e) {
    // Column may already exist
  }
  await db.run('UPDATE outbox SET retries = retries + 1 WHERE id = ?', [id]);
}

export async function clearProcessedOutbox(): Promise<void> {
  if (!isNative()) return;
  await db.run('DELETE FROM outbox WHERE processed = 1');
}

// ============================================
// SYNC LOGS - Idempotencia (evita duplicados)
// ============================================
export async function addSyncLog(syncId: string, resultId: string): Promise<void> {
  if (!isNative()) return;
  
  await db.run(
    'INSERT OR IGNORE INTO syncLogs (id, syncId, resultId, createdAt) VALUES (?, ?, ?, ?)',
    [`log_${syncId}`, syncId, resultId, new Date().toISOString()]
  );
}

export async function getSyncLog(syncId: string): Promise<string | null> {
  if (!isNative()) return null;
  
  const result = await db.query(
    'SELECT resultId FROM syncLogs WHERE syncId = ?',
    [syncId]
  );
  
  return result.values?.[0]?.resultId || null;
}

export async function hasSyncLog(syncId: string): Promise<boolean> {
  if (!isNative()) return false;
  
  const result = await db.query(
    'SELECT 1 FROM syncLogs WHERE syncId = ?',
    [syncId]
  );
  
  return (result.values?.length || 0) > 0;
}

// ============================================
// PROJECTS CACHE
// ============================================
export async function cacheProject(project: any): Promise<void> {
  if (!isNative()) return;
  
  await db.run(
    'INSERT OR REPLACE INTO projectsCache (id, data, lastAccessedAt) VALUES (?, ?, ?)',
    [String(project.id), JSON.stringify(project), new Date().toISOString()]
  );
}

export async function getCachedProjects(): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.query(
    'SELECT data FROM projectsCache ORDER BY lastAccessedAt DESC'
  );
  
  return result.values?.map((row: any) => JSON.parse(row.data)) || [];
}

export async function getCachedProject(id: string | number): Promise<any | null> {
  if (!isNative()) return null;
  
  const result = await db.query(
    'SELECT data FROM projectsCache WHERE id = ?',
    [String(id)]
  );
  
  return result.values?.[0] ? JSON.parse(result.values[0].data) : null;
}

export async function clearProjectsCache(): Promise<void> {
  if (!isNative()) return;
  await db.run('DELETE FROM projectsCache');
}

// ============================================
// CHAT CACHE
// ============================================
export async function cacheChatMessages(projectId: number, messages: any[]): Promise<void> {
  if (!isNative()) return;
  
  await db.run(
    'INSERT OR REPLACE INTO chatCache (id, projectId, data, updatedAt) VALUES (?, ?, ?, ?)',
    [`chat_${projectId}`, projectId, JSON.stringify(messages), new Date().toISOString()]
  );
}

export async function getCachedChat(projectId: number): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.query(
    'SELECT data FROM chatCache WHERE projectId = ?',
    [projectId]
  );
  
  return result.values?.[0] ? JSON.parse(result.values[0].data) : [];
}

export async function clearChatCache(): Promise<void> {
  if (!isNative()) return;
  await db.run('DELETE FROM chatCache');
}

// ============================================
// MATERIALS CACHE
// ============================================
export async function cacheMaterials(materials: any[]): Promise<void> {
  if (!isNative()) return;
  
  await db.run('DELETE FROM materialsCache');
  
  for (const mat of materials) {
    await db.run('INSERT INTO materialsCache (id, data, lastAccessedAt) VALUES (?, ?, ?)',
      [String(mat.id), JSON.stringify(mat), new Date().toISOString()]
    );
  }
}

export async function getCachedMaterials(): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.query(
    'SELECT data FROM materialsCache ORDER BY lastAccessedAt DESC'
  );
  
  return result.values?.map((row: any) => JSON.parse(row.data)) || [];
}

export async function searchCachedMaterials(query: string): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.query(
    "SELECT data FROM materialsCache WHERE data LIKE ? ORDER BY lastAccessedAt DESC",
    [`%${query}%`]
  );
  
  return result.values?.map((row: any) => JSON.parse(row.data)) || [];
}

// ============================================
// APPOINTMENTS CACHE
// ============================================
export async function cacheAppointments(userId: number, appointments: any[]): Promise<void> {
  if (!isNative()) return;
  
  // Clear old appointments for this user
  await db.run('DELETE FROM appointmentsCache WHERE userId = ?', [userId]);
  
  for (const appt of appointments) {
    await db.run('INSERT INTO appointmentsCache (id, userId, data, date, lastAccessedAt) VALUES (?, ?, ?, ?, ?)',
      [String(appt.id), userId, JSON.stringify(appt), appt.startTime?.split('T')[0] || '', new Date().toISOString()]
    );
  }
}

export async function getCachedAppointments(userId: number, date?: string): Promise<any[]> {
  if (!isNative()) return [];
  
  let result;
  if (date) {
    result = await db.query('SELECT data FROM appointmentsCache WHERE userId = ? AND date = ? ORDER BY data ASC',
      [userId, date]
    );
  } else {
    result = await db.query('SELECT data FROM appointmentsCache WHERE userId = ? ORDER BY data ASC',
      [userId]
    );
  }
  
  return result.values?.map((row: any) => JSON.parse(row.data)) || [];
}

export async function getCachedTodayAppointments(userId: number): Promise<any[]> {
  if (!isNative()) return [];
  
  const today = new Date().toISOString().split('T')[0];
  return getCachedAppointments(userId, today);
}

// ============================================
// UTILITY
// ============================================
export async function clearAllCache(): Promise<void> {
  if (!isNative()) return;
  
  await db.run('DELETE FROM outbox');
  await db.run('DELETE FROM syncLogs');
  await db.run('DELETE FROM projectsCache');
  await db.run('DELETE FROM chatCache');
  await db.run('DELETE FROM materialsCache');
  await db.run('DELETE FROM appointmentsCache');
  
  console.log('[NativeStorage] All cache cleared');
}

export async function getStorageInfo(): Promise<{ used: number; tables: string[] }> {
  if (!isNative()) {
    return { used: 0, tables: [] };
  }
  
  const outboxCount = (await db.query('SELECT COUNT(*) as c FROM outbox')).values?.[0]?.c || 0;
  const syncLogsCount = (await db.query('SELECT COUNT(*) as c FROM syncLogs')).values?.[0]?.c || 0;
  
  return {
    used: outboxCount + syncLogsCount,
    tables: ['outbox', 'syncLogs', 'projectsCache', 'chatCache', 'materialsCache', 'appointmentsCache']
  };
}

// ============================================
// AUTH CACHE - Sesión para background sync
// ============================================
export async function saveAuthCache(session: { token: string; userId: string; expires?: string }): Promise<void> {
  if (!isNative()) return;
  
  await db.run('DELETE FROM authCache');
  await db.run(
    'INSERT INTO authCache (id, token, userId, expires) VALUES (?, ?, ?, ?)',
    ['session', session.token, session.userId, session.expires || '']
  );
}

export async function getAuthCache(): Promise<{ token: string; userId: string } | null> {
  if (!isNative()) return null;
  
  const result = await db.query('SELECT token, userId FROM authCache WHERE id = ?', ['session']);
  if (!result.values?.length) return null;
  
  return {
    token: result.values[0].token,
    userId: result.values[0].userId
  };
}

export async function clearAuthCache(): Promise<void> {
  if (!isNative()) return;
  await db.run('DELETE FROM authCache');
}