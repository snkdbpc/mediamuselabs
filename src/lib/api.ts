import {
  Cluster,
  CreatorProfile,
  GoogleAccountStatus,
  ScoredClusterMetadata,
  SocialPost,
  SocialAccount,
  PublishResult,
} from '../types/mediamind';
import { preserveExifInJpeg } from './exif';

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
export async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
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
  const returnUrl = typeof window !== 'undefined' ? `&return_url=${encodeURIComponent(window.location.origin)}` : '';
  return `${REMOTE_API_URL}/auth/google?connection_id=${encodeURIComponent(connectionId)}${returnUrl}`;
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

export async function uploadAlbum(
  files: File[],
  connectionId: string,
  isPro?: boolean,
  userId?: string | null
): Promise<{ album_id: string }> {
  const formData = new FormData();
  formData.append('connection_id', connectionId);
  if (isPro) {
    formData.append('is_pro', 'true');
  }
  if (userId) {
    formData.append('user_id', userId);
  }
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
    let detailMsg = '';
    try {
      const errJson = await res.json();
      detailMsg = errJson.detail
        ? (typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail))
        : '';
    } catch {}
    throw new Error(detailMsg || `SSE stream connection failed with status ${res.status}`);
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
        async (blob) => {
          if (!blob) {
            const fallbackFile = new File([sourceBlob], newFileName, {
              type: 'image/jpeg',
              lastModified: file.lastModified || Date.now(),
            });
            resolve(fallbackFile);
            return;
          }
          try {
            // Preserve EXIF and metadata segments from source image
            const finalBlob = await preserveExifInJpeg(file || sourceBlob, blob);
            const compressedFile = new File([finalBlob], newFileName, {
              type: 'image/jpeg',
              lastModified: file.lastModified || Date.now(),
            });
            resolve(compressedFile);
          } catch (exifErr) {
            console.warn(`Failed to attach EXIF for ${file.name}:`, exifErr);
            const compressedFile = new File([blob], newFileName, {
              type: 'image/jpeg',
              lastModified: file.lastModified || Date.now(),
            });
            resolve(compressedFile);
          }
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
        lastModified: file.lastModified || Date.now(),
      });
      resolve(fallbackFile);
    };

    img.src = objectUrl;
  });
}

/**
 * Ensures an image preview URL can be rendered natively in web browsers.
 * For HEIC/HEIF files loaded from Cloudflare R2 / Supabase, routes through the backend
 * preview endpoint so non-Safari browsers (Chrome, Edge, Firefox) can display them seamlessly.
 */
export function getDisplayPreviewUrl(url?: string, filename?: string): string {
  if (!url) return '';
  const lowerUrl = url.toLowerCase();
  const lowerName = (filename || '').toLowerCase();
  const isHeic =
    lowerUrl.includes('.heic') ||
    lowerUrl.includes('.heif') ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif');

  if (isHeic && !url.includes('/media/preview')) {
    return `/api/v1/media/preview?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/**
 * Fetch Meta OAuth login URL configured with App ID 1097971456003405.
 */
export async function getMetaLoginUrl(connectionId: string, userId?: string, platform?: 'facebook' | 'instagram'): Promise<string> {
  const query = new URLSearchParams({ connection_id: connectionId });
  if (userId) query.set('user_id', userId);
  if (platform) query.set('platform', platform);
  const res = await apiFetch(`/social/meta/login-url?${query.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to generate Meta login URL');
  }
  const data = await res.json();
  return data.authorize_url;
}

/**
 * Fetch connected social publishing accounts for the logged-in user.
 */
export async function fetchUserSocialAccounts(userId: string): Promise<SocialAccount[]> {
  if (!userId) return [];
  try {
    const res = await apiFetch(`/users/${encodeURIComponent(userId)}/social-accounts`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.accounts || [];
  } catch (err) {
    console.error('Error fetching social accounts:', err);
    return [];
  }
}

export interface PublishFacebookPayload {
  userId: string;
  projectId: string;
  message: string;
  imageUrl: string;
  pageId?: string;
  generatedContentId?: string;
}

/**
 * Publish directly to user's connected Facebook Page using Meta App 1097971456003405.
 */
export async function publishToFacebook(payload: PublishFacebookPayload): Promise<PublishResult> {
  try {
    const res = await apiFetch('/publish/facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: payload.userId,
        project_id: payload.projectId,
        message: payload.message,
        image_url: payload.imageUrl,
        page_id: payload.pageId,
        generated_content_id: payload.generatedContentId,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || 'Facebook publishing failed' };
    }
    return { success: true, post_id: data.post_id, post_url: data.post_url };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error publishing to Facebook' };
  }
}

export interface PublishInstagramPayload {
  userId: string;
  projectId: string;
  caption: string;
  imageUrl: string;
  igUserId?: string;
  generatedContentId?: string;
}

/**
 * Publish directly to user's connected Instagram Professional/Creator account.
 */
export async function publishToInstagram(payload: PublishInstagramPayload): Promise<PublishResult> {
  try {
    const res = await apiFetch('/publish/instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: payload.userId,
        project_id: payload.projectId,
        caption: payload.caption,
        image_url: payload.imageUrl,
        ig_user_id: payload.igUserId,
        generated_content_id: payload.generatedContentId,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || 'Instagram publishing failed' };
    }
    return { success: true, post_id: data.post_id, post_url: data.post_url };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error publishing to Instagram' };
  }
}


