import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  BugReport,
  BugReportDetail,
  BugStatus,
  Collection,
  CollectionDetail,
  CollectionType,
  Library,
  LibraryStats,
  PublicConfig,
  ScannedFile,
  Share,
  SharedCollectionView,
  StreamingLink,
  StreamingLinkSuggestion,
  StreamingService,
  Track,
  TrackDetail,
  TrackListItem,
  User,
} from "../types";

// --- Config ---
export const useConfig = () =>
  useQuery({
    queryKey: ["config"],
    queryFn: () => api<PublicConfig>("/config", { auth: false }),
  });

// --- Admin ---
export const useUsers = (pendingOnly = false) =>
  useQuery({
    queryKey: ["users", pendingOnly],
    queryFn: () => api<User[]>(`/admin/users?pending_only=${pendingOnly}`),
  });

export const useSetApproval = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: string }) =>
      api<User>(`/admin/users/${userId}/approval`, {
        method: "PATCH",
        body: { approval_status: status },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

// --- Libraries ---
export const useLibraries = () =>
  useQuery({ queryKey: ["libraries"], queryFn: () => api<Library[]>("/libraries") });

export const useLibrary = (id: number) =>
  useQuery({
    queryKey: ["library", id],
    queryFn: () => api<Library>(`/libraries/${id}`),
    enabled: !!id,
  });

export const useLibraryStats = (id: number) =>
  useQuery({
    queryKey: ["library-stats", id],
    queryFn: () => api<LibraryStats>(`/libraries/${id}/stats`),
    enabled: !!id,
  });

export const useLibraryTracks = (id: number) =>
  useQuery({
    queryKey: ["library-tracks", id],
    queryFn: () => api<TrackDetail[]>(`/libraries/${id}/tracks`),
    enabled: !!id,
  });

export const useCreateLibrary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api<Library>("/libraries", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
};

export const useUpdateLibrary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; description?: string }) =>
      api<Library>(`/libraries/${id}`, { method: "PATCH", body }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["libraries"] });
      qc.invalidateQueries({ queryKey: ["library", v.id] });
    },
  });
};

export const useDeleteLibrary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/libraries/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
};

export const useScanLibrary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      files,
      replace,
    }: {
      id: number;
      files: ScannedFile[];
      replace: boolean;
    }) => api(`/libraries/${id}/scan`, { method: "POST", body: { files, replace } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["libraries"] });
      qc.invalidateQueries({ queryKey: ["library", v.id] });
      qc.invalidateQueries({ queryKey: ["library-tracks", v.id] });
      qc.invalidateQueries({ queryKey: ["library-stats", v.id] });
      qc.invalidateQueries({ queryKey: ["tracks"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
};

// --- Tracks ---
export const useTracks = () =>
  useQuery({
    queryKey: ["tracks"],
    queryFn: () => api<TrackListItem[]>("/tracks?limit=1000"),
  });

export const useTrack = (id: number) =>
  useQuery({
    queryKey: ["track", id],
    queryFn: () => api<TrackDetail>(`/tracks/${id}`),
    enabled: !!id,
  });

export const useTrackComparison = (id: number) =>
  useQuery({
    queryKey: ["track-comparison", id],
    queryFn: () => api<TrackComparison>(`/tracks/${id}/comparison`),
    enabled: !!id,
  });

export interface TrackComparison {
  track: { id: number; artist: string; title: string };
  best_variant_id: number | null;
  variants: (import("../types").VariantSummary & { is_best: boolean })[];
  per_library_best: {
    library_id: number;
    library_name: string | null;
    format_label: string;
    is_overall_best: boolean;
  }[];
}

export const useUpdateTrack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; artist?: string; title?: string }) =>
      api<TrackDetail>(`/tracks/${id}`, { method: "PATCH", body }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["track", v.id] });
      qc.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
};

export const useMergeTrack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, sourceId }: { targetId: number; sourceId: number }) =>
      api<TrackDetail>(`/tracks/${targetId}/merge`, {
        method: "POST",
        body: { source_track_id: sourceId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracks"] });
      qc.invalidateQueries({ queryKey: ["track"] });
    },
  });
};

