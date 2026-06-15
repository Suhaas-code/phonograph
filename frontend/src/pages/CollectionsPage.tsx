import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useCollections, useCreateCollection } from "../api/hooks";
import { PageHeader, Spinner, Empty, ErrorText } from "../components/ui";
import type { Collection, CollectionType } from "../types";

const TYPE_LABELS: Record<CollectionType, string> = {
  user: "My Collections",
  album: "Albums (auto)",
  tag: "Tags / Genres (auto)",
  shared: "Shared",
};

export default function CollectionsPage() {
  const { data: collections, isLoading } = useCollections();
  const create = useCreateCollection();
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ name });
    setName("");
    setShowForm(false);
  }

  const grouped: Record<string, Collection[]> = {};
  (collections ?? []).forEach((c) => {
    (grouped[c.type] ||= []).push(c);
  });
  const order: CollectionType[] = ["user", "album", "tag"];

  return (
    <div>
      <PageHeader
        title="Collections"
        subtitle="Group tracks. Albums and tags are generated automatically from your scans."
        actions={
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New collection"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={onCreate} className="card mb-6 flex gap-2">
          <input
            className="input"
            placeholder="Collection name (e.g. Gym)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button className="btn-primary" disabled={create.isPending}>
            Create
          </button>
        </form>
      )}
      <ErrorText error={create.error} />

      {isLoading ? (
        <Spinner />
      ) : !collections || collections.length === 0 ? (
        <Empty>No collections yet.</Empty>
      ) : (
        order.map(
          (type) =>
            grouped[type] && (
              <section key={type} className="mb-8">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-400">
                  {TYPE_LABELS[type]}
                </h2>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {grouped[type].map((c) => (
                    <Link
                      key={c.id}
                      to={`/collections/${c.id}`}
                      className="card flex items-center justify-between transition-colors hover:border-accent"
                    >
                      <span className="text-white">{c.name}</span>
                      {type !== "user" && <span className="badge">auto</span>}
                    </Link>
                  ))}
                </div>
              </section>
            )
        )
      )}
    </div>
  );
}
