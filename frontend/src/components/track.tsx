import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLikeTrack } from "../api/hooks";
import { formatBitSample, formatCodec, formatDuration } from "../lib/format";
import type { TrackLibraryRef, TrackListItem } from "../types";

export function LikeButton({
  trackId,
  liked,
  size = "sm",
}: {
  trackId: number;
  liked: boolean;
  size?: "sm" | "md";
}) {
  const like = useLikeTrack();
  return (
    <button
      type="button"
      title={liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
      aria-label={liked ? "Unlike" : "Like"}
      disabled={like.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        like.mutate({ id: trackId, liked });
      }}
      className={`shrink-0 leading-none transition-colors ${
        size === "md" ? "text-2xl" : "text-lg"
      } ${liked ? "text-red-400" : "text-gray-500 hover:text-red-300"}`}
    >
      {liked ? "♥" : "♡"}
    </button>
  );
}

export function LibraryTags({ libraries }: { libraries: TrackLibraryRef[] }) {
  if (libraries.length === 0) return <span className="text-gray-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {libraries.map((l) => (
        <Link key={l.id} to={`/libraries/${l.id}`} className="badge hover:border-accent">
          {l.name}
        </Link>
      ))}
    </div>
  );
}

// Shared 7-column grid template so the header row and each track row line up.
export const TRACK_GRID =
  "sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_64px_84px_128px_auto] sm:items-center sm:gap-3";

export function TrackColumnsHeader() {
  return (
    <div
      className={`hidden border-b border-edge px-4 py-2 text-xs uppercase tracking-wide text-gray-500 ${TRACK_GRID}`}
    >
      <span>Title</span>
      <span>Artist</span>
      <span>Libraries</span>
      <span>Length</span>
      <span>Format</span>
      <span>Bit / Rate</span>
      <span></span>
    </div>
  );
}

// One track row: desktop = aligned columns, mobile = a compact card.
export function TrackRow({ track, action }: { track: TrackListItem; action?: ReactNode }) {
  const codec = formatCodec(track.codec);
  const bitSample = formatBitSample(track.bit_depth, track.sample_rate);
  const length = formatDuration(track.duration);

  return (
    <div className="border-b border-edge/40">
      {/* Desktop columns */}
      <div className={`px-4 py-3 ${TRACK_GRID} hidden`}>
        <Link to={`/tracks/${track.id}`} className="truncate text-accent hover:underline">
          {track.title}
        </Link>
        <span className="truncate text-gray-300">{track.artist}</span>
        <LibraryTags libraries={track.libraries} />
        <span className="text-gray-400">{length === "—" ? "" : length}</span>
        <span className="text-gray-400">{codec}</span>
        <span className="text-gray-400">{bitSample}</span>
        <span className="flex items-center justify-end gap-2">
          {action}
          <LikeButton trackId={track.id} liked={track.liked} />
        </span>
      </div>

      {/* Mobile card */}
      <div className="px-4 py-3 sm:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/tracks/${track.id}`} className="block truncate text-accent hover:underline">
              {track.title}
            </Link>
            <div className="truncate text-xs text-gray-400">{track.artist}</div>
          </div>
          <div className="flex items-center gap-3">
            {action}
            <LikeButton trackId={track.id} liked={track.liked} />
          </div>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-gray-500">
          {codec && <span>{codec}</span>}
          {bitSample && <span>· {bitSample}</span>}
          {length !== "—" && <span>· {length}</span>}
        </div>
        <div className="mt-2">
          <LibraryTags libraries={track.libraries} />
        </div>
      </div>
    </div>
  );
}
