import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  useCollections,
  useDuplicateVariants,
  useLibraries,
  useMissingVariants,
  useQualityDistribution,
  useTracks,
} from "../api/hooks";
import { PageHeader, QualityBadge } from "../components/ui";

function Stat({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const inner = (
    <div className="card transition-colors hover:border-accent">
      <div className="text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-gray-400">{label}</div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
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
  const entries = Object.entries(data);
  if (entries.length === 0 || total === 0)
    return <p className="text-sm text-gray-500">No variants yet.</p>;
  return (
    <div className="space-y-2">
      {entries.map(([key, count]) => (
        <div key={key}>
          <div className="mb-1 flex justify-between text-xs">
            {tiered ? <QualityBadge tier={key} /> : <span className="text-gray-300">{key}</span>}
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

export default function DashboardPage() {
  const { user } = useAuth();
  const libraries = useLibraries();
  const tracks = useTracks();
  const collections = useCollections();
  const missing = useMissingVariants();
  const dupes = useDuplicateVariants();
  const quality = useQualityDistribution();

  return (
    <div>
      <PageHeader title={`Welcome, ${user?.username}`} subtitle="Your metadata-first catalog at a glance." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="Libraries" value={libraries.data?.length ?? 0} to="/libraries" />
        <Stat label="Tracks" value={tracks.data?.length ?? 0} to="/tracks" />
        <Stat label="Collections" value={collections.data?.length ?? 0} to="/collections" />
        <Stat label="Upgrade gaps" value={missing.data?.count ?? 0} to="/analytics" />
        <Stat label="Duplicate sets" value={dupes.data?.count ?? 0} to="/analytics" />
      </div>

      <div className="mt-8 card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-white">Quality distribution</h2>
          <span className="text-xs text-gray-500">
            {quality.data?.total_variants ?? 0} variants across all libraries
          </span>
        </div>
        {quality.data && quality.data.total_variants > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs uppercase tracking-wide text-gray-500">By quality tier</h3>
              <Bars data={quality.data.by_tier} total={quality.data.total_variants} tiered />
            </div>
            <div>
              <h3 className="mb-2 text-xs uppercase tracking-wide text-gray-500">By codec</h3>
              <Bars data={quality.data.by_codec} total={quality.data.total_variants} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Scan a library to see its quality breakdown.</p>
        )}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-medium text-white">Get started</h2>
          <ol className="space-y-2 text-sm text-gray-300">
            <li>1. Create a library for a device or location.</li>
            <li>2. Scan a local folder — metadata is extracted in your browser.</li>
            <li>3. Compare libraries to find missing tracks and quality gaps.</li>
          </ol>
          <Link to="/libraries" className="btn-primary mt-4">
            Manage libraries
          </Link>
        </div>
        <div className="card">
          <h2 className="mb-3 font-medium text-white">Recent libraries</h2>
          {libraries.data && libraries.data.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {libraries.data.slice(0, 5).map((lib) => (
                <li key={lib.id} className="flex justify-between">
                  <Link to={`/libraries/${lib.id}`} className="text-accent hover:underline">
                    {lib.name}
                  </Link>
                  <span className="text-gray-500">{lib.track_count} tracks</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No libraries yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
