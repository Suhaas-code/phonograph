import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useAddStreamingLink,
  useAddTrackToCollection,
  useCollections,
  useDeleteStreamingLink,
  useLinkSuggestions,
  useMergeTrack,
  useSplitTrack,
  useStreamingLinks,
  useTrack,
  useTrackComparison,
  useTracks,
  useUpdateTrack,
} from "../api/hooks";
import { LikeButton } from "../components/track";
import { PageHeader, Spinner, Empty, ErrorText, QualityBadge } from "../components/ui";
import {
  formatBitSample,
  formatBitrate,
  formatBytes,
  formatCodec,
  formatDuration,
  SERVICE_LABELS,
} from "../lib/format";
import type { StreamingService, TrackDetail } from "../types";

const SERVICES: StreamingService[] = [
  "spotify",
  "tidal",
  "qobuz",
  "deezer",
  "amazon_music",
  "youtube_music",
];

export default function TrackDetailPage() {
  const { id } = useParams();
  const trackId = Number(id);
  const navigate = useNavigate();
  const track = useTrack(trackId);
  const comparison = useTrackComparison(trackId);

  if (track.isLoading) return <Spinner />;
  if (!track.data) return <Empty>Track not found.</Empty>;
  const t = track.data;

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.artist}
        actions={<LikeButton trackId={trackId} liked={t.liked} size="md" />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DetailsCard t={t} />
          <VariantsCard trackId={trackId} />
          <ComparisonCard data={comparison.data} />
        </div>
        <div className="space-y-6">
          <EditCard trackId={trackId} artist={t.artist} title={t.title} />
          <StreamingLinksCard trackId={trackId} />
          <AddToCollectionCard trackId={trackId} />
          <MergeCard trackId={trackId} onMerged={() => navigate(`/tracks/${trackId}`)} />
        </div>
      </div>
    </div>
  );
}

