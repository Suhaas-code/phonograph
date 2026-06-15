import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTracks } from "../api/hooks";
import { PageHeader, Spinner, Empty } from "../components/ui";

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
        actions={
          <input
            className="input w-64"
            placeholder="Filter by artist or title"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        }
      />
      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Empty>No tracks. Scan a library to populate your catalog.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-edge text-left text-gray-400">
              <tr>
                <th className="p-3">Artist</th>
                <th className="p-3">Title</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-edge/50 hover:bg-edge/30">
                  <td className="p-3 text-gray-300">{t.artist}</td>
                  <td className="p-3">
                    <Link to={`/tracks/${t.id}`} className="text-accent hover:underline">
                      {t.title}
                    </Link>
                    {t.manual && <span className="badge ml-2">manual</span>}
                  </td>
                  <td className="p-3 text-right text-xs text-gray-500">#{t.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
