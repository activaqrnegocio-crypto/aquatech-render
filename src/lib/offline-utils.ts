/**
 * utilidades para el sistema de sincronización offline de Aquatech
 */

// v354: Maximum file size for offline storage (IndexedDB)
// Increased to 300MB per user request. 
const MAX_OFFLINE_FILE_SIZE = 300 * 1024 * 1024; // 300MB

// v353: Threshold for base64 vs binary storage
// Files under this size use base64 (simple, preview-friendly).
// Files over this size use the raw File object (structured clone in IndexedDB).
const BASE64_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * Prepara un archivo para guardarse en IndexedDB de la forma más eficiente.
 * 
 * v353: Rewritten for 500MB+ file support.
 * - Files < 10MB → base64 (simple, works everywhere)
 * - Files 10MB-200MB → Raw File object via structured clone (zero overhead)
 * - Files > 200MB → REJECTED (too large for IndexedDB on mobile)
 */
export async function prepareFileForOutbox(file: File): Promise<{
  data: string | ArrayBuffer | File;
  storageType: 'base64' | 'arraybuffer' | 'file';
  filename: string;
  mimeType: string;
  size: number;
}> {
  // v353: Reject files that are too large for IndexedDB
  if (file.size > MAX_OFFLINE_FILE_SIZE) {
    throw new Error(
      `ARCHIVO_MUY_GRANDE: El archivo "${file.name}" (${formatFileSize(file.size)}) es demasiado grande para guardar offline. ` +
      `El límite es ${formatFileSize(MAX_OFFLINE_FILE_SIZE)}. Conéctese a internet para subir archivos de este tamaño.`
    );
  }

  if (file.size <= BASE64_THRESHOLD) {
    // Small files → base64 (simple, preview-friendly)
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
    // v353: Large files → Store the raw File object via structured clone.
    // IndexedDB uses the Structured Clone Algorithm which can clone File objects directly.
    // This avoids the 33% overhead of base64 AND the memory spike of reading the whole file.
    // The GlobalSyncWorker will read the File when it's time to upload.
    return { 
      data: file, 
      storageType: 'file', 
      filename: file.name, 
      mimeType: file.type, 
      size: file.size 
    };
  }
}

/**
 * Genera un SyncId único para asegurar idempotencia en el servidor.
 */
export function generateSyncId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * v353: Format file size for user-friendly display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * v353: Check if a file is too large for offline storage
 */
export function isFileTooLargeForOffline(file: File | Blob): boolean {
  return file.size > MAX_OFFLINE_FILE_SIZE;
}

/**
 * v353: Check if a file should skip base64 conversion (large media files)
 */
export function shouldSkipBase64(file: File | Blob): boolean {
  return file.size > BASE64_THRESHOLD;
}