export const useSplitTrack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      variant_ids,
      new_artist,
      new_title,
    }: {
      id: number;
      variant_ids: number[];
      new_artist: string;
      new_title: string;
    }) =>
      api<TrackDetail>(`/tracks/${id}/split`, {
        method: "POST",
        body: { variant_ids, new_artist, new_title },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracks"] });
      qc.invalidateQueries({ queryKey: ["track"] });
    },
  });
};

// --- Collections ---
export const useCollections = (type?: CollectionType) =>
  useQuery({
    queryKey: ["collections", type ?? "all"],
    queryFn: () => api<Collection[]>(`/collections${type ? `?type=${type}` : ""}`),
  });

export const useCollection = (id: number) =>
  useQuery({
    queryKey: ["collection", id],
    queryFn: () => api<CollectionDetail>(`/collections/${id}`),
    enabled: !!id,
  });

export const useCreateCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api<Collection>("/collections", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections"] }),
  });
};

export const useUpdateCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api<Collection>(`/collections/${id}`, { method: "PATCH", body: { name } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["collection", v.id] });
    },
  });
};

export const useDeleteCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/collections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections"] }),
  });
};

export const useAddTrackToCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, trackId }: { collectionId: number; trackId: number }) =>
      api<CollectionDetail>(`/collections/${collectionId}/tracks`, {
        method: "POST",
        body: { track_id: trackId },
      }),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["collection", v.collectionId] }),
  });
};

export const useRemoveTrackFromCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, trackId }: { collectionId: number; trackId: number }) =>
      api<CollectionDetail>(`/collections/${collectionId}/tracks/${trackId}`, {
        method: "DELETE",
      }),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["collection", v.collectionId] }),
  });
};

// --- Sharing ---
export const useShares = () =>
  useQuery({ queryKey: ["shares"], queryFn: () => api<Share[]>("/shares") });

export const useShareCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      shared_with_username,
    }: {
      collectionId: number;
      shared_with_username?: string;
    }) =>
      api<Share>(`/shares/collections/${collectionId}`, {
        method: "POST",
        body: { shared_with_username: shared_with_username || null },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shares"] }),
  });
};

export const useRevokeShare = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/shares/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shares"] }),
  });
};

export const useSharedView = (token: string) =>
  useQuery({
    queryKey: ["shared-view", token],
    queryFn: () => api<SharedCollectionView>(`/shares/view/${token}`),
    enabled: !!token,
  });

// --- Streaming links ---
export const useStreamingLinks = (trackId: number) =>
  useQuery({
    queryKey: ["streaming-links", trackId],
    queryFn: () => api<StreamingLink[]>(`/tracks/${trackId}/streaming-links`),
    enabled: !!trackId,
  });

export const useLinkSuggestions = (trackId: number) =>
  useQuery({
    queryKey: ["link-suggestions", trackId],
    queryFn: () =>
      api<StreamingLinkSuggestion[]>(`/tracks/${trackId}/streaming-links/suggestions`),
    enabled: !!trackId,
  });

export const useAddStreamingLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      trackId,
      service,
      url,
    }: {
      trackId: number;
      service: StreamingService;
      url: string;
    }) =>
      api<StreamingLink>(`/tracks/${trackId}/streaming-links`, {
        method: "POST",
        body: { service, url },
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["streaming-links", v.trackId] });
      qc.invalidateQueries({ queryKey: ["link-suggestions", v.trackId] });
      qc.invalidateQueries({ queryKey: ["track", v.trackId] });
    },
  });
};

