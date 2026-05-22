/**
 * Image optimization utility for CRM Aquatech.
 * Handles resizing, compression, and HEIC to JPEG conversion.
 * 
 * Returns a Blob (more memory efficient than Base64).
 */

export async function compressImage(
  file: File | Blob, 
  maxWidth = 1200, 
  maxHeight = 1200, 
  quality = 0.8
): Promise<Blob> {
  // 1. Handle HEIC conversion if necessary
  let sourceBlob = file;
  const fileName = (file as File).name || 'image.jpg';
  const isHeic = fileName.toLowerCase().endsWith('.heic') || file.type === 'image/heic' || file.type === 'image/heif';

  if (isHeic) {
    try {
      const heic2any = await loadHeic2Any();
      if (heic2any) {
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: quality
        });
        sourceBlob = Array.isArray(converted) ? converted[0] : converted;
      }
    } catch (err) {
      console.error('HEIC conversion failed, falling back to original:', err);
    }
  }

  // 2. Process image with Canvas
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(sourceBlob);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          'image/webp',
          quality
        );
      };

      img.onerror = (err) => {
        console.error('Image load error (possibly HEIC decoder missing):', err);
        // If it fails to load, just return the original blob as a last resort
        resolve(sourceBlob);
      };
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Utility to load heic2any from CDN on demand
 */
async function loadHeic2Any() {
  if (typeof window === 'undefined') return null;
  if ((window as any).heic2any) return (window as any).heic2any;
  
  return new Promise<any>((resolve, reject) => {
    // Check if already being loaded
    const existingScript = document.querySelector('script[src*="heic2any"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).heic2any) {
          clearInterval(checkInterval);
          resolve((window as any).heic2any);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
    script.async = true;
    script.onload = () => {
      console.log('heic2any loaded successfully');
      resolve((window as any).heic2any);
    };
    script.onerror = (err) => {
      console.error('Failed to load heic2any from CDN', err);
      reject(err);
    };
    document.head.appendChild(script);
  });
}

/**
 * Helper to convert Blob to Base64 (only if strictly necessary for legacy APIs)
 */
/**
 * Check if a file should go through image compression.
 * Returns true for standard image types AND HEIC/HEIF (even when MIME is empty).
 */
export function isCompressibleImage(file: File): boolean {
  if (file.type.startsWith('image/') && !file.type.includes('gif') && !file.type.includes('svg')) return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
