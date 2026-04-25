/**
 * Client-side helper to upload files directly to Bunny.net Storage.
 * This bypasses Vercel's 4.5MB limit.
 */

export interface UploadResult {
  url: string;
  filename: string;
  mimeType: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
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
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `/${storageZone}/${folder}/${timestamp}-${safeName}`;
  const uploadUrl = `https://${storageHost}${path}`;

  // 3. Direct PUT to Bunny.net
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
  let type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' = 'DOCUMENT';
  let mimeType = file.type;
  
  // Fallback check by extension if mime type is missing
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext)) {
    type = 'IMAGE';
    if (!mimeType) mimeType = ext === 'webp' ? 'image/webp' : `image/${ext}`;
  }
  else if (mimeType.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(ext)) {
    type = 'VIDEO';
    if (!mimeType) mimeType = `video/${ext}`;
  }

  return {
    url: `${pullZoneUrl}/${folder}/${timestamp}-${safeName}`,
    filename: originalName,
    mimeType: mimeType || 'application/octet-stream',
    type
  };
}