export const useDeleteStreamingLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId }: { linkId: number; trackId: number }) =>
      api<void>(`/streaming-links/${linkId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["streaming-links", v.trackId] });
      qc.invalidateQueries({ queryKey: ["track", v.trackId] });
    },
  });
};

// --- Search & analytics ---
export const useSearch = (q: string, field: string) =>
  useQuery({
    queryKey: ["search", q, field],
    queryFn: () =>
      api<Track[]>(`/search?q=${encodeURIComponent(q)}&field=${field}`),
    enabled: q.trim().length > 0,
  });

export const useMissingTracks = (sourceId: number, targetId: number) =>
  useQuery({
    queryKey: ["missing-tracks", sourceId, targetId],
    queryFn: () =>
      api<{ count: number; tracks: { id: number; artist: string; title: string }[] }>(
        `/analytics/missing-tracks?source_library_id=${sourceId}&target_library_id=${targetId}`
      ),
    enabled: !!sourceId && !!targetId && sourceId !== targetId,
  });

export const useCompareLibraries = (aId: number, bId: number) =>
  useQuery({
    queryKey: ["compare", aId, bId],
    queryFn: () =>
      api<CompareResult>(`/analytics/compare?library_a_id=${aId}&library_b_id=${bId}`),
    enabled: !!aId && !!bId && aId !== bId,
  });

export interface CompareResult {
  library_a: { id: number; name: string };
  library_b: { id: number; name: string };
  only_in_a: { id: number; artist: string; title: string }[];
  only_in_b: { id: number; artist: string; title: string }[];
  in_both_count: number;
}

export interface LibraryMatrix {
  libraries: { id: number; name: string }[];
  rows: {
    track: { id: number; artist: string; title: string };
    present_count: number;
    presence: Record<string, { present: boolean; format_label: string | null }>;
  }[];
  diff_count: number;
  total_tracks: number;
}

export const useLibraryMatrix = () =>
  useQuery({
    queryKey: ["library-matrix"],
    queryFn: () => api<LibraryMatrix>("/analytics/library-matrix"),
  });

export const useMissingVariants = () =>
  useQuery({
    queryKey: ["missing-variants"],
    queryFn: () => api<{ count: number; items: MissingVariantItem[] }>(
      "/analytics/missing-variants"
    ),
  });

export interface MissingVariantItem {
  track: { id: number; artist: string; title: string };
  best_format: string;
  best_library_id: number;
  libraries_below_best: {
    library_id: number;
    library_name: string | null;
    current_format: string;
  }[];
}

export const useDuplicateVariants = () =>
  useQuery({
    queryKey: ["duplicate-variants"],
    queryFn: () => api<{ count: number; items: DuplicateVariantItem[] }>(
      "/analytics/duplicate-variants"
    ),
  });

export interface DuplicateVariantItem {
  track: { id: number; artist: string; title: string };
  library_id: number;
  library_name: string | null;
  count: number;
  variants: { id: number; format: string; file_path: string }[];
}

export const useQualityDistribution = (libraryId?: number) =>
  useQuery({
    queryKey: ["quality-distribution", libraryId ?? "all"],
    queryFn: () =>
      api<{ total_variants: number; by_tier: Record<string, number>; by_codec: Record<string, number> }>(
        `/analytics/quality-distribution${libraryId ? `?library_id=${libraryId}` : ""}`
      ),
  });

// --- Bug reports ---
export const useBugReports = (statusFilter?: BugStatus) =>
  useQuery({
    queryKey: ["bug-reports", statusFilter ?? "all"],
    queryFn: () =>
      api<BugReport[]>(`/bugs${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

export const useBugReport = (id: number) =>
  useQuery({
    queryKey: ["bug-report", id],
    queryFn: () => api<BugReportDetail>(`/bugs/${id}`),
    enabled: !!id,
  });

export const useCreateBugReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; body: string }) =>
      api<BugReportDetail>("/bugs", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bug-reports"] }),
  });
};

export const useAddBugMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, images }: { id: number; body: string; images: File[] }) => {
      const fd = new FormData();
      fd.append("body", body);
      images.forEach((f) => fd.append("images", f));
      return api<BugReportDetail>(`/bugs/${id}/messages`, { method: "POST", formData: fd });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["bug-report", v.id] });
      qc.invalidateQueries({ queryKey: ["bug-reports"] });
    },
  });
};

export const useSetBugStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: BugStatus }) =>
      api<BugReport>(`/bugs/${id}/status`, { method: "POST", body: { status } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["bug-report", v.id] });
      qc.invalidateQueries({ queryKey: ["bug-reports"] });
    },
  });
};

export const useLikeTrack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, liked }: { id: number; liked: boolean }) =>
      api(`/tracks/${id}/like`, { method: liked ? "DELETE" : "POST" }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["tracks"] });
      qc.invalidateQueries({ queryKey: ["track", v.id] });
      qc.invalidateQueries({ queryKey: ["collection"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
};
