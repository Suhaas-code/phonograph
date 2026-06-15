import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LibraryMatrix,
  useDuplicateVariants,
  useLibraries,
  useLibraryMatrix,
  useMissingVariants,
  useQualityDistribution,
} from "../api/hooks";
import { PageHeader, Spinner, Empty, QualityBadge } from "../components/ui";

type Tab = "compare" | "missing-variants" | "duplicates" | "quality";

const TABS: { id: Tab; label: string }[] = [
  { id: "compare", label: "Library comparison" },
  { id: "missing-variants", label: "Upgrade gaps" },
  { id: "duplicates", label: "Duplicate variants" },
  { id: "quality", label: "Quality distribution" },
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
      {tab === "quality" && <QualityTab />}
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

// All-library comparison: one column per library. Each column lists every
// track that differs between libraries (title — artist) with its status in that
// library (− missing / + present). Clicking a library header sorts that column
// with missing tracks first (click again to flip to present-first).
function MatrixColumn({
  library,
  rows,
}: {
  library: { id: number; name: string };
  rows: LibraryMatrix["rows"];
}) {
  // Default: missing-first, so each column surfaces its own gaps at the top.
  const [missingFirst, setMissingFirst] = useState(true);

  const entries = useMemo(() => {
    const list = rows.map((row) => ({
      track: row.track,
      ...row.presence[String(library.id)],
    }));
    list.sort((a, b) => {
      if (a.present !== b.present) {
        // missingFirst => absent (present=false) ranks before present.
        const aKey = a.present ? 1 : 0;
        const bKey = b.present ? 1 : 0;
        return missingFirst ? aKey - bKey : bKey - aKey;
      }
      return (
        a.track.artist.localeCompare(b.track.artist) ||
        a.track.title.localeCompare(b.track.title)
      );
    });
    return list;
  }, [rows, library.id, missingFirst]);

  const missingCount = entries.filter((e) => !e.present).length;

  return (
    <div className="card flex-1 p-0 min-w-[260px]">
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
      <ul className="divide-y divide-edge/50">
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

  if (isLoading) return <Spinner />;
  if (!data || data.libraries.length === 0)
    return <Empty>Create and scan some libraries to compare them.</Empty>;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-400">
        Comparing all {data.libraries.length} libraries.{" "}
        <strong className="text-white">{data.diff_count}</strong> track
        {data.diff_count === 1 ? "" : "s"} differ (of {data.total_tracks} total). Tap a
        library to sort — missing first, then present.
      </p>

      {data.diff_count === 0 ? (
        <Empty>All libraries hold the same tracks — no differences.</Empty>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
          {data.libraries.map((lib) => (
            <MatrixColumn key={lib.id} library={lib} rows={data.rows} />
          ))}
        </div>
      )}
    </div>
  );
}

function LibrarySelect({
  label,
  value,
  onChange,
  libraries,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  libraries?: { id: number; name: string }[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="input w-56"
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
      >
        <option value="">Select…</option>
        {(libraries ?? []).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
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
          <div className="flex items-center justify-between">
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
          <div className="flex items-center justify-between">
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

function QualityTab() {
  const libraries = useLibraries();
  const [libraryId, setLibraryId] = useState<number | "">("");
  const { data, isLoading } = useQualityDistribution(libraryId ? Number(libraryId) : undefined);

  return (
    <div>
      <div className="card mb-6">
        <LibrarySelect
          label="Scope"
          value={libraryId}
          onChange={setLibraryId}
          libraries={[{ id: 0, name: "All libraries" }, ...(libraries.data ?? [])].filter(
            (l) => l.id !== 0 || true
          )}
        />
        <p className="mt-1 text-xs text-gray-500">Leave unselected for all libraries.</p>
      </div>
      {isLoading ? (
        <Spinner />
      ) : !data || data.total_variants === 0 ? (
        <Empty>No variants to analyze.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h3 className="mb-3 font-medium text-white">By quality tier</h3>
            <Bars data={data.by_tier} total={data.total_variants} tiered />
          </div>
          <div className="card">
            <h3 className="mb-3 font-medium text-white">By codec</h3>
            <Bars data={data.by_codec} total={data.total_variants} />
          </div>
          <div className="card md:col-span-2 text-sm text-gray-400">
            Total variants: <strong className="text-white">{data.total_variants}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function Bars({
  data,
  total,
  tiered,
}: {
  data: Record<string, number>;
  total: number;
  tiered?: boolean;
}) {
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, count]) => (
        <div key={key}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="flex items-center gap-2">
              {tiered ? <QualityBadge tier={key} /> : <span className="text-gray-300">{key}</span>}
            </span>
            <span className="text-gray-500">{count}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-edge">
            <div className="h-full bg-accent" style={{ width: `${(count / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
