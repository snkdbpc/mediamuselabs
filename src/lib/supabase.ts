import { apiFetch, getDisplayPreviewUrl } from './api';
import {
  CreatorProfile,
  UserPreset,
  UploadedFileItem,
  Cluster,
  SocialPost,
  ScoredClusterMetadata,
  GoogleAccountStatus,
  SavedProjectSummary,
  LoadedProjectData,
  UserSyncResponse,
} from '../types/mediamind';

/**
 * Sync logged-in Google user via the FastAPI backend to Supabase `users` table.
 * Fetches and returns the Supabase user UUID and is_pro membership status.
 */
export async function syncUserWithSupabase(
  account: GoogleAccountStatus
): Promise<UserSyncResponse | null> {
  if (!account.connected || !account.email) {
    return null;
  }

  try {
    const res = await apiFetch('/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        google_id: account.google_id || account.email,
        email: account.email,
        name: account.name || '',
        picture: account.picture || '',
      }),
    });

    if (!res.ok) {
      console.warn('Backend user sync returned status:', res.status);
      return null;
    }

    const data = await res.json();
    if (!data.user_id) return null;

    return {
      userId: data.user_id,
      isPro: Boolean(data.is_pro ?? data.user?.is_pro),
      user: data.user,
    };
  } catch (err) {
    console.error('Backend user sync error:', err);
    return null;
  }
}

/**
 * Persist user's Pro membership tier to Supabase `users` table.
 */
export async function updateUserProStatus(
  userId: string,
  isPro: boolean
): Promise<boolean> {
  if (!userId) return false;

  try {
    const res = await apiFetch(`/users/${encodeURIComponent(userId)}/pro`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pro: isPro }),
    });

    if (!res.ok) {
      console.warn('Backend update user pro status returned status:', res.status);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to update user pro status in Supabase:', err);
    return false;
  }
}

/**
 * Fetch user's Pro membership tier directly from Supabase `users` table.
 */
