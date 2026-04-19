/**
 * Image optimization utilities for the CRM.
 * Focused on mobile memory efficiency.
 */

/**
 * Compresses an image file using Canvas.
 * Uses URL.createObjectURL instead of FileReader's readAsDataURL for the initial load
 * to avoid large intermediate strings in memory, which often causes "Insufficient Memory" 
 * crashes on mobile devices.
 * 
 * @param file The File or Blob object to compress
 * @param maxWidth Maximum width of the output image
 * @param maxHeight Maximum height of the output image
 * @param quality Quality of the output JPEG (0.0 to 1.0)
 * @returns A Promise that resolves to the compressed image as a Base64 data URL
 */
export async function compressImage(
  file: File | Blob,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.6
): Promise<string> {
  if (typeof window === 'undefined') return '';

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // Clean up the object URL immediately after load
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions proportionally
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

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw and resize
      ctx.drawImage(img, 0, 0, width, height);

      // Export as compressed WebP (better compression than JPEG)
      const dataUrl = canvas.toDataURL('image/webp', quality);
      resolve(dataUrl);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
}
