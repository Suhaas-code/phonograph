import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useCreateLibrary, useLibraries } from "../api/hooks";
import { PageHeader, Spinner, Empty, ErrorText } from "../components/ui";
import { formatDate } from "../lib/format";

export default function LibrariesPage() {
  const { data: libraries, isLoading } = useLibraries();
  const create = useCreateLibrary();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ name, description: description || undefined });
    setName("");
    setDescription("");
    setShowForm(false);
  }

  return (
    <div>
      <PageHeader
        title="Libraries"
        subtitle="Each library is one scanned collection on a device or location."
        actions={
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New library"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={onCreate} className="card mb-6 space-y-3">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="e.g. Laptop FLAC Archive"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <ErrorText error={create.error} />
          <button className="btn-primary" disabled={create.isPending}>
            Create library
          </button>
        </form>
      )}

      {isLoading ? (
        <Spinner />
      ) : !libraries || libraries.length === 0 ? (
        <Empty>No libraries yet. Create one to start scanning.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {libraries.map((lib) => (
            <Link key={lib.id} to={`/libraries/${lib.id}`} className="card transition-colors hover:border-accent">
              <div className="text-lg font-medium text-white">{lib.name}</div>
              {lib.description && (
                <div className="mt-1 text-sm text-gray-400">{lib.description}</div>
              )}
              <div className="mt-3 flex justify-between text-xs text-gray-500">
                <span>{lib.track_count} tracks</span>
                <span>Last scan: {formatDate(lib.last_scan)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
