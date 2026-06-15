import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useCollection,
  useDeleteCollection,
  useRemoveTrackFromCollection,
  useShareCollection,
  useUpdateCollection,
} from "../api/hooks";
import { PageHeader, Spinner, Empty, ErrorText } from "../components/ui";

export default function CollectionDetailPage() {
  const { id } = useParams();
  const collectionId = Number(id);
  const navigate = useNavigate();
  const collection = useCollection(collectionId);
  const update = useUpdateCollection();
  const del = useDeleteCollection();
  const removeTrack = useRemoveTrackFromCollection();
  const share = useShareCollection();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [shareUser, setShareUser] = useState("");
  const [shareResult, setShareResult] = useState<string | null>(null);

  if (collection.isLoading) return <Spinner />;
  if (!collection.data) return <Empty>Collection not found.</Empty>;
  const c = collection.data;
  const editable = c.type === "user";

  async function onShare() {
    const result = await share.mutateAsync({
      collectionId,
      shared_with_username: shareUser || undefined,
    });
    const url = `${window.location.origin}/shared/${result.token}`;
    setShareResult(url);
  }

  return (
    <div>
      <PageHeader
        title={c.name}
        subtitle={`${c.type} collection · ${c.item_count} tracks`}
        actions={
          editable ? (
            <>
              <button
                className="btn-ghost"
                onClick={() => {
                  setName(c.name);
                  setEditing(true);
                }}
              >
                Rename
              </button>
              <button
                className="btn-danger"
                onClick={async () => {
                  if (confirm(`Delete collection "${c.name}"?`)) {
                    await del.mutateAsync(collectionId);
                    navigate("/collections");
                  }
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <span className="badge">auto-generated · read-only</span>
          )
        }
      />

      {editing && (
        <div className="card mb-6 flex gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="btn-primary"
            onClick={async () => {
              await update.mutateAsync({ id: collectionId, name });
              setEditing(false);
            }}
          >
            Save
          </button>
          <button className="btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      )}

      <div className="card mb-6">
        <h2 className="mb-3 font-medium text-white">Share this collection</h2>
        <p className="mb-2 text-xs text-gray-500">
          Leave the username blank for a link any approved user can open, or enter a username to
          grant a specific approved user.
        </p>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="username (optional)"
            value={shareUser}
            onChange={(e) => setShareUser(e.target.value)}
          />
          <button className="btn-primary" onClick={onShare} disabled={share.isPending}>
            Create share link
          </button>
        </div>
        <ErrorText error={share.error} />
        {shareResult && (
          <div className="mt-3 rounded border border-edge bg-ink p-2 text-sm">
            <span className="text-gray-400">Link: </span>
            <Link to={shareResult.replace(window.location.origin, "")} className="text-accent break-all hover:underline">
              {shareResult}
            </Link>
          </div>
        )}
      </div>

      <h2 className="mb-3 font-medium text-white">Tracks</h2>
      {c.tracks.length === 0 ? (
        <Empty>No tracks in this collection.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-edge text-left text-gray-400">
              <tr>
                <th className="p-3">Artist</th>
                <th className="p-3">Title</th>
                {editable && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {c.tracks.map((t) => (
                <tr key={t.id} className="border-b border-edge/50 hover:bg-edge/30">
                  <td className="p-3 text-gray-300">{t.artist}</td>
                  <td className="p-3">
                    <Link to={`/tracks/${t.id}`} className="text-accent hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  {editable && (
                    <td className="p-3 text-right">
                      <button
                        className="text-xs text-red-400 hover:underline"
                        onClick={() =>
                          removeTrack.mutate({ collectionId, trackId: t.id })
                        }
                      >
                        remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
