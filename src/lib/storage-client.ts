/**
 * Client-side helper to upload files directly to Bunny.net Storage.
 * This bypasses Vercel's 4.5MB limit.
 * 
 * v430: Added config caching (5 min TTL) to avoid redundant /api/storage/config calls.
 * v430: Added image compression before upload to reduce bandwidth by ~80%.
 */

export interface UploadResult {
  url: string;
  filename: string;
  mimeType: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
}

// v430: Cache storage config to avoid N+1 requests when uploading multiple files
let _cachedConfig: { storageZone: string; accessKey: string; storageHost: string; pullZoneUrl: string } | null = null;
let _configCachedAt = 0;
const CONFIG_TTL = 5 * 60 * 1000; // 5 minutes

async function getStorageConfig() {
  const now = Date.now();
  if (_cachedConfig && (now - _configCachedAt) < CONFIG_TTL) {
    return _cachedConfig;
  }

  const configResp = await fetch('/api/storage/config');
  if (!configResp.ok) throw new Error('Failed to get storage configuration');
  
  const config = await configResp.json();
  
  if (!config.storageZone || !config.accessKey || !config.storageHost) {
    throw new Error('Storage configuration is incomplete');
  }

  _cachedConfig = config;
  _configCachedAt = now;
  return config;
}

/**
 * v430: Compress image before upload if applicable.
 * Returns the original file unchanged if it's not a compressible image.
 */
async function maybeCompressImage(file: File | Blob, originalName: string): Promise<{ file: File | Blob; name: string; mimeType: string }> {
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  const isImage = file.type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext);
  const isSmallEnough = file.size < 500 * 1024; // Skip compression for files < 500KB
  const isAlreadyWebP = ext === 'webp';
  const isGif = ext === 'gif' || file.type === 'image/gif';
  const isSvg = ext === 'svg' || file.type?.includes('svg');
  
  if (!isImage || isSmallEnough || isAlreadyWebP || isGif || isSvg) {
    return { file, name: originalName, mimeType: file.type || 'application/octet-stream' };
  }

  try {
    const { compressImage } = await import('@/lib/image-optimization');
    const compressed = await compressImage(file, 1920, 1920, 0.82);
    
    // Only use compressed version if it's actually smaller
    if (compressed.size < file.size * 0.9) {
      const newName = originalName.replace(/\.[^.]+$/, '.webp');
      console.log(`[Storage] Compressed ${originalName}: ${(file.size/1024).toFixed(0)}KB → ${(compressed.size/1024).toFixed(0)}KB (${((1 - compressed.size/file.size) * 100).toFixed(0)}% smaller)`);
      return { file: compressed, name: newName, mimeType: 'image/webp' };
    }
  } catch (err) {
    console.warn('[Storage] Image compression failed, using original:', err);
  }
  
  return { file, name: originalName, mimeType: file.type || 'application/octet-stream' };
}

export async function uploadToBunnyClientSide(
  file: File | Blob, 
  originalName: string,
  folder: string = 'aquatech-crm',
  // v440: Resumable upload state — only used for chunked uploads (>50MB videos)
  resumeState?: { uploadId: string; completedChunks: number[] },
  onChunkSuccess?: (chunkIndex: number, uploadId: string, completedChunks: number[]) => Promise<void>
): Promise<UploadResult> {
  // v430: Compress images before upload
  const { file: processedFile, name: processedName, mimeType: processedMime } = await maybeCompressImage(file, originalName);
  
  const { storageZone, accessKey, storageHost, pullZoneUrl } = await getStorageConfig();

  // 2. Prepare path
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const safeName = processedName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `/${storageZone}/${folder}/${timestamp}-${randomSuffix}-${safeName}`;
  const uploadUrl = `https://${storageHost}${path}`;

  // 3. Direct PUT to Bunny.net (or Chunked if resumeState is provided)
  // v440: Resumable chunked upload is ONLY used for synchronization (offline -> online)
  // to ensure reliability. Normal online uploads use direct PUT for maximum speed.
  if (resumeState) {
     console.log(`[Storage] Resumable sync detected for ${processedName} (${(processedFile.size/1024/1024).toFixed(1)}MB), using chunked upload...`);
     const chunkedResult = await uploadInChunks(processedFile, processedName, processedMime, resumeState, onChunkSuccess);
     return {
       url: chunkedResult.url,
       filename: processedName,
       mimeType: processedMime,
       type: getMediaType(processedName, processedMime)
     };
  }


  // v353fix: Send the REAL Content-Type to Bunny.net so the CDN serves files
  // with correct headers. Without this, videos were served as application/octet-stream
  // which prevents browsers from doing Range requests (needed for streaming/seeking).
  const uploadContentType = processedMime || processedFile.type || 'application/octet-stream';
  
  // v442: Generous timeout for mobile connections.
  // Old: max(120s, 4s/MB) → 50MB = 200s = 3.3min (TOO SHORT for 3G/4G!)
  // New: max(180s, 20s/MB) → 50MB = 1000s = 16min (handles slow mobile)
  // On WiFi/4G+ the upload finishes in 1-3min; the timeout is just a safety net.
  const fileSizeMB = Math.ceil(processedFile.size / (1024 * 1024));
  const directUploadTimeoutMs = Math.max(180000, fileSizeMB * 20000);
  const directUploadController = new AbortController();
  const directUploadTimeoutId = setTimeout(() => directUploadController.abort(), directUploadTimeoutMs);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': accessKey,
      'Content-Type': uploadContentType,
    },
    body: processedFile,
    signal: directUploadController.signal,
  });
  clearTimeout(directUploadTimeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Bunny Direct Upload Error:', errorText);
    throw new Error(`Upload to Bunny failed: ${response.statusText}`);
  }

  const type = getMediaType(processedName, processedMime);

  return {
    url: `${pullZoneUrl}/${folder}/${timestamp}-${randomSuffix}-${safeName}`,
    filename: processedName,
    mimeType: processedMime || 'application/octet-stream',
    type
  };
}

