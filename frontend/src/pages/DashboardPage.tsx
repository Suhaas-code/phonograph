import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  useCollections,
  useDuplicateVariants,
  useLibraries,
  useMissingVariants,
  useTracks,
} from "../api/hooks";
import { PageHeader } from "../components/ui";

function Stat({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const inner = (
    <div className="card transition-colors hover:border-accent">
      <div className="text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-gray-400">{label}</div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const libraries = useLibraries();
  const tracks = useTracks();
  const collections = useCollections();
  const missing = useMissingVariants();
  const dupes = useDuplicateVariants();

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