// Uniform metadata summary for the best-quality copy, blank where unknown.
function DetailsCard({ t }: { t: TrackDetail }) {
  const best = t.variants[0];
  const libs = Array.from(
    new Map(t.variants.map((v) => [v.library_id, v.library_name ?? `#${v.library_id}`])).values()
  );
  const cells: [string, string][] = [
    ["Year", best?.year ? String(best.year) : ""],
    ["Length", best?.duration ? formatDuration(best.duration) : ""],
    ["Format", formatCodec(best?.codec)],
    ["Bit / Rate", best ? formatBitSample(best.bit_depth, best.sample_rate) : ""],
    ["Bitrate", best ? formatBitrate(best.bitrate) : ""],
    ["File size", best?.file_size ? formatBytes(best.file_size) : ""],
  ];

  return (
    <div className="card">
      <h2 className="mb-3 font-medium text-white">Details</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {cells.map(([label, value]) => (
          <div key={label}>
            <div className="label">{label}</div>
            <div className="text-sm text-gray-200">{value || " "}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="label">Libraries</div>
          <div className="flex flex-wrap gap-1">
            {libs.length ? (
              libs.map((n, i) => (
                <span key={i} className="badge">
                  {n}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">&nbsp;</span>
            )}
          </div>
        </div>
        <div>
          <div className="label">Collections</div>
          <div className="flex flex-wrap gap-1">
            {t.collections.length ? (
              t.collections.map((c) => (
                <Link key={c.id} to={`/collections/${c.id}`} className="badge hover:border-accent">
                  {c.name}
                </Link>
              ))
            ) : (
              <span className="text-sm text-gray-500">&nbsp;</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VariantsCard({ trackId }: { trackId: number }) {
  const track = useTrack(trackId);
  const split = useSplitTrack();
  const [selected, setSelected] = useState<number[]>([]);
  const [newArtist, setNewArtist] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [splitting, setSplitting] = useState(false);
  const navigate = useNavigate();

  if (!track.data) return null;
  const variants = track.data.variants;

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function doSplit() {
    const result = await split.mutateAsync({
      id: trackId,
      variant_ids: selected,
      new_artist: newArtist || track.data!.artist,
      new_title: newTitle || track.data!.title,
    });
    setSplitting(false);
    setSelected([]);
    navigate(`/tracks/${result.id}`);
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-white">Variants ({variants.length})</h2>
        {variants.length > 1 && !splitting && (
          <button className="btn-ghost" onClick={() => setSplitting(true)}>
            Split…
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-edge text-left text-gray-400">
            <tr>
              {splitting && <th className="p-2"></th>}
              <th className="p-2">Format</th>
              <th className="p-2">Library</th>
              <th className="p-2">Quality</th>
              <th className="p-2">Year</th>
              <th className="p-2">Duration</th>
              <th className="p-2">Size</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => (
              <tr key={v.id} className="border-b border-edge/40">
                {splitting && (
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(v.id)}
                      onChange={() => toggle(v.id)}
                    />
                  </td>
                )}
                <td className="p-2 text-gray-200">
                  {v.format_label}
                  {i === 0 && <span className="badge ml-2 border-accent text-accent">best</span>}
                </td>
                <td className="p-2 text-gray-400">{v.library_name ?? `#${v.library_id}`}</td>
                <td className="p-2">
                  <QualityBadge tier={v.quality_tier} />
                </td>
                <td className="p-2 text-gray-500">{v.year ?? ""}</td>
                <td className="p-2 text-gray-500">{v.duration ? formatDuration(v.duration) : ""}</td>
                <td className="p-2 text-gray-500">{v.file_size ? formatBytes(v.file_size) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {splitting && (
        <div className="mt-4 space-y-3 rounded border border-edge p-3">
          <p className="text-sm text-gray-300">
            Move {selected.length} selected variant(s) into a new track:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="New artist"
              value={newArtist}
              onChange={(e) => setNewArtist(e.target.value)}
            />
            <input
              className="input"
              placeholder="New title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <ErrorText error={split.error} />
          <div className="flex gap-2">
            <button
              className="btn-primary"
              disabled={selected.length === 0 || split.isPending}
              onClick={doSplit}
            >
              Split into new track
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setSplitting(false);
                setSelected([]);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonCard({ data }: { data: ReturnType<typeof useTrackComparison>["data"] }) {
  if (!data || data.per_library_best.length < 2) return null;
  return (
    <div className="card">
      <h2 className="mb-3 font-medium text-white">Per-library comparison</h2>
      <table className="w-full text-sm">
        <thead className="border-b border-edge text-left text-gray-400">
          <tr>
            <th className="p-2">Library</th>
            <th className="p-2">Best available here</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {data.per_library_best.map((p) => (
            <tr key={p.library_id} className="border-b border-edge/40">
              <td className="p-2 text-gray-300">{p.library_name ?? `#${p.library_id}`}</td>
              <td className="p-2 text-gray-200">{p.format_label}</td>
              <td className="p-2">
                {p.is_overall_best ? (
                  <span className="badge border-emerald-500 text-emerald-300">optimal</span>
                ) : (
                  <span className="badge border-amber-500 text-amber-300">upgrade available</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditCard({ trackId, artist, title }: { trackId: number; artist: string; title: string }) {
  const update = useUpdateTrack();
  const [a, setA] = useState(artist);
  const [tt, setT] = useState(title);
  return (
    <div className="card">
      <h2 className="mb-3 font-medium text-white">Edit track</h2>
      <div className="space-y-2">
        <div>
          <label className="label">Artist</label>
          <input className="input" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div>
          <label className="label">Title</label>
          <input className="input" value={tt} onChange={(e) => setT(e.target.value)} />
        </div>
        <ErrorText error={update.error} />
        <button
          className="btn-primary w-full"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: trackId, artist: a, title: tt })}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function StreamingLinksCard({ trackId }: { trackId: number }) {
  const links = useStreamingLinks(trackId);
  const suggestions = useLinkSuggestions(trackId);
  const add = useAddStreamingLink();
  const del = useDeleteStreamingLink();
  const [service, setService] = useState<StreamingService>("spotify");
  const [url, setUrl] = useState("");

  return (
    <div className="card">
      <h2 className="mb-3 font-medium text-white">Streaming links</h2>
      {links.data && links.data.length > 0 ? (
        <ul className="mb-3 space-y-1 text-sm">
          {links.data.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <a href={l.url} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">
                {SERVICE_LABELS[l.service]}
              </a>
              <button
                className="text-xs text-red-400 hover:underline"
                onClick={() => del.mutate({ linkId: l.id, trackId })}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-gray-500">No links yet.</p>
      )}

      <div className="space-y-2">
        <select
          className="input"
          value={service}
          onChange={(e) => setService(e.target.value as StreamingService)}
        >
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {SERVICE_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <ErrorText error={add.error} />
        <button
          className="btn-primary w-full"
          disabled={!url || add.isPending}
          onClick={() => {
            add.mutate({ trackId, service, url });
            setUrl("");
          }}
        >
          Add link
        </button>
      </div>

      {suggestions.data && suggestions.data.length > 0 && (
        <div className="mt-4 border-t border-edge pt-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Suggestions</p>
          <ul className="space-y-1 text-sm">
            {suggestions.data.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate text-gray-300">
                  {SERVICE_LABELS[s.service]}{" "}
                  <span className="text-xs text-gray-500">from {s.source_artist}</span>
                </span>
                <button
                  className="text-xs text-accent hover:underline"
                  onClick={() => add.mutate({ trackId, service: s.service, url: s.url })}
                >
                  use
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AddToCollectionCard({ trackId }: { trackId: number }) {
  const collections = useCollections("user");
  const addTrack = useAddTrackToCollection();
  const [collectionId, setCollectionId] = useState<number | "">("");

  return (
    <div className="card">
      <h2 className="mb-3 font-medium text-white">Add to collection</h2>
      {collections.data && collections.data.length > 0 ? (
        <div className="space-y-2">
          <select
            className="input"
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select a collection…</option>
            {collections.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ErrorText error={addTrack.error} />
          <button
            className="btn-primary w-full"
            disabled={!collectionId || addTrack.isPending}
            onClick={() =>
              collectionId && addTrack.mutate({ collectionId: Number(collectionId), trackId })
            }
          >
            Add
          </button>
          {addTrack.isSuccess && <p className="text-xs text-emerald-400">Added.</p>}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Create a collection first.</p>
      )}
    </div>
  );
}

function MergeCard({ trackId, onMerged }: { trackId: number; onMerged: () => void }) {
  const tracks = useTracks();
  const merge = useMergeTrack();
  const [sourceId, setSourceId] = useState<number | "">("");
  const candidates = useMemo(
    () => (tracks.data ?? []).filter((t) => t.id !== trackId),
    [tracks.data, trackId]
  );

  return (
    <div className="card">
      <h2 className="mb-3 font-medium text-white">Merge another track in</h2>
      <p className="mb-2 text-xs text-gray-500">
        Combines another track's variants into this one (manual grouping override).
      </p>
      <div className="space-y-2">
        <select
          className="input"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select track to merge…</option>
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.artist} — {t.title}
            </option>
          ))}
        </select>
        <ErrorText error={merge.error} />
        <button
          className="btn-ghost w-full"
          disabled={!sourceId || merge.isPending}
          onClick={async () => {
            if (!sourceId) return;
            await merge.mutateAsync({ targetId: trackId, sourceId: Number(sourceId) });
            setSourceId("");
            onMerged();
          }}
        >
          Merge into this track
        </button>
      </div>
    </div>
  );
}
