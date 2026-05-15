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
  folder: string = 'aquatech-crm'
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

  // 3. Direct PUT to Bunny.net (or Chunked if > 50MB)
  if (processedFile.size > 50 * 1024 * 1024) {
     console.log('[Storage] File > 50MB, using chunked upload...');
     const chunkedResult = await uploadInChunks(processedFile, processedName, processedMime);
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
  
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': accessKey,
      'Content-Type': uploadContentType,
    },
    body: processedFile,
  });

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
 */
export async function uploadInChunks(
  file: File | Blob,
  filename: string,
  mimeType?: string
): Promise<{ url: string }> {
  // v355: Increased chunk size to 10MB for significantly faster uploads on 4G/5G
  const CHUNK_SIZE = 10 * 1024 * 1024; 
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = crypto.randomUUID();

  console.log(`[Storage] Starting chunked upload for ${filename} (${(file.size/1024/1024).toFixed(1)}MB). Total chunks: ${totalChunks}`);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    
    // v355: Retry logic for each chunk (up to 3 times)
    let success = false;
    let attempts = 0;

    while (!success && attempts < 3) {
      attempts++;
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
          priority: 'high' // v355: Priority for network
        });

        if (!res.ok) throw new Error(`Status ${res.status}`);

        const data = await res.json();
        success = true;
        
        console.log(`[Storage] Chunk ${i + 1}/${totalChunks} uploaded successfully.`);
        
        if (data.url) {
          console.log(`[Storage] Upload complete! URL: ${data.url}`);
          return { url: data.url };
        }
      } catch (err) {
        console.warn(`[Storage] Chunk ${i} attempt ${attempts} failed:`, err);
        if (attempts >= 3) throw new Error(`Chunk ${i} failed after 3 attempts`);
        // Wait 1s before retry
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  throw new Error('Upload completed but no final URL returned');
}
