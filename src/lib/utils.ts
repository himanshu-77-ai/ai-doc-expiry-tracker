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
 * Compresses an image file by resizing it and reducing quality.
 * Useful for reducing network payload for AI OCR and Storage.
 */
export const compressImage = async (file: File | string, maxWidth = 1000, quality = 0.5): Promise<{ blob: Blob; base64: string }> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Compression timed out')), 15000);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        clearTimeout(timeout);
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        clearTimeout(timeout);
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            blob,
            base64: (reader.result as string).split(',')[1]
          });
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image'));
    };
    img.src = typeof file === 'string' ? file : URL.createObjectURL(file);
  });
};
