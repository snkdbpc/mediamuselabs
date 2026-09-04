export type AppStep = 'upload' | 'choose' | 'edit' | 'finalize';

export interface CreatorProfile {
  user_type: string;
  name: string;
  profession: string;
  content_type: string;
  language?: string;
  target_audience: string;
  target_age_group: string;
  professional?: boolean;
  is_pro?: boolean;
  publishing_preference?: Record<string, boolean>;
  target_age_groups?: string[];
  preset_id?: string;
  preset_name?: string;
}

export interface UserPreset {
  id?: string;
  user_id?: string;
  name: string;
  user_type: string;
  language?: string;
  professional: boolean;
  is_pro?: boolean;
  publishing_preference: Record<string, boolean>;
  target_audience: string;
  target_age_groups: string[];
  created_at?: string;
  updated_at?: string;
}

export interface AnalyzeProgress {
  progress: number;
  stageText: string;
  stageSubtitle?: string;
  status: 'idle' | 'running' | 'completed' | 'error';
}

export interface ImageDetail {
  description: string;
  tags: string[];
  image_location: string;
}

export interface RepresentativeImage {
  path?: string;
  quality_score?: number;
  image_idx?: number;
  rank?: number;
  caption?: string;
}

export interface Cluster {
  cluster_id: string | number;
  name: string;
  tags: string[];
  all_image_indices: number[];
  representatives?: RepresentativeImage[];
  image_details?: Record<string | number, ImageDetail>;
  location?: string;
  description?: string;
}

export interface SocialPost {
  facebook_post: string;
  instagram_caption: string;
  twitter_post: string;
  hashtags: string[];
  seo_alt_text: string;
}

export interface ScoredClusterMetadata {
  representatives: RepresentativeImage[];
  avg_quality?: number;
}

export interface GoogleAccountStatus {
  connected: boolean;
  name?: string;
  email?: string;
  picture?: string;
  google_id?: string;
  supabase_user_id?: string;
}

export interface SavedProjectSummary {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  media_count: number;
  clusters_count: number;
}

export interface LoadedProjectData {
  project: {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  preset?: UserPreset;
  media: UploadedFileItem[];
  clusters: Cluster[];
  posts: Record<string, SocialPost>;
  scoredMetadata?: Record<string, ScoredClusterMetadata>;
  albumDescription?: string;
}

export interface ExifInfo {
  // Device & Camera
  make?: string;
  model?: string;
  lensModel?: string;
  software?: string;

  // Time & Date
  dateTimeOriginal?: string;
  createDate?: string;
  modifyDate?: string;
  formattedDate?: string;

  // GPS & Location
  latitude?: number;
  longitude?: number;
  altitude?: number;
  formattedCoordinates?: string;
  googleMapsUrl?: string;

  // Camera Settings & Exposure
  iso?: number;
  fNumber?: number;
  exposureTime?: number | string;
  focalLength?: number;
  flash?: string | number;
  whiteBalance?: string | number;

  // Image Dimensions
  imageWidth?: number;
  imageHeight?: number;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomainUrl?: string;
}

export interface UploadedFileItem {
  id: string;
  file: File;
  originalFile?: File;
  compressedFile?: File;
  originalSize?: number;
  previewUrl: string;
  name: string;
  originalName?: string;
  size: number;
  included: boolean;
  exif?: ExifInfo;
  r2Url?: string;
  r2Status?: 'idle' | 'uploading' | 'success' | 'error';
  r2Error?: string;
}

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: 'facebook' | 'instagram';
  platform_user_id?: string;
  username?: string;
  page_id?: string;
  page_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PublishResult {
  success: boolean;
  post_id?: string;
  post_url?: string;
  error?: string;
}

export interface UserSyncResponse {
  userId: string;
  isPro: boolean;
  user?: any;
}

