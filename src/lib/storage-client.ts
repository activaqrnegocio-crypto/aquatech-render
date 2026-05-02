/**
 * Client-side helper to upload files directly to Bunny.net Storage.
 * This bypasses Vercel's 4.5MB limit.
 */

export interface UploadResult {
  url: string;
  filename: string;
  mimeType: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
}

export async function uploadToBunnyClientSide(
  file: File | Blob, 
  originalName: string,
  folder: string = 'aquatech-crm'
): Promise<UploadResult> {
  // 1. Get secure config from our backend
  const configResp = await fetch('/api/storage/config');
  if (!configResp.ok) throw new Error('Failed to get storage configuration');
  
  const { storageZone, accessKey, storageHost, pullZoneUrl } = await configResp.json();
  
  if (!storageZone || !accessKey || !storageHost) {
    throw new Error('Storage configuration is incomplete');
  }

  // 2. Prepare path
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `/${storageZone}/${folder}/${timestamp}-${randomSuffix}-${safeName}`;
  const uploadUrl = `https://${storageHost}${path}`;

  // 3. Direct PUT to Bunny.net (or Chunked if large)
  if (file.size > 1024 * 1024) {
     console.log('[Storage] File > 1MB, using chunked upload...');
     const chunkedResult = await uploadInChunks(file, originalName);
     // The chunked upload already returns the final URL
     return {
       url: chunkedResult.url,
       filename: originalName,
       mimeType: file.type || 'application/octet-stream',
       type: originalName.match(/\.(mp4|mov|webm)$/i) ? 'VIDEO' : (originalName.match(/\.(mp3|wav|m4a)$/i) ? 'AUDIO' : 'IMAGE')
     };
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': accessKey,
      'Content-Type': 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Bunny Direct Upload Error:', errorText);
    throw new Error(`Upload to Bunny failed: ${response.statusText}`);
  }

  // 4. Determine type for the frontend
  let type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' = 'DOCUMENT';
  let mimeType = file.type;
  
  // Fallback check by extension if mime type is missing
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext)) {
    type = 'IMAGE';
    if (!mimeType) mimeType = ext === 'webp' ? 'image/webp' : `image/${ext}`;
  }
  else if (mimeType.startsWith('video/') || ['mp4', 'mov', 'webm', '3gp', 'm4v', 'avi'].includes(ext)) {
    type = 'VIDEO';
    if (!mimeType) mimeType = `video/${ext}`;
  }
  else if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    type = 'AUDIO';
    if (!mimeType) mimeType = `audio/${ext}`;
  }

  return {
    url: `${pullZoneUrl}/${folder}/${timestamp}-${randomSuffix}-${safeName}`,
    filename: originalName,
    mimeType: mimeType || 'application/octet-stream',
    type
  };
}

/**
 * v272: Chunked upload helper for large files (videos, audios)
 */
export async function uploadInChunks(
  file: File | Blob,
  filename: string
): Promise<{ url: string }> {
  // v278: Increased chunk size to 4MB for better performance on modern networks
  const CHUNK_SIZE = 4 * 1024 * 1024; 
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = crypto.randomUUID();

  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('filename', filename);

    const res = await fetch('/api/upload/chunk', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Chunk ${i} failed with status ${res.status}`);
    }

    const data = await res.json();
    if (data.url) {
      return { url: data.url };
    }
  }

  throw new Error('Upload completed but no final URL returned');
}