/**
 * Determine media type from filename and mime type
 */
function getMediaType(name: string, mimeType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext)) return 'IMAGE';
  if (mimeType?.startsWith('video/') || ['mp4', 'mov', 'webm', '3gp', 'm4v', 'avi'].includes(ext)) return 'VIDEO';
  if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'AUDIO';
  
  return 'DOCUMENT';
}

/**
 * v272: Chunked upload helper for large files (videos, audios)
 * v440: Resumable — accepts a persistent uploadId and onChunkSuccess callback.
 *       Queries the server for already-uploaded chunks and skips them.
 */
export async function uploadInChunks(
  file: File | Blob,
  filename: string,
  mimeType?: string,
  // v440: Resumable upload state
  resumeState?: {
    uploadId: string;          // Persistent across retries
    completedChunks: number[]; // Chunks already on server
  },
  // v440: Called after each chunk succeeds — lets the Worker persist progress to Dexie
  onChunkSuccess?: (chunkIndex: number, uploadId: string, completedChunks: number[]) => Promise<void>
): Promise<{ url: string; uploadId: string; completedChunks: number[] }> {
  // v440: Reduced from 10MB to 5MB — smaller chunks fail faster and resume faster on mobile
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // v440: Reuse uploadId across retries — do NOT generate a new one each time
  const uploadId = resumeState?.uploadId || crypto.randomUUID();

  console.log(`[Storage] Chunked upload for ${filename} (${(file.size/1024/1024).toFixed(1)}MB). ${totalChunks} chunks of 5MB. uploadId=${uploadId.slice(0,8)}`);

  // v440: Build the set of already-completed chunks
  // First check what the caller passed (from Dexie), then verify with the server
  let completedSet = new Set<number>(resumeState?.completedChunks || []);

  if (resumeState?.uploadId && completedSet.size === 0) {
    // Maybe previous run completed some chunks but caller didn't have the state
    try {
      const checkRes = await fetch(`/api/upload/chunk?uploadId=${uploadId}`);
      if (checkRes.ok) {
        const { completedChunks: serverChunks } = await checkRes.json();
        if (Array.isArray(serverChunks) && serverChunks.length > 0) {
          serverChunks.forEach((c: number) => completedSet.add(c));
          console.log(`[Storage] Resume: server already has chunks [${serverChunks.join(',')}], skipping them`);
        }
      }
    } catch { /* non-critical */ }
  }

  for (let i = 0; i < totalChunks; i++) {
    // v440: Skip chunks already on the server from a previous attempt
    if (completedSet.has(i)) {
      console.log(`[Storage] Chunk ${i + 1}/${totalChunks} already on server, skipping ✓`);
      continue;
    }

    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

    // v440: Per-chunk timeout — max(60s, 2s per MB of chunk size).
    // 5MB chunk at 100KB/s = 50s. Give 60s minimum as safety margin.
    const chunkSizeMB = Math.ceil(chunk.size / (1024 * 1024));
    const chunkTimeoutMs = Math.max(60000, chunkSizeMB * 2000);

    let success = false;
    let attempts = 0;

    while (!success && attempts < 3) {
      attempts++;
      const chunkController = new AbortController();
      const chunkTimeoutId = setTimeout(() => chunkController.abort(), chunkTimeoutMs);
      try {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('filename', filename);
        formData.append('mimeType', mimeType || file.type || 'application/octet-stream');

        const res = await fetch('/api/upload/chunk', {
          method: 'POST',
          body: formData,
          priority: 'high',
          signal: chunkController.signal,
        });
        clearTimeout(chunkTimeoutId);

        if (!res.ok) throw new Error(`Status ${res.status}`);

        const data = await res.json();
        success = true;
        completedSet.add(i);

        console.log(`[Storage] Chunk ${i + 1}/${totalChunks} uploaded. (${completedSet.size}/${totalChunks} done)`);

        // v440: Notify caller so they can persist progress to Dexie (resumable state)
        if (onChunkSuccess) {
          await onChunkSuccess(i, uploadId, Array.from(completedSet)).catch(() => {});
        }

        // Last chunk returns the final URL
        if (data.url) {
          console.log(`[Storage] Chunked upload complete! URL: ${data.url}`);
          return { url: data.url, uploadId, completedChunks: Array.from(completedSet) };
        }
      } catch (err) {
        clearTimeout(chunkTimeoutId);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        console.warn(`[Storage] Chunk ${i} attempt ${attempts} failed${isAbort ? ' (timeout)' : ''}:`, err);
        if (attempts >= 3) throw new Error(`Chunk ${i} failed after 3 attempts`);
        // Wait 2s before retry for network recovery
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw new Error('Upload completed but no final URL returned');
}
