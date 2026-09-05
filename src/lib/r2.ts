import { UploadedFileItem } from '../types/mediamind';
import { apiFetch } from './api';

export const DEFAULT_SCORE_THRESHOLD = 7.0;

/**
 * Uploads a single original uncompressed image to Cloudflare R2.
 * Attempts the Next.js API route first, and automatically falls back
 * to the backend storage endpoint (/api/v1/storage/r2/upload) if running
 * in an environment where the Next.js route is unavailable or unconfigured.
 */
export async function uploadOriginalFileToR2(
  file: File,
  albumId = 'default',
  originalName?: string
): Promise<{ success: boolean; url?: string; key?: string; error?: string; skipped?: boolean }> {
  const finalName = originalName || file.name;

  const makeFormData = () => {
    const fd = new FormData();
    fd.append('file', file, finalName);
    fd.append('albumId', albumId);
    if (finalName) {
      fd.append('originalName', finalName);
    }
    return fd;
  };

  // 1. Try local Next.js API route first (available in local dev and when deployed with env vars)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/r2/upload', {
        method: 'POST',
        body: makeFormData(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          return data;
        }
      }
    } catch {
      // Fall through to backend API
    }
  }

  // 2. Fallback to direct backend storage endpoint
  try {
    const backendRes = await apiFetch('/storage/r2/upload', {
      method: 'POST',
      body: makeFormData(),
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data.success && data.url) {
        return data;
      }
      return { success: false, error: data.error || 'R2 backend upload failed', skipped: data.skipped };
    }

    const errText = await backendRes.text().catch(() => '');
    return { success: false, error: `R2 upload failed (${backendRes.status}): ${errText}` };
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
