import { useState } from "react";
import { Link } from "react-router-dom";
import {
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

// All-library comparison matrix: one column per library, rows are tracks that
// are NOT present in every library (the diffs), with + / − per library.
function MatrixTab() {
  const { data, isLoading } = useLibraryMatrix();

  if (isLoading) return <Spinner />;
  if (!data || data.libraries.length === 0)
    return <Empty>Create and scan some libraries to compare them.</Empty>;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-400">
        Comparing all {data.libraries.length} libraries. Showing{" "}
        <strong className="text-white">{data.diff_count}</strong> track
        {data.diff_count === 1 ? "" : "s"} that differ between libraries (of{" "}
        {data.total_tracks} total). A <span className="text-emerald-400">+</span> means present,{" "}
        a <span className="text-red-400">−</span> means missing.
      </p>

      {data.diff_count === 0 ? (
        <Empty>All libraries hold the same tracks — no differences.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-edge text-left text-gray-400">
              <tr>
                <th className="sticky left-0 bg-panel p-3">Track</th>
                {data.libraries.map((lib) => (
                  <th key={lib.id} className="p-3 text-center font-medium">
                    <Link to={`/libraries/${lib.id}`} className="hover:text-accent">
                      {lib.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.track.id} className="border-b border-edge/50 hover:bg-edge/30">
                  <td className="sticky left-0 bg-panel p-3">
                    <Link to={`/tracks/${row.track.id}`} className="text-accent hover:underline">
                      {row.track.title}
                    </Link>
                    <div className="text-xs text-gray-500">{row.track.artist}</div>
                  </td>
                  {data.libraries.map((lib) => {
                    const cell = row.presence[String(lib.id)];
                    return (
                      <td key={lib.id} className="p-3 text-center">
                        {cell?.present ? (
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-emerald-400">+</span>
                            <span className="text-[10px] text-gray-500">{cell.format_label}</span>
                          </div>
                        ) : (
                          <span className="font-semibold text-red-400">−</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
