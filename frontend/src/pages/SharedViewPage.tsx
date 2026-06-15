import { Link, useParams } from "react-router-dom";
import { useSharedView } from "../api/hooks";
import { PageHeader, Spinner, Empty, ErrorText } from "../components/ui";

export default function SharedViewPage() {
  const { token } = useParams();
  const view = useSharedView(token ?? "");

  if (view.isLoading) return <Spinner />;
  if (view.error)
    return (
      <div>
        <PageHeader title="Shared collection" />
        <ErrorText error={view.error} />
      </div>
    );
  if (!view.data) return <Empty>Shared collection not found.</Empty>;

  const { collection, owner_username } = view.data;

  return (
    <div>
      <PageHeader
        title={collection.name}
        subtitle={`Shared by ${owner_username} · ${collection.item_count} tracks (read-only)`}
      />
      {collection.tracks.length === 0 ? (
        <Empty>This collection has no tracks.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-edge text-left text-gray-400">
              <tr>
                <th className="p-3">Artist</th>
                <th className="p-3">Title</th>
              </tr>
            </thead>
            <tbody>
              {collection.tracks.map((t) => (
                <tr key={t.id} className="border-b border-edge/50">
                  <td className="p-3 text-gray-300">{t.artist}</td>
                  <td className="p-3 text-gray-200">{t.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link to="/sharing" className="mt-4 inline-block text-sm text-accent hover:underline">
        ← Back to sharing
      </Link>
    </div>
  );
}
