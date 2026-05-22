/**
 * utilidades para el sistema de sincronización offline de Aquatech
 * 
 * v445: REVISED STRATEGY — Native IndexedDB Structured Clone.
 * - Modern browsers support structured cloning of File/Blob objects natively.
 * - This is simpler and more reliable than Cache API for most cases.
 * - Aligning with the robust logic used in Project Creation Wizard.
 * - Cache API functions are kept for legacy compatibility and fallback.
 */

const MAX_OFFLINE_FILE_SIZE = 600 * 1024 * 1024; // 600MB
const BASE64_THRESHOLD = 10 * 1024 * 1024; // 10MB
const CACHE_NAME = 'aquatech-offline-media';

/**
 * Prepara un archivo para guardarse offline.
 * 
 * - Files < 10MB → base64 string (stored in IndexedDB directly)
 * - Files 10MB-600MB → Cache API (stored on disk, zero RAM)
 * - Files > 600MB → REJECTED
 */
export async function prepareFileForOutbox(file: File): Promise<{
  data: string;
  storageType: 'base64' | 'cache';
  cacheKey?: string;
  filename: string;
  mimeType: string;
  size: number;
}> {
  if (file.size > MAX_OFFLINE_FILE_SIZE) {
    throw new Error(
      `ARCHIVO_MUY_GRANDE: El archivo "${file.name}" (${formatFileSize(file.size)}) es demasiado grande para guardar offline. ` +
      `El límite es ${formatFileSize(MAX_OFFLINE_FILE_SIZE)}. Conéctese a internet para subir archivos de este tamaño.`
    );
  }

  if (file.size <= BASE64_THRESHOLD) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { 
      data: base64, 
      storageType: 'base64', 
      filename: file.name, 
      mimeType: file.type, 
      size: file.size 
    };
  } else {
    // v444: Large files → Cache API (ZERO RAM overhead)
    // The browser streams the file from disk to the cache without loading into memory.
    const cacheKey = `offline-media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await saveFileToCache(cacheKey, file);
    console.log(`[Offline] Saved ${file.name} (${formatFileSize(file.size)}) to Cache API: ${cacheKey}`);
    return { 
      data: '', // No data in IndexedDB — it's in Cache API
      storageType: 'cache',
      cacheKey,
      filename: file.name, 
      mimeType: file.type, 
      size: file.size 
    };
  }
}

/**
 * v444: Save a File/Blob to Cache API.
 * Zero RAM — the browser streams from the File to disk.
 */
export async function saveFileToCache(key: string, file: File | Blob): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const url = `/${CACHE_NAME}/${key}`;
  // new Response(blob) wraps the blob lazily — no RAM spike
  await cache.put(url, new Response(file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Original-Size': String(file.size),
      'X-Filename': (file as File).name || key
    }
  }));
}

/**
 * v444: Read a File/Blob from Cache API.
 * Returns null if not found (expired or deleted).
 */
export async function getFileFromCache(key: string): Promise<Blob | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const url = `/${CACHE_NAME}/${key}`;
    const response = await cache.match(url);
    if (!response) return null;
    return await response.blob();
  } catch (e) {
    console.warn('[Offline] Failed to read from Cache API:', e);
    return null;
  }
}

/**
 * v444: Delete a file from Cache API after successful upload.
 */
export async function deleteFileFromCache(key: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const url = `/${CACHE_NAME}/${key}`;
    await cache.delete(url);
  } catch (e) {
    // Non-critical — cache will eventually be cleaned up
  }
}

export function generateSyncId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function isFileTooLargeForOffline(file: File | Blob): boolean {
  return file.size > MAX_OFFLINE_FILE_SIZE;
}

export function shouldSkipBase64(file: File | Blob): boolean {
  return file.size > BASE64_THRESHOLD;
}
