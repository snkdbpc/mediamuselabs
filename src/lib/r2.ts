import { UploadedFileItem } from '../types/mediamind';

export const DEFAULT_SCORE_THRESHOLD = 7.0;

/**
 * Uploads a single original uncompressed image to Cloudflare R2 via the Next.js API route.
 * The API route reads R2 bucket credentials directly from environment variables.
 */
export async function uploadOriginalFileToR2(
  file: File,
  albumId = 'default',
  originalName?: string
): Promise<{ success: boolean; url?: string; key?: string; error?: string; skipped?: boolean }> {
  try {
    const formData = new FormData();
    const finalName = originalName || file.name;
    formData.append('file', file, finalName);
    formData.append('albumId', albumId);
    if (finalName) {
      formData.append('originalName', finalName);
    }

    const res = await fetch('/api/r2/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `Upload failed with status ${res.status}` };
    }
    return data;
  } catch (error: any) {
    return { success: false, error: error.message || 'Upload request failed' };
  }
}

/**
 * Uploads all original images in parallel to Cloudflare R2 bucket.
 * Bucket credentials are read from server environment variables.
 */
export async function uploadOriginalFilesBatch(
  files: UploadedFileItem[],
  albumId: string,
  onFileUploaded?: (fileId: string, url: string) => void,
  onProgress?: (completed: number, total: number) => void
): Promise<Record<string, string>> {
  const activeFiles = files.filter((f) => f.included);
  const results: Record<string, string> = {};
  let completed = 0;
  const total = activeFiles.length;

  if (total === 0) return results;

  // Upload in parallel with a concurrency pool of 4
  const CONCURRENCY = 4;
  const queue = [...activeFiles];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const fileToUpload = item.originalFile || item.file;
      const fileName = item.originalName || fileToUpload.name;
      const res = await uploadOriginalFileToR2(fileToUpload, albumId, fileName);

      if (res.success && res.url) {
        results[item.id] = res.url;
        if (onFileUploaded) {
          onFileUploaded(item.id, res.url);
        }
      } else if (res.skipped) {
        // Environment variables not configured; stop further attempts
        break;
      } else {
        console.warn(`R2 upload notice for ${item.name}:`, res.error);
      }

      completed++;
      if (onProgress) {
        onProgress(completed, total);
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Converts a raw score to an absolute score on a 1.0 - 10.0 scale.
 */
export function toAbsoluteScore(score?: number): number {
  if (score === undefined || score === null || isNaN(score)) return 7.5;
  if (score > 1.0) {
    return Math.min(10.0, Math.max(1.0, parseFloat(score.toFixed(1))));
  }
  return Math.min(10.0, Math.max(1.0, parseFloat((score * 10).toFixed(1))));
}
