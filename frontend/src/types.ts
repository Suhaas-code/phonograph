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
  year: number | null;
  format_label: string;
  quality_tier: string;
  lossless: boolean;
}

export interface StreamingLink {
  id: number;
  track_id: number;
  service: string;
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
  collections: TrackCollectionRef[];
  liked: boolean;
}

export interface TrackLibraryRef {
  id: number;
  name: string;
}

export interface TrackCollectionRef {
  id: number;
  name: string;
  type: CollectionType;
}

export interface TrackListItem {
  id: number;
  title: string;
  artist: string;
  manual: boolean;
  liked: boolean;
  libraries: TrackLibraryRef[];
  collections: TrackCollectionRef[];
  duration: number | null;
  codec: string | null;
  container: string | null;
  bit_depth: number | null;
  sample_rate: number | null;
  bitrate: number | null;
  file_size: number | null;
  year: number | null;
  format_label: string | null;
  quality_tier: string | null;
}

export interface Collection {
  id: number;
  owner_id: number;
  name: string;
  type: CollectionType;
  created_at: string;
  item_count?: number;
}

export interface CollectionDetail extends Collection {
  item_count: number;
  tracks: TrackListItem[];
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
  service: string;
  url: string;
  source_track_id: number;
  source_artist: string;
  source_title: string;
}

export type BugStatus = "open" | "closed";

export interface BugAttachment {
  id: number;
  filename: string;
  content_type: string;
  size: number;
}

export interface BugMessage {
  id: number;
  author_id: number;
  author_username: string;
  body: string;
  created_at: string;
  attachments: BugAttachment[];
}

export interface BugReport {
  id: number;
  owner_id: number;
  owner_username: string;
  title: string;
  status: BugStatus;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface BugReportDetail extends BugReport {
  messages: BugMessage[];
}

export interface PublicConfig {
  google_oauth_enabled: boolean;
  supported_formats: string[];
  streaming_services: StreamingService[];
}

// --- Extensions ---
export type ExtensionStatus = "enabled" | "disabled" | "error";

export interface ManifestPreview {
  name: string;
  version: string;
  author: string;
  api_version: string;
  endpoint_url: string;
  capabilities: string[];
  required_permissions: string[];
  permission_descriptions: Record<string, string>;
}

export interface ExtensionEvent {
  id: number;
  kind: string;
  detail: string | null;
  created_at: string;
}

export interface Extension {
  id: number;
  owner_id: number;
  name: string;
  version: string;
  author: string;
  api_version: string;
  manifest_url: string;
  endpoint_url: string;
  capabilities: string[];
  requested_permissions: string[];
  granted_permissions: string[];
  status: ExtensionStatus;
  needs_reapproval: boolean;
  last_error: string | null;
  last_refresh_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtensionDetail extends Extension {
  events: ExtensionEvent[];
}

export interface RefreshSummary {
  extension_id: number;
  status: ExtensionStatus;
  tracks_sent: number;
  links_written: number;
  tracks_metadata_updated: number;
  message: string;
  last_refresh_at: string | null;
}

export interface SearchAugmentResult {
  label: string;
  sublabel: string | null;
  url: string | null;
}

export interface SearchAugmentSummary {
  extension_id: number;
  results: SearchAugmentResult[];
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
