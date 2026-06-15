import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useCompareLibraries,
  useDuplicateVariants,
  useLibraries,
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
      {tab === "compare" && <CompareTab />}
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

function CompareTab() {
  const libraries = useLibraries();
  const [a, setA] = useState<number | "">("");
  const [b, setB] = useState<number | "">("");
  const compare = useCompareLibraries(Number(a), Number(b));

  return (
    <div>
      <div className="card mb-6 flex flex-wrap items-end gap-3">
        <LibrarySelect label="Library A" value={a} onChange={setA} libraries={libraries.data} />
        <LibrarySelect label="Library B" value={b} onChange={setB} libraries={libraries.data} />
      </div>

      {!a || !b ? (
        <Empty>Select two libraries to compare.</Empty>
      ) : a === b ? (
        <Empty>Choose two different libraries.</Empty>
      ) : compare.isLoading ? (
        <Spinner />
      ) : compare.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h3 className="mb-2 font-medium text-white">
              Only in {compare.data.library_a.name} ({compare.data.only_in_a.length})
            </h3>
            <TrackList tracks={compare.data.only_in_a} />
          </div>
          <div className="card">
            <h3 className="mb-2 font-medium text-white">
              Only in {compare.data.library_b.name} ({compare.data.only_in_b.length})
            </h3>
            <TrackList tracks={compare.data.only_in_b} />
          </div>
          <div className="card md:col-span-2 text-sm text-gray-400">
            In both libraries: <strong className="text-white">{compare.data.in_both_count}</strong> tracks
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TrackList({ tracks }: { tracks: { id: number; artist: string; title: string }[] }) {
  if (tracks.length === 0) return <p className="text-sm text-gray-500">None — fully covered.</p>;
  return (
    <ul className="max-h-96 space-y-1 overflow-auto text-sm">
      {tracks.map((t) => (
        <li key={t.id}>
          <TrackLink t={t} />
        </li>
      ))}
    </ul>
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
