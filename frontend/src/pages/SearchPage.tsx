import { useState } from "react";
import { Link } from "react-router-dom";
import { useSearch } from "../api/hooks";
import { PageHeader, Empty, Spinner } from "../components/ui";

const FIELDS = [
  { value: "all", label: "All" },
  { value: "artist", label: "Artist" },
  { value: "track", label: "Track" },
  { value: "album", label: "Album" },
  { value: "genre", label: "Genre" },
  { value: "codec", label: "Codec" },
];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [field, setField] = useState("all");
  const { data, isLoading, isFetched } = useSearch(q, field);

  return (
    <div>
      <PageHeader title="Search" subtitle="Search across artist, track, album, genre, and codec." />
      <div className="card mb-6 flex flex-wrap gap-2">
        <input
          className="input flex-1"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <select className="input w-40" value={field} onChange={(e) => setField(e.target.value)}>
          {FIELDS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {q.trim() === "" ? (
        <Empty>Type to search your catalog.</Empty>
      ) : isLoading ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        isFetched ? <Empty>No matches.</Empty> : null
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-edge text-left text-gray-400">
              <tr>
                <th className="p-3">Artist</th>
                <th className="p-3">Title</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-b border-edge/50 hover:bg-edge/30">
                  <td className="p-3 text-gray-300">{t.artist}</td>
                  <td className="p-3">
                    <Link to={`/tracks/${t.id}`} className="text-accent hover:underline">
                      {t.title}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
