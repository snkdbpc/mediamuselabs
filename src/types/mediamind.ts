export type AppStep = 'upload' | 'choose' | 'edit' | 'finalize';

export interface CreatorProfile {
  user_type: string;
  name: string;
  profession: string;
  content_type: string;
  target_audience: string;
  target_age_group: string;
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
}

export interface UploadedFileItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  included: boolean;
}
