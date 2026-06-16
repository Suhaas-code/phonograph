import { useMemo, useState } from "react";
import { useCollections, useLibraries, useTracks } from "../api/hooks";
import AlphabetRail from "../components/AlphabetRail";
import { TrackColumnsHeader, TrackRow } from "../components/track";
import { PageHeader, Spinner, Empty } from "../components/ui";
import { useAlphabetScroll } from "../lib/useAlphabetScroll";
import type { TrackListItem } from "../types";

type SortField = "title" | "artist" | "library" | "collection";

const SORTS: { value: SortField; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "library", label: "Library" },
  { value: "collection", label: "Collection" },
];

function sortKey(t: TrackListItem, field: SortField): string {
  if (field === "artist") return t.artist || "";
  if (field === "library") return t.libraries[0]?.name || "";
  if (field === "collection") return t.collections[0]?.name || "";
  return t.title || "";
}

function letterOf(value: string): string {
  const c = (value || "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

export default function TracksPage() {
  const { data: tracks, isLoading } = useTracks();
  const libraries = useLibraries();
  const collections = useCollections();

  const [search, setSearch] = useState("");
  const [libraryId, setLibraryId] = useState<number | "">("");
  const [artist, setArtist] = useState("");
  const [collectionId, setCollectionId] = useState<number | "">("");
  const [sort, setSort] = useState<SortField>("title");

  const artists = useMemo(() => {
    const set = new Set((tracks ?? []).map((t) => t.artist).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tracks]);

  const groups = useMemo(() => {
    const term = search.toLowerCase().trim();
    const filtered = (tracks ?? []).filter((t) => {
      if (term && !`${t.title} ${t.artist}`.toLowerCase().includes(term)) return false;
      if (libraryId && !t.libraries.some((l) => l.id === libraryId)) return false;
      if (artist && t.artist !== artist) return false;
      if (collectionId && !t.collections.some((c) => c.id === collectionId)) return false;
      return true;
    });
    filtered.sort(
      (a, b) =>
        sortKey(a, sort).localeCompare(sortKey(b, sort), undefined, { sensitivity: "base" }) ||
        a.title.localeCompare(b.title)
    );
    const out: { letter: string; items: TrackListItem[] }[] = [];
    let cur: { letter: string; items: TrackListItem[] } | null = null;
    for (const t of filtered) {
      const L = letterOf(sortKey(t, sort));
      if (!cur || cur.letter !== L) {
        cur = { letter: L, items: [] };
        out.push(cur);
      }
      cur.items.push(t);
    }
    return out;
  }, [tracks, search, libraryId, artist, collectionId, sort]);

  const letters = useMemo(() => groups.map((g) => g.letter), [groups]);
  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);
  const { containerRef, setHeaderRef, active, onScroll, jump } = useAlphabetScroll(letters);

  return (
    <div>
      <PageHeader title="Tracks" subtitle="Logical songs, deduplicated across your libraries." />

      {/* Search + filters */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="input lg:col-span-2"
          placeholder="Search title or artist"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          value={libraryId}
          onChange={(e) => setLibraryId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">All libraries</option>
          {(libraries.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select className="input" value={artist} onChange={(e) => setArtist(e.target.value)}>
          <option value="">All artists</option>
          {artists.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
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
      </div>

      <div className="mb-3 flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Sort by</span>
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSort(s.value)}
              className={`rounded px-2 py-1 text-xs ${
                sort === s.value ? "bg-accent text-ink" : "border border-edge hover:bg-edge"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span>{total} tracks</span>
      </div>

      {isLoading ? (
        <Spinner />
      ) : total === 0 ? (
        <Empty>No tracks match. Adjust filters or scan a library.</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-edge bg-panel">
          <TrackColumnsHeader />
          <div className="relative">
            <div
              ref={containerRef}
              onScroll={onScroll}
              className="relative h-[calc(100dvh-19rem)] overflow-y-auto pr-11"
            >
              {groups.map((g) => (
                <div key={g.letter} ref={setHeaderRef(g.letter)}>
                  <div className="sticky top-0 z-[1] bg-edge/80 px-4 py-1 text-xs font-bold uppercase tracking-wide text-gray-300 backdrop-blur">
                    {g.letter}
                  </div>
                  {g.items.map((t) => (
                    <TrackRow key={t.id} track={t} />
                  ))}
                </div>
              ))}
            </div>
            <AlphabetRail letters={letters} active={active} onSelect={jump} />
          </div>
        </div>
      )}
    </div>
  );
}
