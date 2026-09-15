import { UploadedFileItem } from '../types/mediamind';
import { apiFetch } from './api';

export const DEFAULT_SCORE_THRESHOLD = 7.0;

/**
 * Uploads a single original uncompressed image to Cloudflare R2.
 * Attempts the Next.js API route first, and automatically falls back
 * to the backend storage endpoint (/api/v1/storage/r2/upload) if running
 * in an environment where the Next.js route is unavailable or unconfigured.
 */
/**
 * Uploads an original uncompressed image to Cloudflare R2.
 * Attempts direct streaming from the browser using a Pre-Signed PUT URL.
 * If direct upload is blocked by bucket CORS policy, automatically falls back
 * to streaming the original uncompressed image through the backend storage endpoint.
 */
export async function uploadOriginalFileToR2(
  file: File,
  albumId = 'default',
  originalName?: string
): Promise<{ success: boolean; url?: string; key?: string; error?: string; skipped?: boolean; size?: number; originalName?: string }> {
  const finalName = originalName || file.name;
  const contentType = file.type || 'image/jpeg';

  try {
    // 1. Request a pre-signed PUT URL from the backend (only sends ~100 bytes of metadata)
    const presignRes = await apiFetch('/storage/r2/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        album_id: albumId,
        filename: finalName,
        content_type: contentType,
      }),
    });

    if (presignRes.ok) {
      const presignData = await presignRes.json();
      if (presignData.skipped) {
        return { success: false, skipped: true, error: presignData.error };
      }
      if (presignData.upload_url && presignData.public_url) {
        // 2. Stream the original file directly to Cloudflare R2 (bypasses backend server completely!)
        try {
          const directPutController = new AbortController();
          const directTimeoutId = setTimeout(() => directPutController.abort(), 20000);
          const directPutRes = await fetch(presignData.upload_url, {
            method: 'PUT',
            headers: {
              'Content-Type': contentType,
            },
            body: file,
            signal: directPutController.signal,
          });
          clearTimeout(directTimeoutId);

          if (directPutRes.ok) {
            return {
              success: true,
              url: presignData.public_url,
              key: presignData.key,
              size: file.size,
              originalName: finalName,
            };
          } else {
            console.warn(`Direct R2 upload returned status ${directPutRes.status}`);
          }
        } catch (directErr: any) {
          console.warn('Direct browser-to-R2 upload failed (check R2 bucket CORS policy):', directErr);
        }
      }
    }
  } catch (err: any) {
    console.warn('Presign request notice:', err);
  }

  // 3. Backend upload fallback: If direct browser-to-R2 upload could not complete (e.g. CORS not configured on R2 bucket),
  // stream the original uncompressed image file via the backend /storage/r2/upload endpoint.
  try {
    const formData = new FormData();
    formData.append('file', file, finalName);
    formData.append('albumId', albumId);
    formData.append('originalName', finalName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const res = await apiFetch('/storage/r2/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return data;
      }
      return { success: false, error: data.error || 'R2 upload failed', skipped: data.skipped };
    }

    const errText = await res.text().catch(() => '');
    return { success: false, error: `R2 upload failed (${res.status}): ${errText}` };
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

  // Filter for active files that do not yet have an R2 URL
  const filesToUpload = activeFiles.filter((f) => !f.r2Url);
  activeFiles.forEach((f) => {
    if (f.r2Url) {
      results[f.id] = f.r2Url;
    }
  });

  if (filesToUpload.length === 0) return results;

  // Upload in parallel with a concurrency pool of 2 to avoid network congestion on tunnel
  const CONCURRENCY = 2;
  const queue = [...filesToUpload];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const fileToUpload = item.originalFile || item.file;
      const fileName = item.originalName || fileToUpload?.name || item.name;
      if (!fileToUpload) {
        completed++;
        continue;
      }
      const res = await uploadOriginalFileToR2(fileToUpload, albumId, fileName);

      if (res.success && res.url) {
        results[item.id] = res.url;
        item.r2Url = res.url;
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

  const workers = Array.from({ length: Math.min(CONCURRENCY, filesToUpload.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Deletes all temporary original images in R2 for an album when a user closes or resets without saving.
 */
export async function deleteR2Album(albumId: string): Promise<boolean> {
  if (!albumId) return false;
  try {
    const res = await apiFetch(`/storage/r2/album/${encodeURIComponent(albumId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to delete temporary R2 album storage:', err);
    return false;
  }
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

