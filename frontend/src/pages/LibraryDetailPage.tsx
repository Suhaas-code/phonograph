import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useDeleteLibrary,
  useLibrary,
  useLibraryStats,
  useLibraryTracks,
  useUpdateLibrary,
} from "../api/hooks";
import { PageHeader, Spinner, Empty, ErrorText, QualityBadge } from "../components/ui";
import ScanPanel from "../components/ScanPanel";
import { formatBytes, formatDate, formatDuration } from "../lib/format";

export default function LibraryDetailPage() {
  const { id } = useParams();
  const libraryId = Number(id);
  const navigate = useNavigate();
  const library = useLibrary(libraryId);
  const stats = useLibraryStats(libraryId);
  const tracks = useLibraryTracks(libraryId);
  const update = useUpdateLibrary();
  const del = useDeleteLibrary();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (library.isLoading) return <Spinner />;
  if (!library.data) return <Empty>Library not found.</Empty>;
  const lib = library.data;

  function startEdit() {
    setName(lib.name);
    setDescription(lib.description ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    await update.mutateAsync({ id: libraryId, name, description });
    setEditing(false);
  }

  async function onDelete() {
    if (!confirm(`Delete library "${lib.name}"? This removes its variants.`)) return;
    await del.mutateAsync(libraryId);
    navigate("/libraries");
  }

  return (
    <div>
      <PageHeader
        title={lib.name}
        subtitle={lib.description || "Library"}
        actions={
          <>
            <button className="btn-ghost" onClick={startEdit}>
              Edit
            </button>
            <button className="btn-danger" onClick={onDelete}>
              Delete
            </button>
          </>
        }
      />

      {editing && (
        <div className="card mb-6 space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={saveEdit} disabled={update.isPending}>
              Save
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Tracks" value={stats.data?.track_count ?? lib.track_count} />
        <StatCard label="Variants" value={stats.data?.variant_count ?? 0} />
        <StatCard label="Total size" value={formatBytes(stats.data?.total_size_bytes)} />
        <StatCard label="Last scan" value={formatDate(lib.last_scan)} small />
      </div>

      <div className="mb-6">
        <ScanPanel libraryId={libraryId} />
      </div>

      {stats.data && stats.data.variant_count > 0 && (
        <div className="card mb-6">
          <h2 className="mb-3 font-medium text-white">Quality distribution</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {Object.entries(stats.data.by_tier).map(([tier, count]) => (
              <div key={tier} className="flex items-center gap-2">
                <QualityBadge tier={tier} />
                <span className="text-gray-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 font-medium text-white">Tracks in this library</h2>
      <ErrorText error={tracks.error} />
      {tracks.isLoading ? (
        <Spinner />
      ) : !tracks.data || tracks.data.length === 0 ? (
        <Empty>No tracks yet. Scan a folder above.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-edge text-left text-gray-400">
              <tr>
                <th className="p-3">Artist</th>
                <th className="p-3">Title</th>
                <th className="p-3">Best format</th>
                <th className="p-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {tracks.data.map((t) => {
                const best = t.variants[0];
                return (
                  <tr key={t.id} className="border-b border-edge/50 hover:bg-edge/30">
                    <td className="p-3 text-gray-300">{t.artist}</td>
                    <td className="p-3">
                      <Link to={`/tracks/${t.id}`} className="text-accent hover:underline">
                        {t.title}
                      </Link>
                    </td>
                    <td className="p-3 text-gray-400">
                      {best ? `${best.format_label}` : "—"}
                    </td>
                    <td className="p-3 text-gray-500">{formatDuration(best?.duration)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  small,
}: {
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <div className="card">
      <div className={`font-semibold text-white ${small ? "text-sm" : "text-2xl"}`}>{value}</div>
      <div className="mt-1 text-xs text-gray-400">{label}</div>
    </div>
  );
}
