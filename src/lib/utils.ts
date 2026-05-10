import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseISO, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates dynamic status based on expiry date
 */
export function getDynamicStatus(expiryDate: string, interval: number = 30): 'Safe' | 'Expiring Soon' | 'Expired' {
  if (!expiryDate) return 'Safe';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseISO(expiryDate);
  const daysUntil = differenceInDays(expiry, today);

  if (daysUntil < 0) return 'Expired';
  if (daysUntil <= interval) return 'Expiring Soon';
  return 'Safe';
}

/**
 * Compresses an image file or data-URL by resizing and reducing quality.
 * Handles both File objects and base64/dataURL strings safely.
 * Uses aggressive compression (quality=0.45, maxWidth=900) to ensure
 * the Firestore inline fallback (800KB limit) is rarely triggered.
 */
export const compressImage = async (
  file: File | string,
  maxWidth = 900,
  quality = 0.45
): Promise<{ blob: Blob; base64: string }> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Compression timed out after 15s')), 15000);

    let objectUrl: string | null = null;

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }

        // Guard against zero dimensions
        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timeout);
          cleanup();
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          clearTimeout(timeout);
          cleanup();
          if (!blob) {
            reject(new Error('Failed to create compressed blob'));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            if (!base64) {
              reject(new Error('Failed to read compressed blob as base64'));
              return;
            }
            resolve({ blob, base64 });
          };
          reader.onerror = () => {
            reject(new Error('FileReader failed while reading compressed blob'));
          };
          reader.readAsDataURL(blob);
        }, 'image/jpeg', quality);

      } catch (err: any) {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(`Canvas draw failed: ${err.message}`));
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error('Failed to load image for compression. The file may be corrupted or unsupported.'));
    };

    // Set src AFTER binding onload/onerror
    if (typeof file === 'string') {
      // Already a data URL or object URL — use directly
      img.src = file;
    } else {
      objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
    }
  });
};
