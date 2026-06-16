import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LibraryMatrix,
  useCollections,
  useDuplicateVariants,
  useLibraryMatrix,
  useMissingVariants,
  useTracks,
} from "../api/hooks";
import { PageHeader, Spinner, Empty } from "../components/ui";

type Tab = "compare" | "missing-variants" | "duplicates";

const TABS: { id: Tab; label: string }[] = [
  { id: "compare", label: "Library comparison" },
  { id: "missing-variants", label: "Upgrade gaps" },
  { id: "duplicates", label: "Duplicate variants" },
];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("compare");
  return (
    <div>
      <PageHeader title="Analytics" subtitle="Cross-library analysis of your catalog." />
      <div className="mb-6 flex flex-wrap gap-2 border-b border-edge">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.id ? "border-accent text-white" : "border-transparent text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "compare" && <MatrixTab />}
      {tab === "missing-variants" && <MissingVariantsTab />}
      {tab === "duplicates" && <DuplicatesTab />}
    </div>
  );
}

function TrackLink({ t }: { t: { id: number; artist: string; title: string } }) {
  return (
    <Link to={`/tracks/${t.id}`} className="text-accent hover:underline">
      {t.artist} — {t.title}
    </Link>
  );
}

type CompareSort = "artist" | "title";

// One column per library. Each column lists every differing track (title —
// artist) with its status in that library. Header click sorts missing-first /
// present-first; the global sort sets the alphabetical secondary order.
function MatrixColumn({
  library,
  rows,
  sortField,
}: {
  library: { id: number; name: string };
  rows: LibraryMatrix["rows"];
  sortField: CompareSort;
}) {
  const [missingFirst, setMissingFirst] = useState(true);

  const entries = useMemo(() => {
    const list = rows.map((row) => ({ track: row.track, ...row.presence[String(library.id)] }));
    list.sort((a, b) => {
      if (a.present !== b.present) {
        const aKey = a.present ? 1 : 0;
        const bKey = b.present ? 1 : 0;
        return missingFirst ? aKey - bKey : bKey - aKey;
      }
      const primary =
        sortField === "title"
          ? a.track.title.localeCompare(b.track.title)
          : a.track.artist.localeCompare(b.track.artist);
      return primary || a.track.title.localeCompare(b.track.title);
    });
    return list;
  }, [rows, library.id, missingFirst, sortField]);

  const missingCount = entries.filter((e) => !e.present).length;

  return (
    <div className="card min-w-[260px] flex-1 p-0">
      <button
        onClick={() => setMissingFirst((v) => !v)}
        className="flex w-full items-center justify-between border-b border-edge px-4 py-3 text-left hover:bg-edge/40"
        title="Sort: missing first / present first"
      >
        <span className="font-medium text-white">{library.name}</span>
        <span className="text-xs text-gray-400">
          {missingFirst ? "− first" : "+ first"} · {missingCount} missing
        </span>
      </button>
      <ul className="max-h-[60vh] divide-y divide-edge/50 overflow-y-auto">
        {entries.map((e) => (
          <li key={e.track.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className={`mt-0.5 w-3 shrink-0 text-center font-semibold ${
                e.present ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {e.present ? "+" : "−"}
            </span>
            <div className="min-w-0">
              <Link
                to={`/tracks/${e.track.id}`}
                className={`block truncate ${e.present ? "text-accent hover:underline" : "text-gray-300"}`}
              >
                {e.track.title} — {e.track.artist}
              </Link>
              <div className="text-xs text-gray-500">
                {e.present ? e.format_label : "not in this library"}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatrixTab() {
  const { data, isLoading } = useLibraryMatrix();
  const tracks = useTracks();
  const collections = useCollections();

  const [artist, setArtist] = useState("");
  const [collectionId, setCollectionId] = useState<number | "">("");
  const [hiddenLibs, setHiddenLibs] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<CompareSort>("artist");

  // Map track -> collection ids, so the collection filter can apply here too.
  const trackCollections = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const t of tracks.data ?? []) {
      map.set(t.id, new Set(t.collections.map((c) => c.id)));
    }
    return map;
  }, [tracks.data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const term = artist.toLowerCase().trim();
    return data.rows.filter((row) => {
      if (term && !row.track.artist.toLowerCase().includes(term)) return false;
      if (collectionId) {
        const set = trackCollections.get(row.track.id);
        if (!set || !set.has(collectionId)) return false;
      }
      return true;
    });
  }, [data, artist, collectionId, trackCollections]);

  if (isLoading) return <Spinner />;
  if (!data || data.libraries.length === 0)
    return <Empty>Create and scan some libraries to compare them.</Empty>;

  const visibleLibs = data.libraries.filter((l) => !hiddenLibs.has(l.id));

  const toggleLib = (id: number) =>
    setHiddenLibs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="input"
          placeholder="Filter by artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <select
          className="input"
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">All collections</option>
          {(collections.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="text-gray-500">Sort</span>
          {(["artist", "title"] as CompareSort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortField(s)}
              className={`rounded px-2 py-1 text-xs capitalize ${
                sortField === s ? "bg-accent text-ink" : "border border-edge hover:bg-edge"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {data.libraries.map((l) => (
            <button
              key={l.id}
              onClick={() => toggleLib(l.id)}
              className={`badge ${hiddenLibs.has(l.id) ? "opacity-40" : "border-accent text-accent"}`}
              title="Show/hide this library column"
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-400">
        Comparing {visibleLibs.length} of {data.libraries.length} libraries.{" "}
        <strong className="text-white">{filteredRows.length}</strong> differing track
        {filteredRows.length === 1 ? "" : "s"} shown. Tap a library header to sort missing-first.
      </p>

      {visibleLibs.length === 0 ? (
        <Empty>All library columns are hidden — re-enable one above.</Empty>
      ) : filteredRows.length === 0 ? (
        <Empty>No differing tracks match the current filters.</Empty>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
          {visibleLibs.map((lib) => (
            <MatrixColumn key={lib.id} library={lib} rows={filteredRows} sortField={sortField} />
          ))}
        </div>
      )}
    </div>
  );
}

function MissingVariantsTab() {
  const { data, isLoading } = useMissingVariants();
  if (isLoading) return <Spinner />;
  if (!data || data.count === 0)
    return <Empty>No upgrade gaps — every library holds the best available variant.</Empty>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        Tracks where a library holds a lower-quality variant than the best you own.
      </p>
      {data.items.map((item) => (
        <div key={item.track.id} className="card">
          <div className="flex items-center justify-between gap-2">
            <TrackLink t={item.track} />
            <span className="badge border-accent text-accent">best: {item.best_format}</span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            {item.libraries_below_best.map((lib) => (
              <li key={lib.library_id}>
                {lib.library_name ?? `#${lib.library_id}`}: has {lib.current_format}{" "}
                <span className="text-amber-400">(upgrade available)</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function DuplicatesTab() {
  const { data, isLoading } = useDuplicateVariants();
  if (isLoading) return <Spinner />;
  if (!data || data.count === 0)
    return <Empty>No duplicate variants found within any single library.</Empty>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        Tracks represented by more than one file in the same library.
      </p>
      {data.items.map((item, i) => (
        <div key={i} className="card">
          <div className="flex items-center justify-between gap-2">
            <TrackLink t={item.track} />
            <span className="badge">
              {item.library_name ?? `#${item.library_id}`} · {item.count} files
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-gray-500">
            {item.variants.map((v) => (
              <li key={v.id}>
                {v.format} — <span className="text-gray-600">{v.file_path}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
