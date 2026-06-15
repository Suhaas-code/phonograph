import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTracks } from "../api/hooks";
import { PageHeader, Spinner, Empty } from "../components/ui";
import type { TrackListItem } from "../types";

function LibraryBadges({ track }: { track: TrackListItem }) {
  if (track.libraries.length === 0)
    return <span className="text-xs text-gray-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {track.libraries.map((l) => (
        <Link key={l.id} to={`/libraries/${l.id}`} className="badge hover:border-accent">
          {l.name}
        </Link>
      ))}
    </div>
  );
}

function CollectionBadges({ track }: { track: TrackListItem }) {
  if (track.collections.length === 0)
    return <span className="text-xs text-gray-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {track.collections.map((c) => (
        <Link
          key={c.id}
          to={`/collections/${c.id}`}
          className={`badge hover:border-accent ${
            c.type === "user" ? "border-accent/60 text-accent" : ""
          }`}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

export default function TracksPage() {
  const { data: tracks, isLoading } = useTracks();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!tracks) return [];
    const f = filter.toLowerCase().trim();
    if (!f) return tracks;
    return tracks.filter(
      (t) => t.artist.toLowerCase().includes(f) || t.title.toLowerCase().includes(f)
    );
  }, [tracks, filter]);

  return (
    <div>
      <PageHeader
        title="Tracks"
        subtitle="Logical songs, deduplicated across your libraries."
      />
      <input
        className="input mb-4"
        placeholder="Filter by title or artist"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Empty>No tracks. Scan a library to populate your catalog.</Empty>
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-edge text-left text-gray-400">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Artist</th>
                  <th className="p-3">Libraries</th>
                  <th className="p-3">Collections</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-edge/50 align-top hover:bg-edge/30">
                    <td className="p-3">
                      <Link to={`/tracks/${t.id}`} className="text-accent hover:underline">
                        {t.title}
                      </Link>
                      {t.manual && <span className="badge ml-2">manual</span>}
                    </td>
                    <td className="p-3 text-gray-300">{t.artist}</td>
                    <td className="p-3">
                      <LibraryBadges track={t} />
                    </td>
                    <td className="p-3">
                      <CollectionBadges track={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((t) => (
              <div key={t.id} className="card">
                <Link to={`/tracks/${t.id}`} className="text-base font-medium text-accent">
                  {t.title}
                </Link>
                <div className="text-sm text-gray-300">{t.artist}</div>
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="label mb-1">Libraries</div>
                    <LibraryBadges track={t} />
                  </div>
                  <div>
                    <div className="label mb-1">Collections</div>
                    <CollectionBadges track={t} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