export async function fetchUserProStatus(userId: string): Promise<boolean | null> {
  if (!userId) return null;

  try {
    const res = await apiFetch(`/users/${encodeURIComponent(userId)}/pro`, {
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();
    return Boolean(data.is_pro);
  } catch (err) {
    console.error('Failed to fetch user pro status from Supabase:', err);
    return null;
  }
}

/**
 * Fetch all saved presets for a user via the FastAPI backend.
 */
export async function fetchUserPresets(userId: string): Promise<UserPreset[]> {
  if (!userId) {
    return [];
  }

  try {
    const res = await apiFetch(`/users/${encodeURIComponent(userId)}/presets`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return (data.presets || []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      user_type: p.user_type || 'Individual',
      professional: Boolean(p.professional),
      publishing_preference: p.publishing_preference || {},
      target_audience: p.target_audience || '',
      target_age_groups: Array.isArray(p.target_age_groups) ? p.target_age_groups : [],
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
  } catch (err) {
    console.error('Backend fetch presets error:', err);
    return [];
  }
}

/**
 * Save or update a preset via the FastAPI backend.
 */
export async function saveUserPreset(
  userId: string,
  preset: UserPreset
): Promise<UserPreset | null> {
  if (!userId) {
    return null;
  }

  try {
    const res = await apiFetch(`/users/${encodeURIComponent(userId)}/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: preset.id,
        name: preset.name || 'My Preset',
        user_type: preset.user_type || 'Individual',
        professional: Boolean(preset.professional),
        publishing_preference: preset.publishing_preference || {},
        target_audience: preset.target_audience || '',
        target_age_groups: preset.target_age_groups || [],
      }),
    });

    if (!res.ok) {
      console.error('Backend save preset returned status:', res.status);
      return null;
    }

    const data = await res.json();
    return data.preset || null;
  } catch (err) {
    console.error('Backend save preset error:', err);
    return null;
  }
}

export interface SaveProjectPayload {
  userId: string;
  name: string;
  description?: string;
  status?: string;
  creatorProfile: CreatorProfile;
  files: UploadedFileItem[];
  clusters: Cluster[];
  posts?: Record<string, SocialPost>;
  scoredMetadata?: Record<string, ScoredClusterMetadata>;
}

/**
 * Save a finalized project via the FastAPI backend.
 */
export async function saveProjectToSupabase(
  payload: SaveProjectPayload
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  if (!payload.userId) {
    return { success: false, error: 'User must be signed in with Google to save project' };
  }

  try {
    const res = await apiFetch('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: payload.userId,
        name: payload.name || 'Untitled Visual Project',
        description: payload.description || '',
        status: payload.status || 'finalized',
        creator_profile: payload.creatorProfile,
        files: payload.files.map((f, idx) => ({
          name: f.name,
          originalName: f.originalName || f.name,
          size: f.size,
          originalSize: f.originalSize || f.size,
          r2Url: f.r2Url,
          previewUrl: f.previewUrl,
          included: f.included,
          mime_type: f.file?.type || 'image/jpeg',
          exif: f.exif || {},
          sort_order: idx,
        })),
        clusters: payload.clusters,
        posts: payload.posts || {},
        scored_metadata: payload.scoredMetadata || {},
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.detail || data.error || 'Failed to save project' };
    }

    return { success: true, projectId: data.project_id };
  } catch (err: any) {
    console.error('Backend save project error:', err);
    return { success: false, error: err.message || 'Unknown error saving project' };
  }
}

/**
 * Fetch all saved projects for a user via the FastAPI backend.
 */
export async function fetchUserProjects(userId: string): Promise<SavedProjectSummary[]> {
  if (!userId) {
    return [];
  }

  try {
    const res = await apiFetch(`/users/${encodeURIComponent(userId)}/projects`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return (data.projects || []).map((proj: any) => ({
      id: proj.id,
      user_id: proj.user_id,
      name: proj.name,
      description: proj.description,
      status: proj.status,
      created_at: proj.created_at,
      updated_at: proj.updated_at,
      media_count: proj.media_count || 0,
      clusters_count: proj.clusters_count || 0,
    }));
  } catch (err) {
    console.error('Backend fetch projects error:', err);
    return [];
  }
}

/**
 * Load a full saved project by ID via the FastAPI backend.
 */
export async function loadProjectFromSupabase(
  projectId: string
): Promise<LoadedProjectData | null> {
  if (!projectId) {
    return null;
  }

  try {
    const res = await apiFetch(`/projects/${encodeURIComponent(projectId)}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('Backend load project returned status:', res.status);
      return null;
    }

    const data = await res.json();
    const loaded = data.projectData;
    if (!loaded) return null;

    // Convert media rows to UploadedFileItem with browser-safe preview URLs
    const reconstructedFiles: UploadedFileItem[] = (loaded.media || []).map((m: any, idx: number) => {
      const rawUrl = m.previewUrl || m.r2Url || '';
      const safePreview = getDisplayPreviewUrl(rawUrl, m.originalName || m.name);

      return {
        id: m.id || `media_${Date.now()}_${idx}`,
        name: m.name,
        originalName: m.originalName || m.name,
        size: Number(m.size) || 0,
        originalSize: Number(m.originalSize || m.size) || 0,
        previewUrl: safePreview,
        r2Url: m.r2Url || undefined,
        r2Status: 'success',
        included: m.included !== false,
        exif: m.exif || {},
        file: new File([], m.name, { type: 'image/jpeg' }),
      };
    });

    return {
      project: loaded.project,
      preset: loaded.preset,
      media: reconstructedFiles,
      clusters: loaded.clusters || [],
      posts: loaded.posts || {},
      scoredMetadata: loaded.scoredMetadata || {},
      albumDescription: loaded.albumDescription || loaded.project?.description || '',
    };
  } catch (err) {
    console.error('Backend load project error:', err);
    return null;
  }
}

/**
 * Delete a saved project via the FastAPI backend.
 */
export async function deleteProjectFromSupabase(projectId: string): Promise<boolean> {
  if (!projectId) {
    return false;
  }

  try {
    const res = await apiFetch(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.error('Backend delete project error:', err);
    return false;
  }
}
