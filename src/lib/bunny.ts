const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE!
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY!
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOST!
const BUNNY_PULLZONE_URL = process.env.BUNNY_PULLZONE_URL!

export async function uploadToBunny(
  file: Buffer,
  filename: string,
  folder: string = 'aquatech-crm',
  mimeType?: string
): Promise<string> {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const path = `/${BUNNY_STORAGE_ZONE}/${folder}/${timestamp}-${randomSuffix}-${filename}`
  
  // v353fix: Determine the real Content-Type from the filename extension or provided mimeType.
  // Without this, Bunny CDN serves videos as application/octet-stream which prevents
  // browsers from doing Range requests needed for progressive video playback.
  const contentType = mimeType || inferMimeType(filename);
  
  const response = await fetch(`https://${BUNNY_STORAGE_HOST}${path}`, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY,
      'Content-Type': contentType,
    },
    body: file as any,
  })

  if (!response.ok) {
    throw new Error(`Bunny upload failed: ${response.statusText}`)
  }

  return `${BUNNY_PULLZONE_URL}/${folder}/${timestamp}-${randomSuffix}-${filename}`
}

/** Infer MIME type from filename extension */
function inferMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp',
    'gif': 'image/gif', 'svg': 'image/svg+xml', 'heic': 'image/heic',
    'mp4': 'video/mp4', 'mov': 'video/quicktime', 'webm': 'video/webm', 
    '3gp': 'video/3gpp', 'm4v': 'video/mp4', 'avi': 'video/x-msvideo',
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 
    'm4a': 'audio/mp4', 'aac': 'audio/aac', 'flac': 'audio/flac',
    'pdf': 'application/pdf', 'doc': 'application/msword', 
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export async function deleteFromBunny(fileUrl: string): Promise<void> {
  const urlPath = fileUrl.replace(BUNNY_PULLZONE_URL!, '')
  const path = `/${BUNNY_STORAGE_ZONE}${urlPath}`
  
  await fetch(`https://${BUNNY_STORAGE_HOST}${path}`, {
    method: 'DELETE',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY,
    },
  })
}
