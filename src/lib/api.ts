import {
  Cluster,
  CreatorProfile,
  GoogleAccountStatus,
  RepresentativeImage,
  ScoredClusterMetadata,
  SocialPost,
} from '../types/mediamind';

const REMOTE_API_URL =
  process.env.NEXT_PUBLIC_MEDIAMUSELABS_API_URL ||
  process.env.NEXT_PUBLIC_MEDIAMIND_API_URL ||
  'https://api.mediamuselabs.com';
const API_BASE_URL = typeof window !== 'undefined' ? '' : REMOTE_API_URL;
const API_PREFIX = '/api/v1';

/**
 * Fetch wrapper that sends requests through Next.js proxy route,
 * and automatically falls back to direct remote API URL if proxy drops connection (e.g. socket hangup).
 */
async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const primaryUrl = `${API_BASE_URL}${API_PREFIX}${endpoint}`;
  try {
    const res = await fetch(primaryUrl, options);
    return res;
  } catch (err: any) {
    if (typeof window !== 'undefined' && API_BASE_URL !== REMOTE_API_URL) {
      const fallbackUrl = `${REMOTE_API_URL}${API_PREFIX}${endpoint}`;
      console.warn(`Proxy request to ${primaryUrl} failed (${err.message || err}); trying direct fallback to ${fallbackUrl}...`);
      return await fetch(fallbackUrl, options);
    }
    throw err;
  }
}

export async function getGoogleStatus(connectionId: string): Promise<GoogleAccountStatus> {
  try {
    const res = await apiFetch(
      `/social-accounts/google/status?connection_id=${encodeURIComponent(connectionId)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { connected: false };
    return await res.json();
  } catch (error) {
    console.warn('Backend status check failed:', error);
    return { connected: false };
  }
}

export function getGoogleLoginUrl(connectionId: string): string {
  return `${REMOTE_API_URL}/auth/google?connection_id=${encodeURIComponent(connectionId)}`;
}

export async function getFacebookLoginUrl(connectionId: string): Promise<string | null> {
  try {
    const res = await apiFetch('/social-accounts/facebook/sdk-login/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection_id: connectionId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.login_url;
  } catch (error) {
    console.warn('Unable to get Facebook login URL:', error);
    return null;
  }
}

export async function uploadAlbum(files: File[], connectionId: string): Promise<{ album_id: string }> {
  const formData = new FormData();
  formData.append('connection_id', connectionId);
  files.forEach((file) => {
    formData.append('files', file);
  });

  try {
    const res = await apiFetch('/albums/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      let message = errJson.detail || `Upload failed with status ${res.status}`;
      if (res.status === 401) {
        message = 'Please sign in with a Google account before uploading images.';
      }
      console.error('API Upload error:', res.status, message);
      throw new Error(message);
    }

    return await res.json();
  } catch (error: any) {
    // If backend returns 401 (not signed in), propagate error to UI so user can sign in
    if (error.message && error.message.includes('Google account')) {
      throw error;
    }
    // If backend returns server error 500, log and throw clear error
    console.error('Upload album failed:', error);
    throw error;
  }
}

export async function createClusters(
  albumId: string,
  filenames: string[],
  imageIndexMap: Record<string, number>,
  albumDescription: string
): Promise<{ clusters: Cluster[] }> {
  const res = await apiFetch(`/albums/${albumId}/clusters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filenames,
      image_index_by_filename: imageIndexMap,
      embedding_model: 'SigLIP',
      caption_model: 'Florence-2',
      album_description: albumDescription,
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const message = errJson.detail || `Clustering failed with status ${res.status}`;
    console.error('API Clustering error:', message);
    throw new Error(message);
  }

  return await res.json();
}

export async function streamSocialPosts(
  albumId: string,
  clusters: Cluster[],
  creatorProfile: CreatorProfile,
  onPost: (clusterId: string, post: SocialPost, completed: number, total: number) => void,
  onError?: (clusterId: string, message: string) => void
): Promise<Record<string, SocialPost>> {
  const result: Record<string, SocialPost> = {};

  const res = await apiFetch('/social-posts/generate/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      album_id: albumId,
      clusters,
      creator_profile: creatorProfile,
      max_workers: Math.min(clusters.length, 5),
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`SSE stream connection failed with status ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  let currentDataLines: string[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '');
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentDataLines.push(line.slice(6));
      } else if (line.trim() === '') {
        if (currentDataLines.length > 0) {
          const jsonStr = currentDataLines.join('\n');
          try {
            const data = JSON.parse(jsonStr);
            if (currentEvent === 'post') {
              const cId = String(data.cluster_id);
              result[cId] = data.post;
              onPost(cId, data.post, data.completed, data.total);
            } else if (currentEvent === 'error' && onError) {
              onError(String(data.cluster_id), data.message);
            }
          } catch (e) {
            console.error('Failed to parse SSE JSON:', e, jsonStr);
          }
        }
        currentEvent = 'message';
        currentDataLines = [];
      }
    }
  }

  // Handle any remaining data after stream completion
  if (currentDataLines.length > 0) {
    const jsonStr = currentDataLines.join('\n');
    try {
      const data = JSON.parse(jsonStr);
      if (currentEvent === 'post') {
        const cId = String(data.cluster_id);
        result[cId] = data.post;
        onPost(cId, data.post, data.completed, data.total);
      }
    } catch (e) {
      console.error('Failed to parse trailing SSE JSON:', e, jsonStr);
    }
  }

  return result;
}

export async function scoreClusterImages(
  albumId: string,
  clusters: Cluster[],
  n: number
): Promise<{ scored_clusters: Record<string, ScoredClusterMetadata> }> {
  const res = await apiFetch(`/albums/${albumId}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clusters, n }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.detail || `Scoring failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Compresses and converts an image (including HEIC/HEIF, PNG, WebP, JPEG) to JPEG format
 * with max resolution 1024px and 80% quality.
 */
export async function compressImageToJpeg(
  file: File,
  maxDimension = 1024,
  quality = 0.8
): Promise<File> {
  const nameWithoutExt = file.name.includes('.')
    ? file.name.substring(0, file.name.lastIndexOf('.'))
    : file.name;
  const newFileName = `${nameWithoutExt}.jpg`;

  let sourceBlob: Blob = file;
  const isHeic =
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif';

  // Decode HEIC/HEIF in browser using heic2any
  if (isHeic && typeof window !== 'undefined') {
    try {
      const heic2anyModule = await import('heic2any');
      const heic2any = heic2anyModule.default || heic2anyModule;
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: quality,
      });
      sourceBlob = Array.isArray(converted) ? converted[0] : converted;
    } catch (heicErr) {
      console.warn(`heic2any conversion for ${file.name} failed:`, heicErr);
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(sourceBlob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const fallbackFile = new File([sourceBlob], newFileName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve(fallbackFile);
        return;
      }

      // Draw white background behind transparent image formats (like PNG)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            const fallbackFile = new File([sourceBlob], newFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(fallbackFile);
            return;
          }
          const compressedFile = new File([blob], newFileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      console.warn(`Unable to convert ${file.name} to JPEG via canvas:`, err);
      const fallbackFile = new File([sourceBlob], newFileName, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      resolve(fallbackFile);
    };

    img.src = objectUrl;
  });
}

