import { FormEvent, useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ name });
    setName("");
    setShowForm(false);
  }

  const grouped = useMemo(() => {
    const term = search.toLowerCase().trim();
    const result: Record<string, Collection[]> = {};
    (collections ?? [])
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .forEach((c) => {
        (result[c.type] ||= []).push(c);
      });
    return result;
  }, [collections, search]);
  const order: CollectionType[] = ["user", "album", "tag"];
  const hasResults = order.some((t) => grouped[t]?.length);

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

      <input
        className="input mb-6"
        placeholder="Search collections by name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <Spinner />
      ) : !collections || collections.length === 0 ? (
        <Empty>No collections yet.</Empty>
      ) : !hasResults ? (
        <Empty>No collections match “{search}”.</Empty>
      ) : (
        order.map(
          (type) =>
            grouped[type]?.length && (
              <section key={type} className="mb-8">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-400">
                  {TYPE_LABELS[type]}
                </h2>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {grouped[type].map((c) => (
                    <Link
                      key={c.id}
                      to={`/collections/${c.id}`}
                      className="card flex items-center justify-between gap-2 transition-colors hover:border-accent"
                    >
                      <span className="min-w-0 truncate text-white">{c.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="badge">{c.item_count ?? 0} songs</span>
                        {type !== "user" && <span className="badge">auto</span>}
                      </span>
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
