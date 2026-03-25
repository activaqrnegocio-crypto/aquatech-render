const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE!
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY!
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOST!
const BUNNY_PULLZONE_URL = process.env.BUNNY_PULLZONE_URL!

export async function uploadToBunny(
  file: Buffer,
  filename: string,
  folder: string = 'aquatech-crm'
): Promise<string> {
  const timestamp = Date.now()
  const path = `/${BUNNY_STORAGE_ZONE}/${folder}/${timestamp}-${filename}`
  
  const response = await fetch(`https://${BUNNY_STORAGE_HOST}${path}`, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(file),
  })

  if (!response.ok) {
    throw new Error(`Bunny upload failed: ${response.statusText}`)
  }

  return `${BUNNY_PULLZONE_URL}/${folder}/${timestamp}-${filename}`
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
