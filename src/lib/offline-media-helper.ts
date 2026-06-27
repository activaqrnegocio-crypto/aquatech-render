import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { blobToBase64 } from './image-optimization';

export async function saveOfflineFileToNativeStorage(blob: Blob, filename: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Not on native platform');
  }

  // Ensure directory exists
  try {
    await Filesystem.mkdir({
      path: 'offline_media',
      directory: Directory.Data,
      recursive: true
    });
  } catch (e) {
    // Already exists or creation failed
  }

  const base64 = await blobToBase64(blob);
  const base64Data = base64.includes(';base64,') ? base64.split(';base64,')[1] : base64;

  const writeResult = await Filesystem.writeFile({
    path: `offline_media/${filename}`,
    data: base64Data,
    directory: Directory.Data
  });

  return writeResult.uri; // returns e.g. file:///data/.../files/offline_media/filename
}

export async function readOfflineFileFromNativeStorage(filePath: string, mimeType: string): Promise<Blob> {
  const cleanPath = filePath.startsWith('file://') ? filePath.replace('file://', '') : filePath;
  const fileResult = await Filesystem.readFile({
    path: cleanPath
  });

  const base64Data = fileResult.data as string;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function deleteOfflineFileFromNativeStorage(filePath: string): Promise<void> {
  try {
    const cleanPath = filePath.startsWith('file://') ? filePath.replace('file://', '') : filePath;
    await Filesystem.deleteFile({
      path: cleanPath
    });
    console.log('[OfflineMediaHelper] Deleted native file:', filePath);
  } catch (e) {
    console.error('[OfflineMediaHelper] Failed to delete native file:', filePath, e);
  }
}
