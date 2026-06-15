// Shared API types mirroring the backend Pydantic schemas.

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "admin";
export type CollectionType = "user" | "album" | "tag" | "shared";
export type StreamingService =
  | "spotify"
  | "tidal"
  | "qobuz"
  | "deezer"
  | "amazon_music"
  | "youtube_music";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  created_at: string;
}

export interface Library {
  id: number;
  owner_id: number;
  name: string;
  description: string | null;
  last_scan: string | null;
  track_count: number;
  created_at: string;
}

export interface LibraryStats {
  library_id: number;
  track_count: number;
  variant_count: number;
  total_size_bytes: number;
  total_duration_seconds: number;
  by_codec: Record<string, number>;
  by_tier: Record<string, number>;
}

export interface VariantSummary {
  id: number;
  track_id: number;
  library_id: number;
  library_name: string | null;
  codec: string | null;
  container: string | null;
  bitrate: number | null;
  bit_depth: number | null;
  sample_rate: number | null;
  channels: number | null;
  duration: number | null;
  file_size: number | null;
  format_label: string;
  quality_tier: string;
  lossless: boolean;
}

export interface StreamingLink {
  id: number;
  track_id: number;
  service: StreamingService;
  url: string;
}

export interface Track {
  id: number;
  artist: string;
  title: string;
  normalized_artist: string;
  normalized_title: string;
  manual: boolean;
  created_at: string;
}

export interface TrackDetail extends Track {
  variants: VariantSummary[];
  streaming_links: StreamingLink[];
  library_ids: number[];
}

export interface Collection {
  id: number;
  owner_id: number;
  name: string;
  type: CollectionType;
  created_at: string;
}

export interface CollectionDetail extends Collection {
  item_count: number;
  tracks: Track[];
}

export interface Share {
  id: number;
  collection_id: number;
  owner_id: number;
  token: string;
  shared_with_user_id: number | null;
  permission: string;
  created_at: string;
}

export interface SharedCollectionView {
  share_token: string;
  owner_username: string;
  collection: CollectionDetail;
}

export interface StreamingLinkSuggestion {
  service: StreamingService;
  url: string;
  source_track_id: number;
  source_artist: string;
  source_title: string;
}

export interface PublicConfig {
  google_oauth_enabled: boolean;
  supported_formats: string[];
  streaming_services: StreamingService[];
}

// Scanner output uploaded to the backend (metadata only).
export interface ScannedFile {
  title: string;
  artist: string;
  file_path: string;
  album?: string | null;
  year?: number | null;
  genre?: string | null;
  track_number?: number | null;
  disc_number?: number | null;
  duration?: number | null;
  codec?: string | null;
  container?: string | null;
  bitrate?: number | null;
  bit_depth?: number | null;
  sample_rate?: number | null;
  channels?: number | null;
  file_size?: number | null;
  composer?: string | null;
  publisher?: string | null;
  replay_gain?: string | null;
  comments?: string | null;
  raw_metadata: Record<string, unknown>;
}
