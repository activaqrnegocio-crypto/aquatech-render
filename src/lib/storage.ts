// src/lib/storage.ts
// Capa unificada: Android usa SQLite nativo, iOS/browser usa Dexie
import { Capacitor } from '@capacitor/core'
import { db } from './db'
import * as nativeStorage from './native-storage'

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

export async function isSqliteReady(): Promise<boolean> {
  return nativeStorage.isNative()
}

export async function initStorage(): Promise<void> {
  if (isNativePlatform()) {
    await nativeStorage.init()
    console.log('[Storage] Using SQLite (Android)')
  } else {
    console.log('[Storage] Using Dexie (iOS/Browser)')
  }
}

export async function addToOutbox(item: any): Promise<void> {
  // Generate a stable syncId if not already present
  const syncId = item.syncId || item.payload?.syncId || `sync-${item.type || 'UNKNOWN'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const projectId = item.projectId || item.payload?.projectId || 0;

  // Ensure the payload is an object and has both syncId and projectId
  let itemPayload = item.payload || item;
  if (itemPayload && typeof itemPayload === 'object') {
    itemPayload = {
      ...itemPayload,
      syncId,
      projectId
    };
  }

  const normalizedItem = {
    ...item,
    syncId,
    projectId,
    payload: itemPayload
  };

  // ─── APK: Guardar en SQLite (native-storage limpia File/Blob internamente) ──
  if (isNativePlatform() && await isSqliteReady()) {
    try {
      await nativeStorage.addToOutbox(normalizedItem)
      console.log('[Storage] ✅ SQLite outbox guardado:', normalizedItem.type)
    } catch (nativeErr) {
      console.warn('[Storage] SQLite falló:', nativeErr)
    }
  }

  // ─── SIEMPRE guardar en Dexie (IndexedDB) ────────────────────────────────
  // El GlobalSyncWorker lee de Dexie para subir a BunnyCDN.
  // IMPORTANTE: guardamos el payload ORIGINAL con File/Blob intactos —
  // IndexedDB usa structured clone y puede almacenar File objects nativamente.
  // Esto es lo que permite al SW recuperar el archivo y subirlo a Bunny.
  try {
    await db.outbox.add({
      type: normalizedItem.type || 'UNKNOWN',
      projectId: normalizedItem.projectId || 0,
      payload: normalizedItem.payload,   // payload ORIGINAL (con File/Blob)
      timestamp: Date.now(),
      status: 'pending',
      syncId: syncId
    } as any)
    console.log('[Storage] ✅ Dexie outbox guardado:', normalizedItem.type)
  } catch (dexieErr) {
    console.error('[Storage] Dexie falló al guardar en outbox:', dexieErr)
  }
}

export async function getOutboxPending(): Promise<any[]> {
  // Always read from Dexie (IndexedDB) for the UI — File/Blob objects survive here.
  // SQLite is only for the Service Worker (background sync), it strips File/Blob.
  return db.outbox.where('status').equals('pending').toArray() as any
}

export async function markOutboxProcessed(id: string): Promise<void> {
  let resolvedSyncId = id;
  // v_cleanup: Delete native temporary files associated with this outbox item
  try {
    if (isNativePlatform()) {
      let item = await db.outbox.get(Number(id));
      if (!item) {
        const allOutbox = await db.outbox.toArray();
        item = allOutbox.find((x: any) => String(x.id) === String(id) || String(x.syncId) === String(id));
      }
      if (item) {
        if (item.syncId) {
          resolvedSyncId = String(item.syncId);
        }
        const payload = item.payload;
        const { deleteOfflineFileFromNativeStorage } = await import('./offline-media-helper');
        if (payload.media?.localUri) {
          await deleteOfflineFileFromNativeStorage(payload.media.localUri);
        }
        if (payload.localUri) {
          await deleteOfflineFileFromNativeStorage(payload.localUri);
        }
        if (payload.files && Array.isArray(payload.files)) {
          for (const f of payload.files) {
            if (f.localUri) {
              await deleteOfflineFileFromNativeStorage(f.localUri);
            }
          }
        }
        if (payload.specsAudioUrl && (payload.specsAudioUrl.startsWith('file://') || payload.specsAudioUrl.includes('_capacitor_file_'))) {
          const localAudioPath = payload.specsAudioUrl.startsWith('http://localhost/_capacitor_file_') 
            ? payload.specsAudioUrl.replace('http://localhost/_capacitor_file_', 'file://')
            : payload.specsAudioUrl;
          if (localAudioPath.startsWith('file://')) {
            await deleteOfflineFileFromNativeStorage(localAudioPath);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Storage Cleanup] Failed to delete native offline files:', err);
  }

  if (isNativePlatform() && await isSqliteReady()) {
    // APK: Marcar en SQLite nativa
    await nativeStorage.markOutboxProcessed(resolvedSyncId)
    // APK: TAMBIÉN marcar en IndexedDB para que el SW no lo procese de nuevo
    try { await db.outbox.update(Number(id), { status: 'synced' } as any) } catch (e) {}
  } else {
    await db.outbox.update(Number(id), { status: 'synced' } as any)
  }
}

export async function removeFromOutbox(id: string): Promise<void> {
  let resolvedSyncId = id;
  // v_cleanup: Delete native temporary files associated with this outbox item
  try {
    if (isNativePlatform()) {
      let item = await db.outbox.get(Number(id));
      if (!item) {
        const allOutbox = await db.outbox.toArray();
        item = allOutbox.find((x: any) => String(x.id) === String(id) || String(x.syncId) === String(id));
      }
      if (item) {
        if (item.syncId) {
          resolvedSyncId = String(item.syncId);
        }
        const payload = item.payload;
        const { deleteOfflineFileFromNativeStorage } = await import('./offline-media-helper');
        if (payload.media?.localUri) {
          await deleteOfflineFileFromNativeStorage(payload.media.localUri);
        }
        if (payload.localUri) {
          await deleteOfflineFileFromNativeStorage(payload.localUri);
        }
        if (payload.files && Array.isArray(payload.files)) {
          for (const f of payload.files) {
            if (f.localUri) {
              await deleteOfflineFileFromNativeStorage(f.localUri);
            }
          }
        }
        if (payload.specsAudioUrl && (payload.specsAudioUrl.startsWith('file://') || payload.specsAudioUrl.includes('_capacitor_file_'))) {
          const localAudioPath = payload.specsAudioUrl.startsWith('http://localhost/_capacitor_file_') 
            ? payload.specsAudioUrl.replace('http://localhost/_capacitor_file_', 'file://')
            : payload.specsAudioUrl;
          if (localAudioPath.startsWith('file://')) {
            await deleteOfflineFileFromNativeStorage(localAudioPath);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Storage Cleanup] Failed to delete native offline files on remove:', err);
  }

  if (isNativePlatform() && await isSqliteReady()) {
    // APK: Eliminar de SQLite nativa
    await nativeStorage.removeFromOutbox(resolvedSyncId)
    // APK: TAMBIÉN eliminar de IndexedDB para mantener consistencia
    try { await db.outbox.delete(Number(id)) } catch (e) {}
  } else {
    await db.outbox.delete(Number(id))
  }
}

export async function incrementOutboxRetries(id: string): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.incrementRetries(id)
  } else {
    const item = await db.outbox.get(Number(id))
    if (item) {
      await db.outbox.update(Number(id), { attempts: (item.attempts || 0) + 1 } as any)
    }
  }
}

export async function clearProcessedOutbox(): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.clearProcessedOutbox()
    // APK: TAMBIÉN limpiar IndexedDB
    try { await db.outbox.where('status').equals('synced').delete() } catch (e) {}
  } else {
    await db.outbox.where('status').equals('synced').delete()
  }
}

export async function addSyncLog(syncId: string, resultId: string): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.addSyncLog(syncId, resultId)
  }
}

export async function getSyncLog(syncId: string): Promise<string | null> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getSyncLog(syncId)
  }
  return null
}

export async function hasSyncLog(syncId: string): Promise<boolean> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.hasSyncLog(syncId)
  }
  return false
}

export async function getAuthCache(): Promise<{ token: string; userId: string } | null> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getAuthCache()
  }
  return null
}

export async function saveAuthCache(session: { token: string; userId: string; expires?: string }): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.saveAuthCache(session)
  }
}

export async function cacheProject(project: any): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.cacheProject(project)
  } else {
    await db.projectsCache.put({ id: project.id, data: JSON.stringify(project), lastAccessedAt: new Date().toISOString() } as any)
  }
}

export async function getCachedProjects(): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getCachedProjects()
  } else {
    return db.projectsCache.toArray() as any
  }
}

export async function getCachedProject(id: string | number): Promise<any | null> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getCachedProject(id)
  } else {
    const result = await db.projectsCache.get(id)
    return result ? JSON.parse(result.data) : null
  }
}

export async function cacheChatMessages(projectId: number, messages: any[]): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.cacheChatMessages(projectId, messages)
  } else {
    await db.chatCache.put({ id: 'chat-' + projectId, projectId, data: JSON.stringify(messages), updatedAt: new Date().toISOString() } as any)
  }
}

export async function getCachedChat(projectId: number): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getCachedChat(projectId)
  } else {
    const result = await db.chatCache.get('chat-' + projectId)
    return result ? JSON.parse(result.data) : []
  }
}

export async function cacheMaterials(materials: any[]): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.cacheMaterials(materials)
  } else {
    await db.materialsCache.clear()
    const items = materials.map(m => ({ id: m.id, code: m.code || '', name: m.name || '', description: m.description, unit: m.unit, unitPrice: m.unitPrice || 0, category: m.category, stock: m.stock || 0, lastAccessedAt: new Date().toISOString() } as any))
    await db.materialsCache.bulkAdd(items)
  }
}

export async function getCachedMaterials(): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getCachedMaterials()
  } else {
    return db.materialsCache.toArray() as any
  }
}

export async function searchCachedMaterials(query: string): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.searchCachedMaterials(query)
  } else {
    const all = await getCachedMaterials()
    const q = query.toLowerCase()
    return all.filter((m: any) => m.name?.toLowerCase().includes(q) || m.code?.toLowerCase().includes(q))
  }
}

export async function cacheAppointments(userId: number, appointments: any[]): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.cacheAppointments(userId, appointments)
  } else {
    for (const apt of appointments) {
      await db.appointmentsCache.put({ id: apt.id, userId, data: JSON.stringify(apt), date: apt.date || '', lastAccessedAt: new Date().toISOString() } as any)
    }
  }
}

export async function getCachedAppointments(userId: number): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    const all = await nativeStorage.getCachedAppointments ? await nativeStorage.getCachedAppointments(userId) : []
    return all
  } else {
    const results = await db.appointmentsCache.where('userId').equals(userId).toArray()
    return results.map(r => JSON.parse(r.data))
  }
}

export async function getStorageInfo(): Promise<{ mode: string; dbSize: number; outboxCount: number }> {
  const mode = isNativePlatform() ? 'SQLite' : 'Dexie'
  let outboxCount = 0
  try {
    if (isNativePlatform() && await isSqliteReady()) {
      outboxCount = (await nativeStorage.getOutboxPending()).length
    } else {
      outboxCount = await db.outbox.where('status').equals('pending').count()
    }
  } catch (e) { /* ignore */ }
  return { mode, dbSize: 0, outboxCount }
}